# MediLink

A working full-stack prototype of the MediLink centralized healthcare coordination
platform, implemented from the project's SRS, UML, DFD, and ER design documents.

MediLink connects patients, hospitals, ambulance operators, blood banks, and
administrators so emergency resources can be found, requested, and monitored
from one application.

## Tech stack (academic-prototype substitutions noted)

| Layer | SRS target | Used in this build | Why |
|---|---|---|---|
| Frontend | React.js, HTML5, CSS3, JS | React 19 + Vite | Same framework; Vite gives fast local dev with no extra setup |
| Backend | Java Spring Boot + REST | Node.js + Express + REST | Same REST API contract; Node keeps the whole stack runnable with just `npm install` in this environment, no JDK/Maven required |
| Database | MySQL | SQLite (file-based, `better-sqlite3`) | Same relational schema/relationships as the ER diagram; SQLite needs no server to install — swap the `db.js` driver for `mysql2` to point at MySQL with the same SQL |
| Maps/GPS | Google Maps API | Lat/lng fields + Haversine distance calc | Demonstrates location-aware search/recommendation logic without requiring an API key |
| AI recommendation | Python ML / Ollama + Llama 3 | Rule-based weighted scorer (distance, bed availability, waiting time) in `routes/recommendations.js` | Reproduces the documented recommendation *behavior* (SRS §5.6) without external ML infra; swap in a real model behind the same endpoint later |

Everything else — the data model, roles, workflows, and REST endpoints — follows
the SRS, Use Case diagram, Class diagram, and ER diagram directly.

## Project structure

```
medilink/
  backend/     Express API + SQLite database + seed data
  frontend/    React (Vite) client, one dashboard per role
```

## Prerequisites

- Node.js 18+ and npm

## Setup

### 1. Backend

```bash
cd backend
npm install
npm run seed      # creates medilink.db and demo data (run once)
npm start         # runs on http://localhost:5000
```

### 2. Frontend (in a second terminal)

```bash
cd frontend
npm install
npm run dev       # runs on http://localhost:5173
```

Open **http://localhost:5173**. The Vite dev server proxies `/api/*` requests
to the backend on port 5000, so no extra configuration is needed.

### Demo accounts

All demo accounts use the password `password123`:

| Role | Email |
|---|---|
| Administrator | admin@medilink.com |
| Patient | patient@medilink.com |
| Hospital staff | hospital@medilink.com |
| Ambulance operator | ambulance@medilink.com |
| Blood bank staff | bloodbank@medilink.com |

The login page has one-click buttons to fill these in.

## Features implemented (mapped to SRS §5)

- **5.1 Authentication & Authorization** — register/login, JWT sessions, role-based route guards on both API and UI.
- **5.2 Hospital Resource Management** — hospital staff update bed/ICU/ventilator counts, add doctors, toggle doctor availability, set waiting times.
- **5.3 Emergency Admission** — patients submit admission requests with a reason; hospital staff accept/reject/complete them (accepting decrements available beds).
- **5.4 Ambulance Service** — patients request an ambulance (auto-assigned to the nearest available vehicle); operators advance trip status and push GPS updates.
- **5.5 Blood Bank Management** — public blood-group search, patient reservations, blood bank staff approve/reject/fulfill requests (which decrements inventory).
- **5.6 AI Hospital Recommendation** — ranks hospitals by a transparent, documented formula combining distance, bed-availability ratio, and average waiting time; every request is logged for audit/history.
- **5.7 Waiting-Time Prediction** — hospital-maintained per-department estimates, surfaced in search and recommendations.
- **5.8 Administration & Analytics** — user management, totals, status breakdowns, bed occupancy, and average wait by hospital.

Security notes per SRS §7: passwords are bcrypt-hashed (never stored in plain
text), all provider/admin actions require their role's JWT, and AI output is
labeled as an estimate, not a clinical decision.

## Resetting demo data

```bash
cd backend
rm -f medilink.db medilink.db-shm medilink.db-wal
npm run seed
```

## Building the frontend for production

```bash
cd frontend
npm run build      # outputs static files to frontend/dist
```

Serve `frontend/dist` with any static host, and point it at a deployed backend
by setting the API base URL (currently `/api`, proxied in dev — in production,
either serve both from the same origin behind a reverse proxy, or change the
`BASE` constant in `frontend/src/api.js`).

## Limitations (per SRS §9)

This is an academic prototype: resource data is self-reported by seed/demo
data rather than live hospital systems, location features use manual
lat/lng rather than a live Maps SDK, and the AI recommendation is a
transparent rule-based formula rather than a trained model.
