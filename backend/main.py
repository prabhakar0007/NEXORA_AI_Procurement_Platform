import os, sqlite3, json, random
from pathlib import Path
from datetime import datetime
from typing import Optional
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
DB = ROOT / "nexora.db"
app = FastAPI(title="NEXORA AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def conn():
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    with conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS suppliers(
            id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT,
            location TEXT, price REAL, quality REAL, reliability REAL, lead_days INTEGER,
            email TEXT, status TEXT DEFAULT 'Active', created_at TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS rfqs(
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, quantity INTEGER,
            budget REAL, deadline TEXT, created_at TEXT)""")
        
        sup_count = c.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0]
        if sup_count == 0:
            seed = [
                ("Apex Components", "Electronics", "Pune, India", 42.5, 94, 92, 8, "sales@apex.example"),
                ("Northstar Industries", "Electronics", "Ludhiana, India", 40.8, 89, 86, 12, "hello@northstar.example"),
                ("Vertex Manufacturing", "Electronics", "Delhi, India", 44.0, 97, 95, 6, "orders@vertex.example"),
                ("BluePeak Supplies", "Electronics", "Ahmedabad, India", 39.9, 85, 80, 15, "sales@bluepeak.example"),
            ]
            for s in seed:
                c.execute("""INSERT INTO suppliers(name,category,location,price,quality,reliability,lead_days,email,created_at)
                             VALUES(?,?,?,?,?,?,?,?,?)""", (*s, datetime.utcnow().isoformat()))
        
        rfq_count = c.execute("SELECT COUNT(*) FROM rfqs").fetchone()[0]
        if rfq_count == 0:
            seed_rfqs = [
                ("High-Grade Electronic Capacitors", 10000, 450000.0, "2026-11-15"),
                ("Precision Microcontroller Units", 5000, 220000.0, "2026-11-28"),
                ("Thermal Heat Sink Assemblies", 8000, 340000.0, "2026-12-05"),
            ]
            for r in seed_rfqs:
                c.execute("""INSERT INTO rfqs(title,quantity,budget,deadline,created_at)
                             VALUES(?,?,?,?,?)""", (*r, datetime.utcnow().isoformat()))

init_db()

class SupplierIn(BaseModel):
    name: str
    category: str = "General"
    location: str = "India"
    price: float = Field(gt=0)
    quality: float = Field(ge=0, le=100, default=80)
    reliability: float = Field(ge=0, le=100, default=80)
    lead_days: int = Field(ge=1, default=7)
    email: str = ""

class RFQIn(BaseModel):
    title: str
    quantity: int = Field(gt=0)
    budget: float = Field(gt=0)
    deadline: str = ""

class AskIn(BaseModel):
    prompt: str
    context: Optional[dict] = {}

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "maps_configured": bool(os.getenv("GOOGLE_MAPS_API_KEY"))
    }

@app.get("/api/config")
def config():
    return {
        "maps_key": os.getenv("GOOGLE_MAPS_API_KEY", ""),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY"))
    }

@app.get("/api/suppliers")
def suppliers():
    with conn() as c:
        return [dict(x) for x in c.execute("SELECT * FROM suppliers ORDER BY id DESC")]

@app.post("/api/suppliers")
def add_supplier(s: SupplierIn):
    with conn() as c:
        cur = c.execute("""INSERT INTO suppliers(name,category,location,price,quality,reliability,lead_days,email,created_at)
        VALUES(?,?,?,?,?,?,?,?,?)""", (s.name, s.category, s.location, s.price, s.quality, s.reliability, s.lead_days, s.email, datetime.utcnow().isoformat()))
        return {"id": cur.lastrowid, "message": "Supplier saved"}

@app.delete("/api/suppliers/{sid}")
def delete_supplier(sid: int):
    with conn() as c:
        cur = c.execute("DELETE FROM suppliers WHERE id=?", (sid,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Supplier not found")
    return {"message": "Supplier deleted"}

@app.get("/api/rfqs")
def rfqs():
    with conn() as c:
        return [dict(x) for x in c.execute("SELECT * FROM rfqs ORDER BY id DESC")]

@app.post("/api/rfqs")
def create_rfq(r: RFQIn):
    with conn() as c:
        cur = c.execute("""INSERT INTO rfqs(title,quantity,budget,deadline,created_at) VALUES(?,?,?,?,?)""",
                        (r.title, r.quantity, r.budget, r.deadline, datetime.utcnow().isoformat()))
    return {"id": cur.lastrowid, "message": "RFQ created"}

@app.delete("/api/rfqs/{rid}")
def delete_rfq(rid: int):
    with conn() as c:
        cur = c.execute("DELETE FROM rfqs WHERE id=?", (rid,))
        if cur.rowcount == 0:
            raise HTTPException(404, "RFQ not found")
    return {"message": "RFQ deleted"}

@app.post("/api/ai/ask")
def ask_ai(payload: AskIn):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(503, "Gemini API key missing. Add GEMINI_API_KEY to .env and restart.")
    
    preferred_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")
    # Candidate models for resilient failover in case of 404/503/429
    candidate_models = [preferred_model]
    for fallback in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"]:
        if fallback not in candidate_models:
            candidate_models.append(fallback)

    prompt = (
        "You are NEXORA AI, an expert procurement intelligence and sourcing operations analyst.\n"
        "Guidelines:\n"
        "- Provide concise, well-structured, actionable advice with bullet points or numbered lists where appropriate.\n"
        "- Base analysis on the workspace context (suppliers, unit prices, quality, reliability, lead times, RFQs).\n"
        "- Clearly distinguish supplied workspace data from assumptions and general industry advice.\n"
        "- For calculations, explain the numbers clearly in INR (₹).\n\n"
        f"User request: {payload.prompt}\n\n"
        f"Workspace context:\n{json.dumps(payload.context or {}, ensure_ascii=False, indent=2)}"
    )

    last_error = None
    for model in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        try:
            r = requests.post(
                url,
                params={"key": key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.4, "maxOutputTokens": 2048}
                },
                timeout=30
            )
            if r.status_code == 200:
                data = r.json()
                candidates = data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        answer = parts[0]["text"]
                        return {"answer": answer, "provider": "Gemini", "model": model, "mode": "LIVE"}
                # If 200 but parts empty
                finish_reason = candidates[0].get("finishReason", "UNKNOWN") if candidates else "NO_CANDIDATES"
                return {"answer": f"Analysis concluded with status: {finish_reason}.", "provider": "Gemini", "model": model, "mode": "LIVE"}
            
            # If 404, 429, 500, 503, log and try next model
            if r.status_code in [404, 429, 500, 502, 503, 504]:
                err_text = r.json().get("error", {}).get("message", r.text[:200]) if r.headers.get("content-type", "").startswith("application/json") else r.text[:200]
                last_error = f"Model {model} returned HTTP {r.status_code}: {err_text}"
                continue
            
            # Any other error
            err_msg = r.text[:300]
            try:
                err_json = r.json()
                err_msg = err_json.get("error", {}).get("message", err_msg)
            except Exception:
                pass
            last_error = f"Model {model} error ({r.status_code}): {err_msg}"
            continue

        except requests.RequestException as e:
            last_error = f"Gemini network error ({model}): {e}"
            continue

    raise HTTPException(502, f"Gemini request failed: {last_error or 'All model endpoints unavailable'}")

@app.get("/api/demo/logistics/{supplier_id}")
def demo_logistics(supplier_id: int):
    return {
        "provider": "DEMO SIMULATION",
        "shipment_id": f"NX-{supplier_id:04d}-DEMO",
        "status": random.choice(["Label created", "In transit", "At sorting hub", "Out for delivery"]),
        "estimated_days": random.randint(2, 8),
        "live_tracking": False,
        "notice": "Simulated status. No real carrier booking or tracking has occurred."
    }

@app.get("/api/demo/erp")
def demo_erp():
    return {
        "provider": "DEMO SIMULATION",
        "connected": True,
        "system": "Sample ERP",
        "records_synced": 24,
        "last_sync": "Just now",
        "live_connection": False,
        "notice": "Sample ERP data only; no live ERP connection is active."
    }

@app.get("/", response_class=HTMLResponse)
def index():
    return (ROOT / "frontend/index.html").read_text(encoding="utf-8")

@app.get("/style.css")
def frontend_stylesheet():
    return FileResponse(ROOT / "frontend/style.css", media_type="text/css")

@app.get("/app.js")
def frontend_script():
    return FileResponse(ROOT / "frontend/app.js", media_type="application/javascript")

app.mount("/static", StaticFiles(directory=ROOT / "frontend"), name="static")
