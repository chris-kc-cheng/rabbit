# Rabbit

Rabbit is a mobile-friendly learning prototype for students aged 10 and above.
The rebuild uses **React**, **FastAPI**, **Docker Compose**, and a schema-validated
**JSON question bank**.

## What works

- Ten parameterized elementary-math templates with deterministic generation.
- Misconception-based choices, server-side grading, hints, and feedback.
- JWT login/logout with role-protected learner, parent, and administrator areas.
- Parent-managed learners, progress evidence, password resets, and reward goals.
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

Then open <http://localhost:8091>. To rebuild after source or dependency changes:

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

## Run in development mode

Backend:

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements-dev.txt
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

## Question content and AI authoring

- Normative schema: [`content/question-template.schema.json`](content/question-template.schema.json)
- Executable ten-template bank: [`content/math.question-bank.json`](content/math.question-bank.json)
- Contract and example: [`docs/question-bank.md`](docs/question-bank.md)
- AI structured-output prompt: [`docs/ai-question-authoring-prompt.md`](docs/ai-question-authoring-prompt.md)

## Prototype accounts and authentication

The memory-backed prototype creates an `admin` account on process startup. Its
development-only password defaults to `rabbit-admin`; set `RABBIT_ADMIN_PASSWORD`
and a long random `RABBIT_JWT_SECRET` in every shared or deployed environment.
The administrator creates parent accounts, and each parent creates their learner
accounts. JWTs expire after one hour by default (`RABBIT_JWT_TTL_SECONDS`) and the
web app returns to login on a rejected/expired token. Logout revokes the token in
this process and removes it from the browser; password resets invalidate that
user's issued tokens. Durable identity, persisted revocation, refresh-token
rotation, rate limiting, and OIDC remain production requirements.

Visitors see a public product overview and can use **Try the free demo**. Demo
attempts are process-local and are not attached to an account or family report.
Only the separately reviewed demo pack is available without authentication;
new published question types are private by default until explicitly added to it.

The admin import control accepts a complete question-bank JSON document, reports
schema failures with JSON paths and suggested checks, and runs a generation smoke
test. Valid imports remain process-local and published banks are immutable.

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
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_KNOWN_HOSTS`

The workflow creates `~/rabbit` and writes `.env.prod` there with the image tags
and port, then passes it to Compose. The optional `RABBIT_PORT` environment
variable defaults to `8090`; the service
binds to `127.0.0.1` for an existing TLS reverse proxy. Point Rabbit's reverse
proxy upstream at `127.0.0.1:8090` unless `RABBIT_PORT` is overridden. The API
remains private on the Compose network at `api:8000`.

Before the first deployment with the new project name, stop the old
`rabbit-learning` stack on Hostinger from its deployment directory using
`docker compose -p rabbit-learning --env-file .env.production -f compose.prod.yml down`
(use the old deployment's existing env-file name for this one-time command).
Then deploy the new workflow. If the reverse proxy currently points at port
`8080`, update its upstream to `127.0.0.1:8090`. A configured GitHub Actions
`RABBIT_PORT` variable overrides the default; set it to `8090` or remove it.
For later checks on the VPS, run `cd ~/rabbit` and use
`docker compose -p rabbit --env-file .env.prod -f compose.prod.yml ps`.
