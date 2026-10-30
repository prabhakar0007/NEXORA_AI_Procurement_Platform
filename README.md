# NEXORA AI — Procurement Intelligence Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-brightgreen?style=for-the-badge&logo=cloudflare)](https://roses-sue-cohen-status.trycloudflare.com)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-blue?style=for-the-badge&logo=github)](https://github.com/prabhakar0007/NEXORA_AI_Procurement_Platform)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/prabhakar0007/NEXORA_AI_Procurement_Platform)

> **🚀 Live Public URL:** [https://roses-sue-cohen-status.trycloudflare.com](https://roses-sue-cohen-status.trycloudflare.com)  

---

## 🌟 Overview
**NEXORA AI** is an intelligent, full-stack procurement operations and supplier intelligence platform. Built with a high-performance **FastAPI** backend and responsive modern frontend, it leverages **Google Gemini 3.5 Flash** for grounded sourcing decisions, cost optimization, and contract trade-off analysis.

---

## ⚡ Key Features

- **🤖 AI Procurement Copilot (Gemini 3.5 Flash)**:
  - Grounded directly on your workspace suppliers, quote prices, lead times, and active RFQs.
  - Multi-tier resilient fallback cascade (`gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-3.8-flash`).
  - Formatted Markdown responses with bullet points, calculation explanations, and risk assessments.
- **📊 Real-time Procurement Analytics**:
  - Dynamic potential savings calculator based on quote spreads and RFQ volumes.
  - Scorecard comparing supplier quality and reliability indices.
  - 30-day performance trend visualization.
- **📦 RFQ & Sourcing Pipeline**:
  - Create and manage purchase requirements with budgets and deadlines.
  - Delete completed/obsolete RFQs.
  - 1-click **"Run Smart Optimizer"** button from any RFQ card.
- **✳ Smart Supplier Allocation Optimizer**:
  - Deterministic cost-optimization engine under delivery window and budget constraints.
  - **"Ask Gemini"** bridge to evaluate allocations, bottleneck risks, and negotiation opportunities.
- **🗺 Logistics & Route Intelligence**:
  - Integrated with Google Maps JavaScript API for supplier mapping and route estimation.
  - Simulated shipment lifecycle tracking.

---

## 🛠 Tech Stack

- **Backend**: Python 3.10+, FastAPI, Uvicorn, SQLite3, Requests, Pydantic
- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism & SaaS Design), ES6+ JavaScript
- **AI Model**: Google Gemini 3.5 Flash via REST API
- **Maps**: Google Maps JavaScript API & Geocoding
- **Deployment**: Docker (`Dockerfile`), Procfile, `render.yaml`, `vercel.json`, Cloudflare Tunnel

---

## 🚀 Running Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/prabhakar0007/NEXORA_AI_Procurement_Platform.git
   cd NEXORA_AI_Procurement_Platform
   ```

2. **Create virtual environment and install dependencies:**
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # macOS / Linux:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   ```
   Add your keys in `.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   GEMINI_MODEL=gemini-3.5-flash
   ```

4. **Start the server:**
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   Open **http://127.0.0.1:8000** in your browser.

---

## ☁️ Deployment Options

- **Cloudflare Quick Tunnel**: Direct HTTPS public URL without port forwarding.
- **Render**: Click the **Deploy to Render** button above or use `render.yaml`.
- **Vercel**: Pre-configured with `vercel.json` for Serverless Python.
- **Docker**: Pre-built `Dockerfile` included (`docker build -t nexora .`).

---

## 🔒 Security & Best Practices

- Gemini API keys are handled server-side only; never exposed to the client.
- `.env` and SQLite database (`nexora.db`) are excluded via `.gitignore`.
- Production CORS middleware enabled for secure cross-origin requests.
