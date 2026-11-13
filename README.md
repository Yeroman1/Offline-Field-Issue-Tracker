<div align="center">
  <img src="client/public/logo.png" alt="NilePixel Offline Field Issue Tracker" width="360" />
  <br/>
  <h1>NilePixel Offline Field Issue Tracker</h1>
</div>

**NilePixel Technologies — Cohort 1 Individual Graduation Project**  
**Student:** [Student Full Name]  
**Repository:** Public GitHub Repository  
**Live Demo:** [Deployed Link if available]  
**Evaluation Track:** Offline-First Full-Stack Application  

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Key Capabilities & Feature Pillars](#key-capabilities--feature-pillars)
3. [Architecture & Technology Stack](#architecture--technology-stack)
4. [Offline-First & Synchronization Strategy](#offline-first--synchronization-strategy)
5. [Report Lifecycle & State Machine](#report-lifecycle--state-machine)
6. [Data Model & Database Schema](#data-model--database-schema)
7. [Getting Started (Setup & Execution)](#getting-started-setup--execution)
8. [Automated Testing Strategy & Priorities](#automated-testing-strategy--priorities)
9. [Design Decisions & Documented Assumptions](#design-decisions--documented-assumptions)
10. [Known Limitations](#known-limitations)
11. [Manual QA Verification Checklist](#manual-qa-verification-checklist)
12. [AI Tools & Development Disclosure](#ai-tools--development-disclosure)
13. [Time Spent & Future Roadmap](#time-spent--future-roadmap)

---

## 1. Project Overview

The **NilePixel Offline Field Issue Tracker** is an offline-first full-stack system engineered for field workers operating in remote regions across the Nile basin with low or nonexistent internet connectivity. Field technicians can rapidly log infrastructure failures (broken boreholes/water points, damaged culverts, solar power inverter faults, civil hazards, and maintenance requests) directly onto their device.

All entries are cryptographically stamped, stored locally in browser-persistent **IndexedDB** storage via **Dexie.js**, and queued in an atomic **Transactional Outbox**. When connectivity returns, a background **Sync Daemon** seamlessly synchronizes pending records with the server using idempotent batch requests, preventing data loss and duplicate records even across network drops, timeouts, and device restarts.

A simulated **Coordinator Mode** enables supervisors to review triage queues, verify photographic evidence, assign engineering crews, and progress report workflows through strict state machine rules.

---

## 2. Key Capabilities & Feature Pillars

* 📶 **Zero-Latency Offline Creation**: Complete report authoring (category, description, GPS coordinates, priority matrix, timestamp, local photo blobs) operates 100% offline.
* 💾 **Guaranteed Persistence**: Local records and pending queues survive page reloads, tab closures, and device restarts.
* 🔄 **Resilient Sync Engine with Outbox Queue**: Automatic connection detection (`navigator.onLine` + `/api/health` heartbeat ping) triggers background push/pull sync with exponential backoff retry.
* 🛡️ **Duplicate Prevention via Idempotency**: Every outbox item carries a client-generated UUIDv4 `idempotencyKey`. The backend caches and deduplicates replayed submissions.
* 🚦 **Audited State Machine**: Enforces strict lifecycle transitions (`Draft` → `Submitted` → `Assigned` → `In Progress` → `Resolved`, plus `Rejected` and reopen flows).
* 📜 **Full Activity Audit Trail**: Tracks creation, offline cache events, sync transmissions, status changes, and reassignment history.
* 🎭 **Role Simulation**: Instant toggle between **Field Worker (Sarah J.)** and **Coordinator (Ahmed K.)** without authentication overhead.
* 🧪 **Comprehensive Automated Testing**: 50+ unit and integration tests across backend and frontend covering state machines, idempotency, batch sync, and validation.

---

## 3. Architecture & Technology Stack

```
┌────────────────────────────────────────────────────────┐
│                   Frontend Client                      │
│        React 18 + TypeScript + Vite + Tailwind CSS     │
│                                                        │
│  ┌─────────────────┐ ┌────────────────┐ ┌────────────┐ │
│  │ Dashboard View  │ │  Create Report │ │ All Reports│ │
│  └────────┬────────┘ └───────┬────────┘ └─────┬──────┘ │
│           │                  │                │        │
│  ┌────────▼──────────────────▼────────────────▼──────┐ │
│  │               Dexie.js (IndexedDB)                │ │
│  │   • reports (local cache)                         │ │
│  │   • outbox (transactional queue)                  │ │
│  │   • activityLog (local audit trail)               │ │
│  └───────────────────────────┬───────────────────────┘ │
│                              │                         │
│  ┌───────────────────────────▼───────────────────────┐ │
│  │            Background Sync Engine                 │ │
│  │   • Heartbeat network detector                    │ │
│  │   • Batch outbox dispatcher (POST /api/sync)      │ │
│  │   • Delta fetcher (GET /api/reports?since=...)    │ │
│  └───────────────────────────┬───────────────────────┘ │
└──────────────────────────────┼─────────────────────────┘
                               │ HTTP / JSON
                               ▼
┌────────────────────────────────────────────────────────┐
│                   Backend Server                       │
│        Node.js + Express + TypeScript + Prisma ORM     │
│                                                        │
│  ┌───────────────────────────────────────────────────┐ │
│  │ REST Endpoints: /api/reports, /api/sync, /stats   │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ Idempotency Layer & Optimistic Version Checks     │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ SQLite (Local Zero-Config) / PostgreSQL (Prod)    │ │
│  └───────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Stack Components
* **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Dexie.js (IndexedDB wrapper), Lucide Icons / Material Symbols.
* **Backend**: Node.js, Express, TypeScript, Prisma ORM, Zod, UUID.
* **Storage**: SQLite (`file:./dev.db`) by default for zero-configuration testing; fully compatible with PostgreSQL via Prisma `DATABASE_URL`.
* **Testing**: Vitest, Supertest.

---

## 4. Offline-First & Synchronization Strategy

### The Transactional Outbox Pattern
1. When a user submits an issue offline:
   - A `Report` record is written to IndexedDB with `syncStatus: "pending"`.
   - An `Outbox` intent entry is committed in the same local transaction with an `idempotencyKey` (UUIDv4).
2. The UI immediately updates with optimistic feedback ("Saved to device storage").
3. The **Sync Engine** periodically evaluates connectivity:
   - Evaluates `navigator.onLine` AND executes a heartbeat check against `GET /api/health`.
   - Once online, pulls un-synced outbox items in sequential batches (max 10 items/batch).
   - Sends payload to `POST /api/sync`.
4. On server confirmation:
   - Local report `syncStatus` flips to `"synced"`.
   - Server-assigned sequential number (e.g. `#NP-8821`) is recorded locally.
   - Outbox item is safely pruned.
   - An `activityLog` event is recorded.

### Duplicate Prevention & Network Drops
* **Problem**: A field technician submits a report, the server processes it, but the cellular tower drops before the HTTP 200 response reaches the phone.
* **Solution**: The client's next retry sends the *identical* `idempotencyKey`. The backend's `IdempotencyRecord` table intercepts the request, notes that it was previously processed, and returns the cached success payload without inserting a duplicate report.

---

## 5. Report Lifecycle & State Machine

```
              ┌─────────┐
              │  Draft  │
              └────┬────┘
                   │ submit
                   ▼
              ┌─────────┐       reject
              │Submitted├──────────────────┐
              └────┬────┘                  │
                   │ assign                │
                   ▼                       ▼
              ┌─────────┐       reject   ┌──────────┐
              │Assigned ├───────────────►│ Rejected │
              └────┬────┘                └────┬─────┘
                   │ start work               │ resubmit
                   ▼                          │
            ┌─────────────┐                   │
     reopen │ In Progress │◄──────────────────┘
   ┌────────┤             ├────────┐
   │        └─────────────┘        │
   │               ▲               │ resolve
   │               │ reassign      │
   │               └───────────────┘
   │                               │
   │                               ▼
   │                         ┌──────────┐
   └─────────────────────────┤ Resolved │
                             └──────────┘
```

### Valid Transition Matrix
| Source Status | Allowed Target Statuses | Actor Required |
|:---|:---|:---|
| `draft` | `submitted` | Field Worker |
| `submitted` | `assigned`, `rejected` | Coordinator |
| `assigned` | `in_progress`, `rejected` | Coordinator |
| `in_progress` | `resolved`, `assigned` | Coordinator |
| `rejected` | `submitted` (resubmission) | Field Worker |
| `resolved` | `in_progress` (reopen) | Coordinator |

Any attempt to execute an invalid transition (e.g., `draft → resolved` or `submitted → in_progress`) is rejected by the server with HTTP **422 Unprocessable Entity**.

---

## 6. Data Model & Database Schema

### Report Entity
* `id` (String UUIDv4, Primary Key)
* `reportNumber` (String, Unique, e.g. `NP-8820`)
* `title` (String, summary)
* `description` (Text, detailed observations)
* `category` (`broken_water` | `damaged_equipment` | `service_interruption` | `safety_concern` | `maintenance_required`)
* `priority` (`low` | `medium` | `high` | `critical`)
* `status` (`draft` | `submitted` | `assigned` | `in_progress` | `resolved` | `rejected`)
* `syncStatus` (`pending` | `synced` | `failed`)
* `latitude`, `longitude`, `locationName`, `locationAccuracy`
* `reporterName`, `reporterId`
* `assignedTo`, `assignedTeam`
* `resolutionNotes`, `resolvedBy`, `resolvedAt`
* `version` (Integer, optimistic concurrency counter)
* `createdAt`, `updatedAt` (Timestamps)

### ActivityLog Entity
* `id` (String UUIDv4)
* `reportId` (Foreign Key to Report)
* `action` (`created` | `submitted` | `synced` | `status_changed` | `assigned` | `resolved` | `rejected` | `conflict_resolved`)
* `actorName`, `description`, `previousValue`, `newValue`, `createdAt`

### IdempotencyRecord Entity
* `key` (String, Primary Key)
* `response` (Text JSON)
* `createdAt` (Timestamp)

---

## 7. Getting Started (Setup & Execution)

### Prerequisites
* **Node.js** v18+ or v20+
* **npm** v9+

### 1. Clone & Install
```bash
git clone https://github.com/your-username/nilepixel-offline-field-tracker.git
cd nilepixel-offline-field-tracker

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Setup Database & Seed Initial Data
```bash
cd ../server

# Push Prisma schema to SQLite
npm run db:push

# Seed with Nile region demonstration telemetry (#NP-8818 through #NP-8825)
npm run db:seed
```

### 3. Run Development Servers
Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
cd server
npm run dev
# Starts server on http://localhost:3001
```

**Terminal 2 (Frontend Client):**
```bash
cd client
npm run dev
# Starts Vite PWA on http://localhost:5173
```

---

## 8. Automated Testing Strategy & Priorities

Testing is prioritized by **risk of data loss and workflow corruption**:

| Priority | Area | Risk Addressed | Test Suite |
|:---|:---|:---|:---|
| **P0 (Critical)** | **Status Transitions** | Invalid workflow bypassing triage rules | `server/src/__tests__/statusMachine.test.ts` (30 tests) |
| **P0 (Critical)** | **Idempotent Sync** | Duplicate reports on network drops/retries | `server/src/__tests__/sync.test.ts` (5 tests) |
| **P0 (Critical)** | **Report CRUD & Concurrency** | Version mismatch overwriting coordinator changes | `server/src/__tests__/reports.test.ts` (15 tests) |
| **P1 (High)** | **Client Sync Engine** | Offline queue flushing and error backoff | `client/src/__tests__/syncEngine.test.ts` |
| **P1 (High)** | **Input Validation** | Malformed coordinates or payloads | `client/src/__tests__/validation.test.ts` |

### Running Tests
```bash
# Run server test suite (50 tests)
cd server
npm test

# Run client test suite
cd ../client
npm test

# Run all tests from root
npm test
```

---

## 9. Design Decisions & Documented Assumptions

1. **Client-Generated UUIDs**: Because field workers author reports completely offline, primary keys cannot depend on database auto-increment counters. UUIDv4 guarantees global collision resistance.
2. **Sequential Human IDs (`NP-XXXX`)**: Generated server-side upon first successful sync. The client temporarily displays a local ID badge until sync completes.
3. **Optimistic Concurrency Control**: Every report has a `version` number. If a coordinator attempts to transition a report whose underlying version has changed, the server returns HTTP 409 Conflict to prevent race conditions.
4. **SQLite Zero-Config Default**: Chosen so graders and reviewers can clone and run `npm start` immediately without spinning up a local PostgreSQL container or remote credentials. Switching to PostgreSQL requires only editing the `provider = "postgresql"` line in `prisma/schema.prisma`.
5. **Role Simulation**: Simulated through an in-app toggle (`Field Worker: Sarah J.` vs `Coordinator: Ahmed K.`), satisfying the brief's non-mandatory authentication requirement while retaining full audit integrity in `activityLog`.

---

## 10. Known Limitations

* **Browser Storage Reset**: If a user manually clears browser site data/cookies while offline with un-synced reports, IndexedDB entries will be lost. (Mitigated by proactive UI warning badges when pending items exist).
* **Large Media Handling**: Photos are currently stored as compressed base64 local blobs in IndexedDB. For high-volume production, an Object Storage service (S3/Cloud Storage) with chunked background upload would be preferred.
* **Map Tile Caching**: The interactive map uses Leaflet/OpenStreetMap. Offline map viewing requires pre-cached vector tiles for true air-gapped wilderness navigation.

---

## 11. Manual QA Verification Checklist

Reviewers can verify offline functionality step-by-step:
- [ ] **Step 1**: Open the app at `http://localhost:5173`. Confirm initial dashboard metrics load.
- [ ] **Step 2**: Open browser DevTools → Network tab → Select **"Offline"** (or use the in-app offline toggle in Settings).
- [ ] **Step 3**: Notice the header pill immediately flips to `Offline Mode Active`.
- [ ] **Step 4**: Click **"+ Create"** → Enter a new issue (e.g. "Broken Submersible Pump", Priority: Critical, Category: Water Point).
- [ ] **Step 5**: Click **"Submit Report (Store & Queue Sync)"**.
- [ ] **Step 6**: Confirm report appears with badge `Pending Sync` and local queue increments.
- [ ] **Step 7**: Refresh the browser page while still offline. Confirm the report persists seamlessly.
- [ ] **Step 8**: Disable DevTools "Offline" mode.
- [ ] **Step 9**: Click **"Sync Now"** (or wait for auto-sync). Confirm badge turns to green `Synced` with server-assigned `#NP-XXXX`.
- [ ] **Step 10**: Switch to **Coordinator Mode** in Settings → Transition the report to `Assigned` → Confirm state updates and activity log logs the transition.

---

## 12. AI Tools & Development Disclosure

* **Tools Used**: Antigravity AI Assistant, Claude 3.7 / Gemini 3.8 models, Google Stitch MCP (UI design blueprint).
* **Usage**:
  - Extracted UI tokens and design layouts from Google Stitch project `projects/389610036849999050` ("NilePixel Offline Field Tracker").
  - Formulated the formal 15-section technical specification artifact.
  - Accelerated boilerplate scaffolding for Express/Prisma types and Vite configuration.
* **Verification**: All generated schemas, status machine logic, and endpoints were verified through 50+ automated unit/integration tests running against actual database instances.

---

## 13. Time Spent & Future Roadmap

* **Approximate Time Spent**: ~14 hours (Requirement analysis, architecture spec, UI design extraction, full-stack implementation, automated test suites, QA documentation).
* **Future Roadmap (With More Time)**:
  - Vector tile offline caching for wilderness satellite maps (MapLibre GL / MBTiles).
  - Web Push Notifications when assigned work orders are dispatched to field crews.
  - End-to-end encryption for sensitive infrastructure vulnerability telemetry.
  - Exportable PDF engineering inspection audit reports.

