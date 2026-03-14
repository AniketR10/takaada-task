# Takaada Integration Service

A robust integration service built to synchronize customer, invoice, and payment data from an external system into a local PostgreSQL database, and expose real-time financial insights.

## 🏗 Architecture & Tech Stack
* **Language:** TypeScript, Node.js
* **Database:** PostgreSQL (`pg` for raw SQL connections)
* **Infrastructure:** Docker & Docker Compose
* **External API Simulation:** `json-server` (Mocking external api endpoints)

## 🗺️ System Architecture and API Workflow

The following diagram illustrates how data flows from the external system, through our integration engine, into the database, and back out to the user via the Insights APIs.
```
      [ Reviewer / Client ]
               |
               | (1) POST /api/sync
               v
+---------------------------------------------------------+
|                Takaada Integration Service              |
|                      (Node.js / Express)                |
|                                                         |
|     +-------------------+         +----------------+    |
|     |    Sync Engine    |         |  Insights API  |    |
|     | (3)Process and Map|         |                |    |
|     +---------+---------+         +--------+-------+    |
|               |                            |            |
|  (2) Fetch    |           (4) UPSERT       | (5) Query  |
|  Paginated    |           Transactions     | Aggregates |
|  Data         |                            |            |
+---------------+----------------------------+------------+
                |                            |
                v                            v
+-------------------------------+  +--------------------------+
|      Mock External API        |  |   PostgreSQL Database    |
|       (json-server)           |  |                          |
|                               |  | Tables:                  |
| -> GET /customers?_page=1     |  | - customers              |
| -> GET /invoices?_page=1      |  | - invoices               |
| -> GET /payments?_page=1      |  | - payments               |
+-------------------------------+  +--------------------------+

```

### Workflow Breakdown:

1. **Trigger:** The user hits the `POST /api/sync` endpoint to manually start the ingestion process.
2. **Ingest (Concurrent & Paginated):** The Sync Engine uses `Promise.all` to simultaneously reach out to the Mock API's `/customers`, `/invoices`, and `/payments` endpoints. It uses a `while` loop to paginate through the data until all records are downloaded.
3. **Process & Map:** The app takes the raw json data from the external API and gets it ready to be saved into our local database.
4. **Load (Idempotent):** The Engine opens a SQL Transaction (`BEGIN`) and uses `INSERT ... ON CONFLICT DO UPDATE` to safely save the relational data into PostgreSQL without duplicating records.
5. **Analyze:** The user hits the `GET /api/insights/...` endpoints. The Insights API runs raw SQL joins and CTEs against the database to calculate balances and return formatted JSON to the user.


## 🚀 Quick Start (Local Development)

### Prerequisites
* Docker & Docker Compose
* Node.js

### 1. Start the docker
This will spin up the local PostgreSQL database and the Mock External API.
```bash
docker-compose up -d
```
It will expose the json data: `http://localhost:3000/customers`, `http://localhost:3000/invoices`, `http://localhost:3000/payments`

### 2. Install Dependencies & Start the Server
```bash
npm install
npm run dev
```
The service will start on `http://localhost:3000`.

### 3. Trigger the Integration Sync
Run this command to pull data from the mock API and safely upsert it into the local db. You will see the pagination and concurrent fetching progress in the terminal.
```bash
curl -X POST http://localhost:3000/api/sync
```

### 4. Fetch Insights
Get the outstanding balance for a specific customer:
```bash
curl http://localhost:3000/api/insights/customers/cus_001/balance
```
Get a list of all overdue invoices:
```bash
curl http://localhost:3000/api/insights/invoices/overdue
```

---

## 🧠 Design Decisions & Trade-offs

### 1. Raw SQL over ORMs
I chose to use the `pg` driver instead of a heavy ORM like Prisma. While ORMs support basic upserts, handling bulk `INSERT ... ON CONFLICT` operations for data syncing is significantly more performant in raw SQL. Additionally, calculating financial insights required Common Table Expressions (CTEs), which is easier to write in raw sql. Bypassing the ORM eliminated the need for client generation and background syncing, making the service lighter and much easier for reviewers to test.

### 2. Concurrent Pagination Handling
The sync api dynamically loops through paginated external endpoints (using `_page` and `_limit`), and fetches data from the Customer, Invoice, and Payment endpoints concurrently using `Promise.all` to significantly reduce total sync time and to prevent getting all the data in one go and crashing.

### 3. Idempotency & Transactions
The sync api guarantees idempotency via PostgreSQL `UPSERT` logic. If the sync is run multiple times, it safely updates existing records rather than throwing duplicate key errors. Also, the entire sync operation is wrapped in a SQL `BEGIN` and `COMMIT` block. If any part of the API fails mid-sync, the database completely rolls back all the changes to prevent partial, corrupted data.

### 4. Containerized Mock API
I containerized a `json-server` instance within the `docker-compose.yml` file to serve realistic mock data via mock api and easier setup.

## 🔮 Future Improvements for Production

1. **Automated Triggering:** Replace the manual `/api/sync` trigger with a cron job or a webhook listener so that whenever new data arrives it automatically syncs and updates the db.
2. **Message Queueing (RabbitMQ):** If the app needs to handle millions of records, fetching and saving them at the exact same time can cause a huge traffic jam. If the app downloads data faster than the database can save it, the server could run out of memory and crash. To fix this, I would use a tool like RabbitMQ to split the job into two parts. The main app would quickly fetch the data and place it into a waiting line (a queue). Then, a separate background worker would pull the data from that line and save it to the database at a safe, steady pace. This keeps the whole system stable even when there is a massive amount of data.
3. **Security & Authentication:** Currently, the Insights API endpoints are public. In a real-world scenario, leaving financial data open is a massive security risk. I would secure these endpoints by requiring a JWT to be sent with every request. If a request arrives without a valid key or token, the server would automatically block it to keep the customer data safe.