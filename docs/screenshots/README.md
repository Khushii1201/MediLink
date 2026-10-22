# MediLink Visual Documentation & Screenshots Guide

This directory contains visual captures and UI documentation for the MediLink healthcare coordination platform.

---

## Screenshot Capture Guidelines

When recording UI walkthroughs or capturing screenshots for demonstration, documentation, or grading submission:
1. **Resolution:** Capture at `1920x1080` (1080p) or higher with 100% browser scaling.
2. **Theme Consistency:** Capture both Light Mode and Dark Mode for key views.
3. **Data Pre-flight:** Ensure `npm run seed` has been executed beforehand so all live counters, Delhi NCR facilities, ambulances, and blood inventory are populated.

---

## Recommended Capture Checklist (8 Core Views)

| # | Screen / View | Route | Key Elements to Showcase | Recommended File Name |
|---|---|---|---|---|
| 1 | **Landing Page** | `/` | Hero section, dynamic regional stats counter, Leaflet emergency map with interactive pins, and role breakdown cards. | `01_landing_page.png` |
| 2 | **Hospital Directory** | `/hospitals` | Filter toolbar (specialty, min beds, ICU/Ventilator toggles), distance calculations, and interactive map pins. | `02_hospital_directory.png` |
| 3 | **Hospital Facility Profile** | `/hospitals/:id` | Facility contacts, bed/ICU/ventilator breakdowns, medical specialist roster, and emergency admission modal trigger. | `03_hospital_detail.png` |
| 4 | **Blood Bank Directory** | `/blood` | Blood group filter buttons (A+, B+, O-, etc.), proximity distance to user, stock badges, and reservation modal. | `04_blood_bank_finder.png` |
| 5 | **Patient Portal** | `/patient` | Multi-tab experience: Algorithmic Recommendations breakdown, Admission ticket stepper, Live Ambulance ETA tracker, and Active Reservations. | `05_patient_dashboard.png` |
| 6 | **Hospital Staff Console** | `/hospital` | Real-time Bed/ICU steppers, Critical Triage Queue (CRITICAL tags listed first), Doctor roster CRUD, and waiting-time updater. | `06_hospital_dashboard.png` |
| 7 | **Ambulance Operator Console** | `/ambulance` | Vehicle availability switch, HTML5 Geolocation broadcast widget, Trip execution stepper (Accepted -> En Route -> Complete). | `07_ambulance_dashboard.png` |
| 8 | **Administrative Console** | `/admin` | System KPIs, Capacity & Occupancy SVG bar charts, Staff user provisioning modal, Entity CRUD, and Live Audit Trail. | `08_admin_dashboard.png` |
