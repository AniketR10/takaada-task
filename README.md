# Takaada Integration Service

A robust integration service built to synchronize customer, invoice, and payment data from an external system into a local PostgreSQL database, and expose real-time financial insights.

## 🏗 Architecture & Tech Stack
* **Language:** TypeScript / Node.js
* **Database:** PostgreSQL (using `pg` for raw SQL connections)
* **Infrastructure:** Docker & Docker Compose
* **External API Simulation:** `json-server` (Mocking external endpoints)

## 🚀 Quick Start (Local Development)

### Prerequisites
* Docker & Docker Compose
* Node.js

### 1. Start the Infrastructure
This will spin up the local PostgreSQL database and the Mock External API.
```bash
docker-compose up -d
```

### 2. Install Dependencies & Start the Server
```bash
npm install
npm run dev
```
The service will start on `http://localhost:3000`.

### 3. Trigger the Integration Sync
Run this command to pull data from the mock API and upsert it into the local database:
```bash
curl -X POST http://localhost:3000/api/sync
```

### 4. Fetch Insights
Get outstanding balance for a customer:
```bash
curl http://localhost:3000/api/insights/customers/cus_001/balance
```
Get all overdue invoices:
```bash
curl http://localhost:3000/api/insights/invoices/overdue
```

---

## 🧠 Design Decisions & Trade-offs

### 1. Raw SQL over ORMs
I chose to use raw SQL with the `pg` pool instead of an ORM like Prisma or TypeORM. This allowed for precise control over complex queries (like using CTEs to avoid SQL fan-out when calculating balances) and highly optimized `INSERT ... ON CONFLICT` statements for idempotency.

### 2. Idempotency & Transactions
The sync engine uses PostgreSQL `UPSERT` logic. This ensures that if the sync is run multiple times, it will update existing records rather than throwing duplicate key errors or creating duplicate financial data. Furthermore, the entire sync operation is wrapped in a SQL `BEGIN` and `COMMIT` block. If the API fails mid-sync, the database rolls back to prevent partial, corrupted data.

### 3. Mock API
I made a mock live external API, I containerized a `json-server` instance within the `docker-compose.yml` file to serve realistic mock data (like partial payments and overdue dates).

## Future Improvements for Production
If this were moving to a production environment, I would add:
1. **Automated Triggering:** Replace the manual `/api/sync` trigger with a CRON job or a webhook listener.
2. **Cursor Pagination:** Enhance the API client to handle `next_cursor` tokens for external APIs that return large paginated datasets.