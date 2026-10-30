# NEXORA AI — Procurement Intelligence

A polished procurement workspace with:
- Gemini API integration through a secure FastAPI backend
- Google Maps JavaScript API integration (map key configured in frontend environment)
- Working supplier CRUD, RFQ creation, quote comparison, order allocation and scenario simulation
- Clearly labelled demo logistics / ERP / email integrations
- SQLite persistence for local development

## Requirements
- Python 3.10+
- Gemini API key
- Google Maps JavaScript API key with Maps JavaScript API enabled

## Run locally (Windows)
1. Extract the ZIP.
2. Open the extracted folder in VS Code.
3. Open a terminal and run:

```bash
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

4. Add your keys to `.env`:
```env
GEMINI_API_KEY=your_real_gemini_key
GOOGLE_MAPS_API_KEY=your_google_maps_key
GEMINI_MODEL=gemini-3.5-flash
```

5. Start:
```bash
uvicorn backend.main:app --reload
```

6. Open http://127.0.0.1:8000

## Run on macOS / Linux
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.main:app --reload
```

## Security notes
- Never commit `.env`.
- Gemini calls are made server-side; the Gemini key is not exposed to the browser.
- Google Maps browser key is necessarily visible in page source. Restrict it in Google Cloud Console by HTTP referrer and restrict it to Maps JavaScript API.
- Demo integrations are simulated and labelled DEMO. They do not create real shipments, send real emails, or connect to SAP Ariba.
- This is a strong local MVP foundation, not a certified production procurement platform. Before real business deployment add role-based access control, audit logs, backups, rate limits, tenant isolation, supplier verification and legal/privacy review.

## Google Maps setup
Enable **Maps JavaScript API** in Google Cloud Console, create a browser key, and put it in `.env` as `GOOGLE_MAPS_API_KEY`. Restrict the key to your deployed domain and localhost during development.

## Main modules
- `backend/main.py`: API routes, Gemini proxy, SQLite data and demo service endpoints
- `frontend/`: responsive dashboard UI
- `frontend/app.js`: state, API calls, supplier management, quote comparison, map, simulations
