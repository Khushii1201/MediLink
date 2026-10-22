# MediLink REST API Specification

This document provides a comprehensive reference for the MediLink REST API, including request parameters, authorization rules, payload schemas, and response formats.

---

## Base URL & Authentication

- **Base URL:** `http://localhost:5000/api` (or `/api` in production)
- **Authentication Scheme:** `Authorization: Bearer <JWT_TOKEN>`
- **Content-Type:** `application/json`

---

## 1. System & Authentication Endpoints

### 1.1 Health Check
- **Method:** `GET`
- **Path:** `/health`
- **Access:** Public (No Auth)
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "service": "medilink-backend",
    "env": "production",
    "timestamp": "2026-10-22T21:00:00.000Z"
  }
  ```

### 1.2 Public Network Statistics
- **Method:** `GET`
- **Path:** `/public/stats`
- **Access:** Public (No Auth)
- **Response `200 OK`:**
  ```json
  {
    "hospitals": 8,
    "beds_available": 142,
    "icu_available": 18,
    "blood_units_available": 115,
    "ambulances_available": 4
  }
  ```

### 1.3 Patient Registration
- **Method:** `POST`
- **Path:** `/auth/register`
- **Access:** Public (Forces `PATIENT` role)
- **Request Body:**
  ```json
  {
    "name": "Ananya Verma",
    "email": "ananya@example.com",
    "password": "strongPassword123",
    "phone": "+91 98765 43210"
  }
  ```
- **Response `201 Created`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "user_id": 7,
      "name": "Ananya Verma",
      "email": "ananya@example.com",
      "role": "PATIENT"
    }
  }
  ```

### 1.4 User Login
- **Method:** `POST`
- **Path:** `/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "patient@medilink.com",
    "password": "password123"
  }
  ```
