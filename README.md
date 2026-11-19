\# StockPilot AI



\*\*AI-assisted inventory management and demand forecasting for small retailers.\*\*



StockPilot AI helps retailers track products, monitor stock movements, identify low-stock items, estimate how long inventory will last, and make reorder decisions.



\## Features



\- \*\*Inventory management:\*\* Create, view, update, search, filter, and delete products.

\- \*\*Stock tracking:\*\* Record stock-in and stock-out movements with a movement history.

\- \*\*Dashboard:\*\* View inventory summaries, stock status, and important inventory metrics.

\- \*\*Demand forecasting:\*\* Estimate demand, days of stock remaining, and potential stockout risks.

\- \*\*Reorder suggestions:\*\* Identify products that need replenishment and calculate suggested reorder quantities.

\- \*\*AI assistant:\*\* Optional Claude-powered assistant and product-description generation, with built-in rule-based fallbacks when the API key is not configured.

\- \*\*Authentication and roles:\*\* JWT-based authentication with admin and staff permissions.

\- \*\*Input validation and security:\*\* Request validation, password hashing, authentication rate limiting, Helmet security headers, and centralized error handling.



\## Technology Stack



\- \*\*Frontend:\*\* React 18, Vite

\- \*\*Backend:\*\* Node.js, Express

\- \*\*Database:\*\* MongoDB, Mongoose

\- \*\*Authentication:\*\* JSON Web Tokens (JWT), bcryptjs

\- \*\*Validation:\*\* Zod

\- \*\*Optional AI integration:\*\* Anthropic Claude API

\- \*\*Testing:\*\* Node.js built-in test runner



\## Project Structure



```text

stockpilot-ai/

├── client/                 # React frontend

│   ├── src/

│   │   ├── components/

│   │   ├── context/

│   │   ├── pages/

│   │   ├── api.js

│   │   └── main.jsx

│   ├── .env.example

│   └── package.json

├── server/                 # Express backend

│   ├── src/

│   │   ├── config/

│   │   ├── middleware/

│   │   ├── models/

│   │   ├── routes/

│   │   ├── services/

│   │   ├── utils/

│   │   ├── app.js

│   │   ├── seed.js

│   │   └── server.js

│   ├── test/

│   ├── .env.example

│   └── package.json

├── docker-compose.yml

├── package.json

└── README.md

```



\## Prerequisites



Install the following:



\- Node.js 18 or later

\- npm

\- MongoDB running locally or a MongoDB Atlas connection



\## Installation and Setup



\### 1. Install dependencies



From the project root:



```bash

npm run install:all

```



\### 2. Configure the backend



Create a file named `server/.env` by copying `server/.env.example`.



Example configuration:



```env

PORT=5000

NODE\\\_ENV=development

MONGODB\\\_URI=mongodb://127.0.0.1:27017/stockpilot

JWT\\\_SECRET=replace-with-a-long-random-secret

JWT\\\_EXPIRES\\\_IN=7d

CLIENT\\\_ORIGIN=http://localhost:5173

ANTHROPIC\\\_API\\\_KEY=

ANTHROPIC\\\_MODEL=claude-sonnet-4-6

```



Use a strong, unique JWT secret. Keep real environment files and API keys private. The Anthropic API key is optional; without it, the application uses its built-in fallback behavior.



\### 3. Configure the frontend



Create `client/.env` from `client/.env.example`.



For local development, the Vite proxy forwards `/api` requests to the backend, so `VITE\\\_API\\\_URL` can remain empty.



\### 4. Start MongoDB



Make sure your local MongoDB service is running, or configure `MONGODB\\\_URI` with your MongoDB Atlas connection string.



\### 5. Seed demo data



From the project root, run:



```bash

npm run seed

```



\*\*Important:\*\* Seeding resets product and stock-movement data. It is intended for demo or development use. Do not run it against inventory data you want to preserve.



The demo users are:



| Role | Email | Password |

|---|---|---|

| Admin | `admin@demo.com` | `Admin@123` |

| Staff | `staff@demo.com` | `Staff@123` |



Use these credentials only for local demonstrations. Change or replace demo credentials before any public deployment.



\### 6. Run the application



