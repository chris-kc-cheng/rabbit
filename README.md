# Rabbit

Rabbit is a mobile-friendly learning prototype for students aged 10 and above.
The rebuild uses **React**, **FastAPI**, **Docker Compose**, and a schema-validated
**JSON question bank**.

## What works

- Ten parameterized elementary-math templates with deterministic generation.
- Per-learner parent controls for one, several, or all practice topics, plus an
  accessible topic-strength radar based on submitted-answer evidence.
- Misconception-based choices, server-side grading, hints, and feedback.
- PostgreSQL-backed accounts, practice sessions, attempts, rewards, imported
  content, application settings, demo activity, and JWT revocations, with
  role-protected learner, parent, and administrator areas.
- Parent-managed learners, progress evidence, password resets, reward goals, and
  downloadable topic-based PDF worksheets with answer keys.
- Administrator parent management and schema-validated JSON question import.
- KaTeX formulas, an accessible SVG fraction visual, and the Rabbit easter egg.

See [`docs/requirements-checklist.md`](docs/requirements-checklist.md) for a
complete implemented/partial/not-yet-implemented inventory.

## Run the complete stack with Docker Compose

Prerequisites:

- Docker Engine or Docker Desktop with Compose v2.
- Ports do not need to be exposed publicly; Rabbit binds to `127.0.0.1`.

From the repository root, verify the Compose definition and start both services:

```bash
docker compose config
docker compose up --build -d
docker compose ps
```

Open <http://localhost:8090>. API documentation is proxied at
<http://localhost:8090/api/docs>. The API listens on port `8000` only inside
Rabbit's Compose network; it has no host port mapping.

Follow startup logs if either service is not healthy:

```bash
docker compose logs -f api web
```

To use another loopback port, set `RABBIT_PORT` for both startup and later
commands:

```bash
RABBIT_PORT=8091 docker compose up --build -d
```

Then open <http://localhost:8091>. The local Compose stack runs the Vite and
Uvicorn development servers with bind-mounted source. Changes under
`frontend/` trigger Vite hot updates, while Python changes under `backend/app/`
restart the API automatically. Changes to dependency manifests or Dockerfiles
still require a rebuild:

```bash
docker compose up --build -d --remove-orphans
```

Stop the Rabbit containers and network without touching unrelated Compose
projects:

```bash
docker compose down
```

The stack uses the explicit `rabbit` Compose project, an internal named
network, and loopback port binding so it does not stop or expose unrelated local
projects.

If you previously started Rabbit under the `rabbit-learning` project name, stop
that old stack before starting the renamed one. With Docker Desktop running, use
`docker compose -p rabbit-learning down` from the Rabbit repository, then
`docker compose up --build -d`. Confirm with `docker compose ls` and
`docker compose ps`. The old named network may remain and can be inspected with
`docker network ls`; it does not affect the new project.

## Run development servers directly on the host