- **Response `200 OK`:**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "user_id": 2,
      "name": "John Doe",
      "email": "patient@medilink.com",
      "role": "PATIENT"
    }
  }
  ```

### 1.5 Get Current Profile (`/me`)
- **Method:** `GET`
- **Path:** `/auth/me`
- **Access:** Bearer Token (Any Active Role)
- **Response `200 OK`:**
  ```json
  {
    "user": {
      "user_id": 3,
      "name": "AIIMS Administrator",
      "email": "hospital@medilink.com",
      "role": "HOSPITAL",
      "hospital_id": 1,
      "active": 1
    }
  }
  ```

---

## 2. Hospitals & Resources

### 2.1 Search Hospitals
- **Method:** `GET`
- **Path:** `/hospitals`
- **Query Params:** `q`, `specialty`, `insurance`, `min_beds`, `has_icu`, `has_ventilator`, `lat`, `lng`, `sort`
- **Response `200 OK`:** Array of hospital objects with aggregated beds and distances.

### 2.2 Get Hospital Details
- **Method:** `GET`
- **Path:** `/hospitals/:id`
- **Response `200 OK`:** Single hospital object including resources array, doctors array, and active waiting time estimate.

### 2.3 Update Bed & Resource Quantities
- **Method:** `PUT`
- **Path:** `/hospitals/:hospitalId/resources/:resourceId`
- **Access:** `HOSPITAL` (matching `hospital_id`) or `ADMIN`
- **Request Body:**
  ```json
  {
    "total": 50,
    "available": 18
  }
  ```

### 2.4 Update Hospital Waiting Time
- **Method:** `PUT`
- **Path:** `/hospitals/:hospitalId/waiting-time`
- **Access:** `HOSPITAL` or `ADMIN`
- **Request Body:**
  ```json
  {
    "minutes": 25
  }
  ```

---

## 3. Emergency Admissions & Triage

### 3.1 Request Admission
- **Method:** `POST`
- **Path:** `/admissions`
- **Access:** `PATIENT` or `ADMIN`
- **Request Body:**
  ```json
  {
    "hospital_id": 1,
    "severity": "CRITICAL",
    "reason": "Acute shortness of breath and chest pressure",
    "contact_phone": "+91 98765 43210"
  }
  ```
- **Response `201 Created`:** Admission object with status `PENDING`.

### 3.2 Update Admission Status (Triage)
- **Method:** `PUT`
- **Path:** `/admissions/:id/status`
- **Access:** `HOSPITAL` or `ADMIN`
- **Request Body:**
  ```json
  {
    "status": "ACCEPTED"
  }
  ```
- *Transitions Allowed:* `PENDING -> ACCEPTED | REJECTED | CANCELLED`, `ACCEPTED -> COMPLETED`.
- *Note:* Changing to `ACCEPTED` atomically decrements available bed count. `COMPLETED` restores bed capacity.

### 3.3 Patient Cancellation
- **Method:** `PUT`
- **Path:** `/admissions/:id/cancel`
- **Access:** `PATIENT` (owning user)

---

## 4. Ambulance Dispatch & Live Tracking

### 4.1 Request Ambulance (Nearest Auto-Dispatch)
- **Method:** `POST`
- **Path:** `/ambulances/requests`
- **Access:** `PATIENT` or `ADMIN`
- **Request Body:**
  ```json
  {
    "pickup_lat": 28.6139,
    "pickup_lng": 77.2090,
    "pickup_address": "Connaught Place Block A",
    "drop_address": "AIIMS Emergency Ward",
    "drop_lat": 28.5672,
    "drop_lng": 77.2100
  }
  ```
- *Behavior:* Evaluates all `AVAILABLE` ambulances using Haversine calculation, assigns the closest vehicle, and transitions status to `REQUESTED`.

### 4.2 Update Ambulance Location Broadcast
- **Method:** `PUT`
- **Path:** `/ambulances/:id/location`
- **Access:** `AMBULANCE` operator or `ADMIN`
- **Request Body:**
  ```json
  {
    "latitude": 28.6210,
    "longitude": 77.2150
  }
  ```

### 4.3 Live Trip Tracking & ETA
- **Method:** `GET`
- **Path:** `/ambulances/requests/:id/track`
- **Access:** Owning `PATIENT`, assigned `AMBULANCE`, or `ADMIN`
- **Response `200 OK`:**
  ```json
  {
    "request_id": 1,
    "status": "EN_ROUTE",
    "distance_km": 3.42,
    "eta_minutes": 7,
    "ambulance": {
      "vehicle_no": "DL-01-AM-1001",
      "driver_name": "Surender Kumar",
      "driver_phone": "+91 98111 22334",
      "latitude": 28.6210,
      "longitude": 77.2150
    }
  }
  ```

---

## 5. Blood Bank Inventory & Reservations

### 5.1 Search Blood Units
- **Method:** `GET`
- **Path:** `/bloodbank/units`
- **Query Params:** `blood_group`, `lat`, `lng`
- **Response `200 OK`:** Array of stock units with blood group, available count, facility contact, and proximity.

### 5.2 Reserve Blood Units
- **Method:** `POST`
- **Path:** `/bloodbank/reservations`
- **Access:** `PATIENT` or `ADMIN`
- **Request Body:**
  ```json
  {
    "unit_id": 3,
    "units_requested": 2
  }
  ```

### 5.3 Approve / Fulfil Reservation
- **Method:** `PUT`
- **Path:** `/bloodbank/reservations/:id`
- **Access:** `BLOODBANK` manager or `ADMIN`
- **Request Body:**
  ```json
  {
    "status": "APPROVED"
  }
  ```
- *Inventory Safety:* Available stock is decremented atomically upon `APPROVED`. `FULFILLED` finalizes checkout without double-deduction.

---

## 6. Recommendations Engine

### 6.1 Get Ranked Recommendations
- **Method:** `GET`
- **Path:** `/recommendations`
- **Access:** Authenticated
- **Query Params:** `lat`, `lng`, `specialty`
- **Response `200 OK`:**
  ```json
  [
    {
      "hospital_id": 1,
      "name": "AIIMS New Delhi",
      "distance_km": 5.2,
      "available_beds": 42,
      "waiting_time_minutes": 25,
      "score": 0.88,
      "factors": {
        "distance_score": 0.90,
        "availability_score": 0.84,
        "waiting_score": 0.79,
        "specialty_score": 1.00
      }
    }
  ]
  ```

---

## 7. System Administration & Auditing

### 7.1 Analytics Overview
- **Method:** `GET`
- **Path:** `/admin/analytics`
- **Access:** `ADMIN`

### 7.2 Provision Staff Account
- **Method:** `POST`
- **Path:** `/admin/users`
- **Access:** `ADMIN`
- **Request Body:**
  ```json
  {
    "name": "Dr. Ramesh Sharma",
    "email": "ramesh@aiims.edu",
    "password": "temporaryPassword123",
    "role": "HOSPITAL",
    "hospital_id": 1
  }
  ```

### 7.3 Deactivate User (Soft Delete)
- **Method:** `DELETE`
- **Path:** `/admin/users/:id`
- **Access:** `ADMIN` (cannot deactivate self)

### 7.4 Audit Trail Stream
- **Method:** `GET`
- **Path:** `/admin/audit`
- **Access:** `ADMIN`
- **Query Params:** `entity`, `limit`
