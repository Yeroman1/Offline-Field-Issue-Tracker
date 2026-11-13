# NilePixel Offline Field Issue Tracker — Backend REST API (Phase 2)

**NilePixel Technologies — Cohort 1 Individual Graduation Project**  
**Phase:** 2 — Backend REST API Implementation  
**Technology Stack:** Node.js, Express.js, TypeScript, PostgreSQL (designed for Supabase PostgreSQL), Prisma ORM, Vitest, Supertest, Zod.

---

## 1. Architectural Overview

The NilePixel Backend REST API is built on a clean layered architecture with strict separation of concerns, strict TypeScript types, and comprehensive defensive mechanisms against data corruption, duplicate network submissions, and race conditions.

```text
server/
├── prisma/
│   └── schema.prisma              # Relational models & database constraints
├── src/
│   ├── config/
│   │   ├── env.ts                 # Validated environment configuration
│   │   └── database.ts            # Singleton Prisma client & health verification
│   ├── controllers/
│   │   ├── health.controller.ts   # System diagnostics & DB ping
│   │   ├── report.controller.ts   # HTTP request parsing & response serialization
│   │   └── sync.controller.ts     # Sync ack, failure telemetry, & batch processing
│   ├── middleware/
│   │   ├── auth.middleware.ts     # Simulated actor identification & role guards
│   │   ├── errorHandler.middleware.ts # Centralized error sanitization & status codes
│   │   ├── rateLimiter.middleware.ts  # Express rate limiting for sensitive endpoints
│   │   └── validate.middleware.ts # Generic Zod schema request validator
│   ├── routes/
│   │   ├── health.routes.ts       # Health endpoint definition
│   │   ├── report.routes.ts       # Core report CRUD, status & sync endpoints
│   │   ├── sync.routes.ts         # Batch offline sync router
│   │   ├── stats.routes.ts        # Telemetry aggregation router
│   │   ├── activity.routes.ts     # Audit log listing router
│   │   └── index.ts               # Aggregated API route mounting
│   ├── services/
│   │   ├── report.service.ts      # Core business logic, idempotency & transactions
│   │   ├── statusMachine.service.ts # Finite state machine & allowed transitions
│   │   └── sync.service.ts        # Sync acknowledgment, retry tracking & batch engine
│   ├── types/
│   │   └── index.ts               # Domain enums, DTOs, & API response contracts
│   ├── utils/
│   │   ├── errors.util.ts         # Domain exception hierarchy (AppError, ConflictError, etc.)
│   │   ├── hash.util.ts           # Recursive payload key-sorting & SHA-256 hashing
│   │   └── response.util.ts       # Unified JSON response builders
│   ├── validators/
│   │   └── report.validator.ts    # Strict Zod validation schemas
│   ├── app.ts                     # Express application configuration & pipeline
│   └── server.ts                  # Server initialization, seeding & graceful shutdown
├── src/__tests__/
│   ├── health.test.ts             # Health check tests
│   ├── reports.test.ts            # Report CRUD, validation, idempotency, pagination tests
│   ├── statusMachine.test.ts      # Unit tests for state machine transition matrix
│   ├── statusTransition.test.ts   # Concurrency, state machine & audit log tests
│   ├── sync.test.ts               # Sync ack, failure retry tracking & batch sync tests
│   └── security.test.ts           # Actor context, role guards & body-injection tests
├── .env.example                   # Environment variable template
├── package.json
└── tsconfig.json
```

---

## 2. API Endpoints Specification

