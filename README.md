# StockPilot AI

An inventory management tool for small businesses, built as a mini SaaS product. Track products and stock, keep a full history of every change, and use built-in AI to forecast which items will run out and how much to reorder.

**Stack:** React 18 (Vite) · Node.js + Express · MongoDB (Mongoose) · JWT auth · optional Claude API

## Features

| Area | What you get |
|---|---|
| Authentication | Register / sign in with JWT. First account becomes **admin**, later accounts are **staff**. Only admins can delete products. |
| Products | Create, edit, delete. Search, filter by category and stock status, sort, paginate. SKU uniqueness enforced. |
| Stock workflow | Receive stock, remove stock, or set a counted quantity. Removing more than is in stock is rejected atomically (no negative stock, even with simultaneous requests). |
| Stock history | Append-only ledger of every change: who, when, how much, balance after. |
| Dashboard | Totals, stock value, low/out-of-stock counts, 14-day movement chart, value by category, items needing attention, recent activity. |
| **AI: reorder forecast** | Weighted moving average of 30 days of sales gives sales per day, days of stock left, demand trend, risk level and a suggested order quantity with estimated cost. |
| **AI: inventory assistant** | Ask questions in plain English ("What should I reorder this week?"). Uses Claude when an API key is set, otherwise a built-in rule-based engine. |
| **AI: description writer** | One click writes a product description and suggests a category. |

The app works fully **without any API key**. Add `ANTHROPIC_API_KEY` to switch the assistant and description writer to Claude (falls back automatically if the API is unreachable).

## Architecture

```
React (Vite)  --/api-->  Express  -->  Services  -->  MongoDB
 pages, context          routes        inventory (atomic stock updates)
 axios + JWT             zod validation forecast  (pure, unit-tested)
                         auth + roles   assistant / llm (Anthropic Messages API)
```

```
server/src
  config/        environment settings
  models/        User, Product, StockMovement
  middleware/    auth (JWT + roles), validate (zod), error handling
  routes/        auth, products, movements, dashboard, ai
  services/      inventory, forecast, assistant, llm
  seed.js        demo users, 24 products, 30 days of history
server/test      unit tests for the forecast engine
client/src
  pages/         Login, Dashboard, Products, Movements, Insights
  components/    Layout, shared UI (Modal, badges, pagination)
  context/       Auth and toast state
```

## Run it locally

You need Node.js 18+ and MongoDB (local, Docker, or a free MongoDB Atlas cluster).

1. **Extract the project outside OneDrive**, for example `C:\dev\stockpilot-ai`.
   OneDrive syncs thousands of small files in `node_modules` and can lock them, which makes `npm install` fail.

2. **Start MongoDB.** Easiest with Docker:
   ```
   docker compose up -d
   ```
   No Docker? Install MongoDB Community Server, or create an Atlas cluster and use its connection string in step 4.

3. **Install dependencies** (from the project root):
   ```
   npm run install:all
   ```

4. **Create the server settings file:**
   - Windows (Command Prompt): `copy server\.env.example server\.env`
   - macOS / Linux / Git Bash: `cp server/.env.example server/.env`

   `MONGODB_URI` defaults to `mongodb://127.0.0.1:27017/stockpilot`. Change `JWT_SECRET` to any long random string.

5. **Load demo data** (resets products and history, keeps users):
   ```
   npm run seed
   ```

6. **Start the API** (terminal 1):
   ```
   npm run dev:server
   ```
   You should see `MongoDB connected` and `API running on http://localhost:5000`.

7. **Start the web app** (terminal 2):
   ```
   npm run dev:client
   ```
   Open http://localhost:5173

**Demo logins:** `admin@demo.com` / `Admin@123` (admin) and `staff@demo.com` / `Staff@123` (staff). The sign-in page has a button that fills in the admin login.

**Run the tests:** `npm test` (forecast engine and seed data checks).

## API reference

All routes except `/api/auth/*` and `/api/health` need `Authorization: Bearer <token>`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account, returns token |
| POST | `/api/auth/login` | Sign in, returns token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/products` | List. Query: `search, category, status (in/low/out), sort, page, limit` |
| GET | `/api/products/categories` | Distinct categories |
| POST | `/api/products` | Create product |
| GET / PUT | `/api/products/:id` | Read / update details |
| DELETE | `/api/products/:id` | Delete (admin only) |
| POST | `/api/products/:id/stock` | Body `{type: in/out/adjust, quantity, note}` |
| GET | `/api/movements` | Stock history. Query: `product, type, page, limit` |
| GET | `/api/dashboard/summary` | Totals, category breakdown, 14-day trend, alerts |
| GET | `/api/ai/insights` | Forecast for every product |
| GET | `/api/ai/status` | Whether Claude is enabled |
| POST | `/api/ai/assistant` | Body `{question}` |
| POST | `/api/ai/describe` | Body `{name, category?}` |

Errors are always JSON: `{ "message": "...", "details": [{ "field", "message" }] }` with correct status codes (400 validation, 401 auth, 403 role, 404, 409 duplicate SKU).

## How the AI forecast works

- **Demand** = last 15 days of sales per day x 60% + the 15 days before x 40% (a weighted moving average, so recent trends count more).
- **Days left** = stock / demand.
- **Risk:** critical (out of stock or under 3 days), high (runs out before a 7-day delivery arrives), watch (under 10 days or below reorder level), healthy.
- **Suggested order** = demand x (7 day lead time + 14 days of cover) + 3 days safety stock - current stock. Items with no sales are topped up to twice their reorder level.
- **Trend:** compares the two 15-day windows (rising above 1.25x, falling below 0.75x).

The assumptions are constants at the top of `server/src/services/forecast.js`. The assistant sends only a compact JSON snapshot of the inventory to the model and tells it to answer from that data alone.

## Scalability thinking

- **Stateless API** (JWT, no server sessions): run any number of instances behind a load balancer.
- **Indexes** on category, quantity, createdAt, and `(product, createdAt)` / `(type, createdAt)` on the ledger.
- **Server-side pagination, filtering and sorting**; the UI never loads the full catalogue.
- **Aggregation pipelines** for dashboard and forecast so MongoDB does the heavy lifting.
- **Atomic stock updates** with conditional `findOneAndUpdate` instead of read-modify-write.
- **Append-only ledger** gives an audit trail and a clean base for forecasting, reports or event streaming later.
- **Rate limiting** on auth and AI routes, `helmet` headers, input validation with zod, bcrypt password hashing.
- **Next steps for growth:** multi-warehouse stock, organisation (tenant) scoping on every document, MongoDB transactions on a replica set to make "update quantity + write ledger" a single atomic unit, caching the forecast, background jobs for nightly reports, a text index or Atlas Search for large catalogues.

## Known limits

- On a standalone MongoDB the quantity update and the ledger entry are two writes. If the server crashed between them the ledger could miss one entry. A replica set (Atlas always is one) allows wrapping both in a transaction.
- Currency is shown in INR (change `client/src/lib/format.js` to switch).

## Deploying (optional live demo)

1. Database: create a free MongoDB Atlas cluster and copy its connection string.
2. API: deploy `server/` to Render or Railway. Set `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`, `CLIENT_ORIGIN=<your frontend URL>`. Start command: `npm start`.
3. Web: deploy `client/` to Vercel or Netlify. Build command `npm run build`, output `dist`, and set `VITE_API_URL=<your API URL>/api`. Add a rewrite of all paths to `/index.html` so page refreshes work.
4. Run `npm run seed` once against the Atlas URI if you want demo data.