Open two terminals from the project root.



Terminal 1 — backend:



```bash

npm run dev:server

```



Terminal 2 — frontend:



```bash

npm run dev:client

```



Open the frontend at:



http://localhost:5173



The backend runs at:



http://localhost:5000



Health endpoint:



http://localhost:5000/api/health



\## Testing



Run the project's automated tests from the root:



```bash

npm test

```



The tests cover forecast calculations, stockout risk, reorder recommendations, urgency sorting, and consistency of generated seed data.



Build the frontend for production:



```bash

npm --prefix client run build

```



The production frontend files are generated in `client/dist/`.



\## API Overview



All endpoints use the `/api` prefix.



| Method | Endpoint | Purpose | Authentication |

|---|---|---|---|

| GET | `/api/health` | Health check | No |

| POST | `/api/auth/register` | Register a user | No |

| POST | `/api/auth/login` | Log in | No |

| GET | `/api/auth/me` | Get the current user | Yes |

| GET | `/api/products` | List and filter products | Yes |

| POST | `/api/products` | Create a product | Yes |

| GET | `/api/products/categories` | Get product categories | Yes |

| GET | `/api/products/:id` | Get a product | Yes |

| PUT | `/api/products/:id` | Update a product | Yes |

| DELETE | `/api/products/:id` | Delete a product | Admin |

| POST | `/api/products/:id/stock` | Record a stock adjustment | Yes |

| GET | `/api/movements` | View stock movement history | Yes |

| GET | `/api/dashboard` | Retrieve dashboard data | Yes |

| `/api/ai` | AI-related routes | Assistant and description features | Yes |



For protected endpoints, send the JWT access token in the request header:



```http

Authorization: Bearer <token>

```



The exact request body and response structure depend on the endpoint.



\## Forecasting and Reorder Logic



The forecasting service uses historical stock-movement data to estimate demand. The current approach gives greater weight to more recent activity, using a weighted average of the last 15 days and the preceding 15 days when sufficient data is available.



The application uses estimated daily demand and available stock to calculate approximate days remaining. It flags potential stockout risks and produces reorder suggestions based on inventory needs and lead-time assumptions.



Forecasts are estimates, not guarantees. Their accuracy depends on the quality and availability of historical data.



\## Security



\- Passwords are hashed rather than stored as plain text.

\- JWT authentication protects private routes.

\- Role checks restrict administrative operations.

\- Zod schemas validate supported request inputs.

\- Helmet adds HTTP security headers.

\- Authentication routes have rate limiting.

\- Environment files are excluded from version control.



Never commit real credentials, JWT secrets, database passwords, or API keys.



\## Known Limitations



\- Forecast accuracy depends on historical data quality and the demand pattern.

\- The optional Claude integration requires a valid API key and network access.

\- Local development settings are not a substitute for production deployment configuration.

\- Stock updates and movement-history writes are separate database operations; a failure between them may require reconciliation.

\- The automated tests focus on forecasting and seed-data logic and do not replace comprehensive API integration or end-to-end testing.



\## Production Deployment



Before deployment:



1\. Create a production MongoDB database.

2\. Set a strong, unique `JWT\\\_SECRET`.

3\. Set `NODE\\\_ENV=production`.

4\. Configure `MONGODB\\\_URI` and `CLIENT\\\_ORIGIN` for the deployed environment.

5\. Configure `ANTHROPIC\\\_API\\\_KEY` only if the optional Claude integration is required.

6\. Deploy the backend using the server's start command:



&#x20;  ```bash

&#x20;  npm start

&#x20;  ```



7\. Build the frontend:



&#x20;  ```bash

&#x20;  npm run build

&#x20;  ```



&#x20;  Run this command from the `client` directory, or use:



&#x20;  ```bash

&#x20;  npm --prefix client run build

&#x20;  ```



8\. Configure `VITE\\\_API\\\_URL` to point to the deployed API base URL ending in `/api`.

9\. Configure the frontend host to serve the React application correctly for client-side routes.

10\. Replace demo credentials and verify authentication, permissions, CORS, database access, and the production build.



\## License



This project was created for educational and internship purposes. Add a formal license if the project will be distributed under specific licensing terms.