Backend (start PostgreSQL first with `docker compose up -d db`):

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.txt
alembic -c backend/alembic.ini upgrade head
PYTHONPATH=backend python -m app.bootstrap
PYTHONPATH=backend uvicorn app.main:app --reload
```

Frontend, in another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to FastAPI on port 8000.

## Tests

```bash
PYTHONPATH=backend pytest backend/tests
cd frontend && npm run build
```

The backend test fixtures use an isolated in-memory database and override
`RABBIT_ADMIN_PASSWORD` with the development-only `rabbit-admin` value, so CI
tests neither require nor consume production environment secrets. The CI workflow
separately applies every migration to a fresh PostgreSQL service before running
the test suite.

## Question content and AI authoring

- Normative schema: [`content/question-template.schema.json`](content/question-template.schema.json)
- Executable ten-template bank: [`content/math.question-bank.json`](content/math.question-bank.json)
- Contract and example: [`docs/question-bank.md`](docs/question-bank.md)
- AI structured-output prompt: [`docs/ai-question-authoring-prompt.md`](docs/ai-question-authoring-prompt.md)

## Prototype accounts and authentication

Parents can register with an email address from the public site. Rabbit sends a
single-use activation URL through Resend; the URL expires after 30 minutes and
opens the initial-password form. Parent email addresses are normalized before
storage and login, while parent-created learner profiles continue to use a
username so children do not need their own email address.

Configure `RESEND_API_KEY`, `RABBIT_EMAIL_FROM` (a sender on your verified
domain), and the externally reachable `RABBIT_PUBLIC_URL`. Never commit the API
key: provide it through the deployment secret store or local shell environment.
Resend's `onboarding@resend.dev` sender is only the local default and is not a
production sender.

The database bootstrap creates an `admin` account after Alembic migrations. Its
development-only password defaults to `rabbit-admin`; set `RABBIT_ADMIN_PASSWORD`,
`RABBIT_DATABASE_PASSWORD`, and a long random `RABBIT_JWT_SECRET` in every shared
or deployed environment. The production Compose project requires all three values
and refuses to start without them. Set them as URL-safe, single-line secrets in
the protected GitHub Actions `production` environment before deploying.
The administrator creates parent accounts, and each parent creates their learner
accounts. From the people workspace, an administrator can temporarily view an
active parent in the parent dashboard or an active learner in the learner workspace.
JWTs expire after one hour by default (`RABBIT_JWT_TTL_SECONDS`) and the
web app returns to login on a rejected/expired token. Logout durably revokes the
token and removes it from the browser; password resets persist in PostgreSQL and
invalidate that user's issued tokens. OIDC, refresh-token rotation, and rate
limiting remain production requirements.

Visitors see a public product overview and can use **Try the free demo**. Demo
attempts persist for idempotent retries but are not attached to an account or
family report; retention cleanup remains to be implemented.
Only the fixed prototype demo pack is available without authentication;
it includes Math, Trivia, English, and Discover Canada samples. New published
question types are private by default until explicitly added to it.

The admin import control accepts a complete question-bank JSON document, reports
schema failures with JSON paths and suggested checks, and runs a generation smoke
test. Valid imports persist in PostgreSQL and published banks are immutable.
The public **Docs** page remains available before and after login and provides a
non-publishing validator with the same schema and generation checks.

Click the rabbit logo or mascot to learn the name: a rabbit is “all ears,” so it
listens carefully in class.

## Production deployment

The GitHub Actions workflow tests both applications, publishes separate immutable
GHCR images, and deploys only the `rabbit` Compose project to `~/rabbit` on
Hostinger (the SSH user's home directory). Configure the protected `production`
environment secrets:

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_PORT`
- `RABBIT_ADMIN_PASSWORD`
- `RABBIT_DATABASE_PASSWORD`
- `RABBIT_JWT_SECRET`
- `RESEND_API_KEY`
- `RABBIT_EMAIL_FROM`
- `RABBIT_PUBLIC_URL`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_KNOWN_HOSTS`

Before the first production deployment, create the shared external network used
by the dedicated Caddy container:

```bash
docker network create proxy
```

The workflow creates `~/rabbit` and writes `.env.prod` there with the image tags
and database credentials, then passes it to Compose. Production Compose attaches
the web container to the external `proxy` network with the `rabbit-web` alias; use
`reverse_proxy rabbit-web:8080` in Caddy. No Rabbit port is published on the
host. Nginx passes Caddy's original `X-Forwarded-Proto` value to the API so an
HTTPS request remains identifiable as HTTPS across both proxy hops. The API
remains private on Rabbit's internal Compose network at `api:8000`.

Production Compose stores PostgreSQL data in the `rabbit_postgres` named volume.
This supplies persistence, not a backup strategy. For an on-demand development
snapshot, start the local database and copy production into it with:

```bash
docker compose up -d db
HOSTINGER_HOST=example.com HOSTINGER_USER=deploy \
  HOSTINGER_SSH_KEY="$HOME/.ssh/hostinger" \
  scripts/restore-production-database.sh
```

The script streams a custom-format `pg_dump` from the production `db` container
over SSH into the gitignored `local-data/` directory, validates it, and then
drops and recreates the local `rabbit` database before restoring it. The dated
dump is retained with owner-only permissions. `HOSTINGER_SSH_PORT`,
`RABBIT_REMOTE_DIR`, `RABBIT_LOCAL_DATA`, `RABBIT_DATABASE_NAME`, and
`RABBIT_DATABASE_USER` can override the defaults; run the script with `--help`
for details. This deliberately destructive tool replaces local data only. It is
not an encrypted, automated, off-host production backup: configure those backups
and regularly test disaster restoration before storing real family data.

Before the first deployment with the new project name, stop the old
`rabbit-learning` stack on Hostinger from its deployment directory using
`docker compose -p rabbit-learning --env-file .env.production -f compose.prod.yml down`
(use the old deployment's existing env-file name for this one-time command).
Then deploy the new workflow. Ensure the dedicated Caddy container is also
attached to the external `proxy` network before configuring its upstream as
`rabbit-web:8080`.
For later checks on the VPS, run `cd ~/rabbit` and use
`docker compose -p rabbit --env-file .env.prod --env-file .env.deploy -f compose.prod.yml ps`.
