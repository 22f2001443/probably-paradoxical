# Probably Paradoxical Backend

Cloudflare Worker backend for Probably Paradoxical.

## Database Setup

MongoDB Atlas uses collections, not SQL tables. The setup script creates:

- `users` - one document per team from `frontend/src/data/teamInfo.yml`.
- `admins` - admin login records with hashed passwords.
- `passwords` - team login credentials keyed by `teamId`, stored as password hashes.

Copy `.env.example` to `.env`, fill in `MONGODB_URI`, then run:

```bash
npm run db:setup
```

Optional seed values:

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` create or update the initial admin login.
- `TEAM_PASSWORDS_JSON` sets per-team passwords, for example `{"T01":"secret"}`.
- `DEFAULT_TEAM_PASSWORD` sets the same initial password for every team.

## Worker Endpoints

- `GET /health` - health check.
- `POST /setup/database` - creates collections and indexes, guarded by `x-setup-secret`.
