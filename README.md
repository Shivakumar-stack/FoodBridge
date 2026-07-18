# FoodBridge

FoodBridge is a full-stack food donation and logistics platform that connects donors, NGOs, volunteers, and admins through a controlled donation lifecycle. The project is built as a modular monolith with an Express backend, MongoDB persistence, a vanilla JavaScript frontend, and Socket.io for live updates.

## What The Project Does

- Donors create structured food donations with pickup details and optional images.
- NGOs browse eligible donations, claim them, and confirm receipt.
- Volunteers only see claimed, unassigned deliveries, accept pickup tasks, and update movement status.
- Admins monitor activity, manage logistics, and access system-wide dashboards.
- Real-time events keep dashboards and the live map synchronized.

## Current Technical State

- Browser authentication is cookie-based using an HttpOnly JWT cookie.
- Mutation requests are protected with CSRF tokens.
- Critical claim/status operations are transaction-safe.
- Donation workflow is enforced by a backend state machine.
- Hugging Face image classification is optional and falls back safely when no API key is present.

## Stack

### Backend

- Node.js 18+
- Express.js
- MongoDB + Mongoose
- Socket.io
- Node-Cron
- Zod environment validation

### Frontend

- HTML5
- CSS3 + Tailwind utility styling
- Vanilla JavaScript modules
- Chart.js
- Leaflet

### Security

- HttpOnly auth cookie
- CSRF protection
- RBAC
- Helmet
- Rate limiting
- HPP
- Request validation with `express-validator`

## Workflow

The core happy path is:

`pending -> claimed -> accepted -> picked_up -> delivered -> closed`

Important enforced rules:

- Only NGOs can claim donations.
- Only volunteers can accept pickups.
- Volunteers only see claimed donations that do not already have an assigned volunteer.
- Only the assigned volunteer can mark pickup/delivery progress.
- Only the claiming NGO or an admin can close the final handoff.
- Only the original donor or an admin can cancel a donation.

## Project Structure

- `backend/` Express server, routes, controllers, services, models, middleware.
- `frontend/` public pages, dashboard modules, shared client utilities.
- `tests/` project regression scripts.
- `docs/screenshots/` screenshots for report and presentation use.
- `scripts/` seed, maintenance, and verification scripts.

## Local Setup

### Prerequisites

- Node.js 18 or newer
- MongoDB connection string
- Optional Cloudinary account for image uploads
- Optional Hugging Face API key for image classification

### Install

```bash
npm install
```

If you want to use the standalone frontend tooling as well:

```bash
npm install --prefix frontend
```

### Configure Environment

Copy `.env.example` to `.env` and fill in the values you need.

Required for the main app:

- `MONGO_URI`
- `JWT_SECRET`
- `SESSION_SECRET`
- `CLIENT_URL`

Optional:

- `CLOUDINARY_*`
- `HUGGINGFACE_API_KEY`

`MONGODB_URI` is also recognized by some maintenance scripts as an alias.

### Run

Backend-served app:

```bash
npm start
```

Separate dev processes:

```bash
npm run start:backend
npm run start:frontend
```

Both in parallel:

```bash
npm run start:all
```

## Quality Checks

Lint:

```bash
npm run lint
```

Regression suite:

```bash
npm test
```

`npm test` runs the project regression scripts in `tests/`:

- analytics timeline validation
- claim race-condition validation
- workflow authorization validation
- browser auth/security validation
- donation lifecycle validation

## Documentation Set

- [COMPLETE_PROJECT_GUIDE.md](./COMPLETE_PROJECT_GUIDE.md): engineering walkthrough
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md): short technical summary
- [FoodBridge_Synopsis.md](./FoodBridge_Synopsis.md): academic synopsis
- [ACADEMIC_PROJECT_DOCUMENTATION.md](./ACADEMIC_PROJECT_DOCUMENTATION.md): updated academic report
- [PPT_PRESENTATION_SCRIPT.md](./PPT_PRESENTATION_SCRIPT.md): slide-by-slide demo script

## Notes For Demo Use

- If `HUGGINGFACE_API_KEY` is not configured, the image analysis path will fall back to mock classification instead of failing.
- Seed scripts create default demo data, but do not use seeded passwords outside local development.

## License

MIT