### A. Health Check
* **Endpoint:** `GET /api/health`
* **Purpose:** Heartbeat probe for offline clients and monitoring.
* **Response (HTTP 200 / 503):**
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-11-12T11:45:00.000Z",
  "uptime": 124.5,
  "service": "nilepixel-offline-field-tracker-server",
  "version": "1.0.0",
  "environment": "development"
}
```

### B. Report Creation and Submission
* **Endpoint:** `POST /api/reports`
* **Headers:** `Content-Type: application/json`
* **Body:**
```json
{
  "clientReportId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "title": "Broken Water Point Handpump - Borehole 4",
  "category": "BROKEN_WATER",
  "description": "Mechanical linkage fractured at fulcrum pin; 650 households affected.",
  "location": {
    "latitude": 4.85124,
    "longitude": 31.58241,
    "locationName": "Sector 4 Borehole",
    "locationAccuracy": 3.8
  },
  "priority": "CRITICAL",
  "reportedAt": "2026-11-12T10:00:00.000Z",
  "reporterId": "00000000-0000-0000-0000-000000000089",
  "reporterName": "Sarah J.",
  "sourceDeviceId": "device-android-field-01",
  "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-sub-1"
}
```
* **Response (HTTP 201 Created):**
```json
{
  "success": true,
  "message": "Report created and synchronized successfully",
  "data": {
    "id": "e6f499b2-3e2c-4933-bbdc-c6bf2e2b926f",
    "clientReportId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "reportNumber": "NP-8822",
    "title": "Broken Water Point Handpump - Borehole 4",
    "status": "SUBMITTED",
    "version": 1,
    "syncMetadata": {
      "syncStatus": "SYNCED",
      "attemptCount": 1,
      "acknowledgedAt": "2026-11-12T10:00:05.120Z"
    },
    "statusTransitions": [ ... ],
    "activityLogs": [ ... ]
  }
}
```
* **Idempotency Guarantees:**
  - Same `idempotencyKey` + same payload: Returns original response (`HTTP 200/201`).
  - Same `idempotencyKey` + modified payload: Returns `HTTP 409 Conflict` (`IDEMPOTENCY_CONFLICT`).
  - Duplicate `clientReportId`: Returns `HTTP 409 Conflict` (`DUPLICATE_CLIENT_REPORT_ID`).

### C. Get Reports (List, Filter, Search, Pagination)
* **Endpoint:** `GET /api/reports`
* **Query Parameters:**
  - `page`: Page index (default: `1`)
  - `limit`: Records per page (default: `20`, max: `100`)
  - `search`: Case-insensitive substring match across `title`, `description`, `reportNumber`
  - `status`: Single (`SUBMITTED`) or comma-separated (`SUBMITTED,ASSIGNED`)
  - `syncStatus`: Filter by sync status (`SYNCED`, `PENDING`, `FAILED`)
  - `category`: Filter by domain category
  - `priority`: Filter by priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `reporter`: Filter by `reporterId`
  - `assignee`: Filter by `assignedTo`
  - `sortBy`: `createdAt` | `reportedAt` | `priority` | `status` (default: `createdAt`)
  - `sortOrder`: `asc` | `desc` (default: `desc`)
* **Response (HTTP 200):**
```json
{
  "success": true,
  "message": "Reports retrieved successfully",
  "reports": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### D. Get Single Report
* **Endpoint:** `GET /api/reports/:id`
* **Accepts:** UUID `id`, `reportNumber` (e.g. `NP-8821`), or `clientReportId`.
* **Response (HTTP 200):** Full report entity, including `syncMetadata`, `statusTransitions`, and `activityLogs`.
* **Error (HTTP 404):** `NOT_FOUND` if report identifier does not match any record.

### E. Update Report (Permitted Fields)
* **Endpoint:** `PATCH /api/reports/:id`
* **Body:**
```json
{
  "title": "Updated Title Description",
  "priority": "HIGH",
  "expectedVersion": 1
}
```
* **Rules:**
  - Protected fields (`id`, `clientReportId`, `reporterId`, `status`, `version`, `syncStatus`) are strictly rejected.
  - Requires `expectedVersion`.
  - Stale versions rejected with `HTTP 409 Conflict` (`VERSION_CONFLICT`).
  - Increments `version` by 1 upon success and logs `REPORT_UPDATED` activity.

### F. Status Transition
* **Endpoint:** `PATCH /api/reports/:id/status`
* **Body:**
```json
{
  "status": "ASSIGNED",
  "expectedVersion": 1,
  "assignedTo": "Kariuki M.",
  "assignedTeam": "Civil Works Team B",
  "note": "Dispatched response crew"
}
```
* **State Machine Rules:**
  - `DRAFT` → `SUBMITTED`
  - `SUBMITTED` → `ASSIGNED` | `REJECTED`
  - `ASSIGNED` → `IN_PROGRESS` | `REJECTED`
  - `IN_PROGRESS` → `RESOLVED` | `ASSIGNED`
  - `REJECTED` → `SUBMITTED` (Re-submission)
  - `RESOLVED` → `IN_PROGRESS` (Re-opening)
* **Error Codes:**
  - Invalid state jump: `HTTP 422 Unprocessable Entity` (`INVALID_STATUS_TRANSITION`)
  - Stale version: `HTTP 409 Conflict` (`VERSION_CONFLICT`)

### G. Sync Acknowledgment
* **Endpoint:** `POST /api/reports/:id/sync/acknowledge`
* **Purpose:** Acknowledges successful sync receipt by client or coordinator.
* **Rules:**
  - Sets `syncStatus = 'SYNCED'` and `acknowledgedAt = now()`.
  - Preserves business `status`.
  - Idempotent and safe to retry.
  - Logs `SYNC_ACKNOWLEDGED` in `ActivityLog`.

### H. Sync Failure
* **Endpoint:** `POST /api/reports/:id/sync/failure`
* **Body:**
```json
{
  "errorMessage": "Network connection dropped during payload transfer"
}
```
* **Rules:**
  - Sets `syncStatus = 'FAILED'`.
  - Increments `attemptCount`.
  - Records `lastAttemptAt` and sanitized error message.
  - Logs `SYNC_FAILED` in `ActivityLog`.

---

## 3. Data Integrity & Concurrency Strategies

### Idempotency & Deduplication
1. Incoming request body is recursively key-sorted and hashed using SHA-256 (`computePayloadHash`).
2. If `idempotencyKey` exists:
   - Same hash: Returns cached response (`cached: true`).
   - Different hash: Rejects with `HTTP 409 IDEMPOTENCY_CONFLICT`.
3. If `clientReportId` already exists, rejects with `HTTP 409 DUPLICATE_CLIENT_REPORT_ID`.
4. Stored in atomic Prisma transaction alongside report creation.

### Optimistic Concurrency Control
- Every report record contains an integer `version` initialized at `1`.
- Any mutation (`PATCH /api/reports/:id` or `PATCH /api/reports/:id/status`) requires `expectedVersion`.
- If `expectedVersion !== report.version`, transaction is aborted and `HTTP 409 VERSION_CONFLICT` is returned.
- Upon successful update, `version` is incremented by `1`.

---

## 4. Security & Authentication Boundary

* **Actor Identification Context (`identifyActor`):**
  - Inspects incoming headers: `x-actor-id`, `x-actor-role`, `x-actor-name`, `x-device-id`.
  - Attaches `req.actor` context marked with `isSimulated: true`.
  - **Zero Trust on Request Body:** Request body fields like `role` or `isAdmin` are strictly ignored and forbidden from determining authorization.
  - **Future Integration:** Prepared interface ready to swap with Supabase Auth JWT verification (`supabase.auth.getUser()`) in Phase 3.

---

## 5. Database Configuration (SQLite vs Supabase PostgreSQL)

The Prisma schema is engineered to be 100% portable between local SQLite and hosted Supabase PostgreSQL.

### Switching to Supabase PostgreSQL:
1. In `server/prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```
2. In `server/.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require"
   DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require"
   ```
3. Run migrations:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

---

## 6. Running Tests & Verification

The test suite runs with Vitest and Supertest across 6 test suites covering 65 test assertions:

```bash
# Run all tests
npm test

# Run type check
npx tsc --noEmit

# Build production bundle
npm run build
```

All 65 tests pass:
- `statusMachine.test.ts` (30 tests)
- `reports.test.ts` (19 tests)
- `statusTransition.test.ts` (6 tests)
- `sync.test.ts` (6 tests)
- `security.test.ts` (3 tests)
- `health.test.ts` (1 test)

