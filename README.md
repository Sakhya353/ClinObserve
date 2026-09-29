# ClinObserve (JavaScript full stack)

**Synthetic Research Prototype — Not an Official AIIMS Delhi System.** All data is fictional. No diagnosis, treatment or medication advice.

## Run
1. Install Node 18+ and MongoDB (local or Atlas).
2. `npm install`
3. `cp .env.example .env` and set `MONGO_URI` and `JWT_SECRET`.
4. `npm run seed` (500 patients, 50 doctors, 12 departments, 800 consultations, 1000 observations, 700 medications, 500 appointments, 300 follow-ups, 1500 audit logs)
5. `npm start` then open http://localhost:5000

- `/` animated website + dashboard (public/index.html, plain JavaScript)
- `/api.html` API console (login, then call any endpoint)
- `/api-docs` Swagger UI, `/api/health` health check

Demo logins (password `Demo@1234`): admin@, doctor@, clinical.observer@, operations.manager@, research.analyst@ `clinobserve.demo`. Audit logs are Admin-only.

## Notes
The dashboard in `public/index.html` currently uses its own in-browser synthetic data; the REST API serves the same kind of data from MongoDB. Wiring the UI to the API is the next step.
Security: Helmet, CORS, rate limiting, Zod validation, JWT + bcrypt, role checks, query-string injection guard, sanitized errors.
