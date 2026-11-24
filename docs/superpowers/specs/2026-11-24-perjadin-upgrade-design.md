# Design Specification: Perjadin Super-App Upgrade & Dedicated Admin Terminal

**Date:** 2026-11-24  
**Author:** AI Principal Architect  
**Status:** Draft for Approval  

---

## 1. Intent & Context
The initial travel ledger prototype was too barebones. The user requested higher architectural complexity, a dedicated multi-page Admin terminal (user directory with role assignment and master data management), an analytical overview, and an enterprise-grade mobile super-app interface.

---

## 2. Goals & Non-Goals

### Goals
1. **Backend Expansion**:
   - `GET /api/admin/users`: List all registered users (ID, name, email, avatar, role, trip count, joined date).
   - `PUT /api/admin/users/{id}/role`: Toggle/update user role (`admin` <-> `user`) with safety checks (cannot demote the last remaining admin or demote oneself).
   - `GET /api/admin/stats`: Aggregate system metrics (total registered users, total trips created, cumulative budget, total expenses recorded).
   - `GET /api/analytics`: Aggregated user-level financial analytics (monthly expenditure curve, category breakdown, cashflow breakdown by payment method).

2. **Frontend Navigation & Architecture (Option A: Mobile Super-App)**:
   - **Persistent Bottom Dock Navigation Bar**:
     - 🛫 **Perjalanan** (`/`): Travel feed, balance overview, search & filter chips.
     - 📊 **Analitik** (`/analytics`): Category spending distribution, monthly comparisons, payment method usage.
     - ⚙️ **Admin Terminal** (`/admin`): System overview, quick action hub (visible only to admin users).
   - **Dedicated Sub-Routed Admin Hub**:
     - `/admin`: High-level system overview, quick stat cards, portal navigation.
     - `/admin/users`: User Directory with avatar, role badges, role toggle modal/switch, search user.
     - `/admin/master`: Segmented tabs for Category and Payment Method CRUD with usage counters.
   - **Rich Feed Interactions**:
     - Search input (query by destination or trip title).
     - Filter chips: All, Berlangsung, Urus Berkas, Selesai.
     - Category spending progress bars in trip card.
   - **Design Language**:
     - Obsidian & Titanium terminal style with `Plus Jakarta Sans` and `JetBrains Mono`.
     - Tactile feedback, glowing beacons, double-bezel cards, and bottom sheets.

### Non-Goals
- Multi-tenant enterprise organizations (remains single deployment instance).
- AI receipt OCR scanning (manual entry with 1-tap rapid chips is preferred for speed and simplicity).

---

## 3. Approaches Considered

- **Approach 1: Single-Page Admin Accordion**:
  Put user list, categories, and payment methods in one expandable page.  
  *Rejected*: Cluttered on mobile, contradicts user's explicit request for separate pages.

- **Approach 2: Desktop Sidebar Layout**:
  Sidebar on left that turns into a hamburger menu on mobile.  
  *Rejected*: Compromises the thumb-zone ergonomics for mobile-first users.

- **Approach 3: Mobile Super-App with Dedicated Sub-routes (Chosen)**:
  Persistent thumb-friendly bottom dock navigation bar (`/`, `/analytics`, `/admin`). Admin area has dedicated pages (`/admin`, `/admin/users`, `/admin/master`). Matches native iOS/Android financial apps.

---

## 4. API & Database Specifications

### 4.1 Backend Endpoints
1. `GET /api/admin/users`:
   ```sql
   SELECT u.id, u.email, u.name, u.avatar_url, u.role, u.created_at,
          COUNT(t.id) AS total_trips
   FROM users u
   LEFT JOIN trips t ON t.user_id = u.id
   GROUP BY u.id
   ORDER BY u.created_at ASC;
   ```
2. `PUT /api/admin/users/{id}/role`:
   - Request: `{"role": "admin" | "user"}`
   - Validation: Ensure at least one admin exists; user cannot demote self if only 1 admin remains.
3. `GET /api/admin/stats`:
   - Returns: `{ "total_users": X, "total_trips": Y, "total_expenses_rp": Z, "total_uang_dinas_rp": W }`
4. `GET /api/analytics`:
   - Returns category distribution for the current user and payment method breakdown.

---

## 5. Frontend View Architecture

```
/
├── / (Dashboard Feed: Metrics, Search & Status Chips, Boarding Pass Cards)
├── /trips/new (Create Trip Form)
├── /trips/:id (Trip Detail & Expense Management)
├── /trips/:id/edit (Edit Trip)
├── /analytics (Visual Charts & Spending Breakdown)
├── /admin (Admin Hub & System Metrics)
│   ├── /admin/users (User Directory & Role Assignment)
│   └── /admin/master (Categories & Payment Methods Management)
└── /login (Google Sign-In)
```

---

## 6. Verification Plan
1. Backend unit and integration tests for `/api/admin/users`, `/api/admin/users/{id}/role`, `/api/admin/stats`, and `/api/analytics`.
2. Frontend TypeScript typecheck (`npx tsc --noEmit`) and bundle build (`npm run build`).
3. End-to-end verification of route transitions and permission guards.
