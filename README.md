# Rabbit

Rabbit is a mobile-friendly learning prototype for students aged 10 and above.
The rebuild uses **React**, **FastAPI**, **Docker Compose**, and a schema-validated
**JSON question bank**.

## What works

- Ten parameterized elementary-math templates with deterministic generation.
- Misconception-based choices, server-side grading, hints, and feedback.
- Responsive learner practice and a clearly labelled parent-report preview.
- Optional parent-configured reward goal.
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

Open <http://localhost:8080>. API documentation is proxied at
<http://localhost:8080/api/docs>.

Follow startup logs if either service is not healthy:

```bash
docker compose logs -f api web
```

To use another loopback port, set `RABBIT_PORT` for both startup and later
commands:

```bash
RABBIT_PORT=8090 docker compose up --build -d
```

Then open <http://localhost:8090>. To rebuild after source or dependency changes:

```bash
docker compose up --build -d --remove-orphans
```

Stop the Rabbit containers and network without touching unrelated Compose
projects:

```bash
docker compose down
```

The stack uses the explicit `rabbit-learning` Compose project, an internal named
network, and loopback port binding so it does not stop or expose unrelated local
projects.

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

## Parent preview and easter egg

Select **Parent preview** in the header to inspect demo attempts and configure a
reward. It is not authenticated and is not yet a production parent portal.

Click the rabbit logo or mascot to learn the name: a rabbit is “all ears,” so it
listens carefully in class.

## Production deployment

The GitHub Actions workflow tests both applications, publishes separate immutable
GHCR images, and deploys only the `rabbit-learning` Compose project to a dedicated
Hostinger path. Configure the protected `production` environment secrets:

- `HOSTINGER_HOST`
- `HOSTINGER_USER`
- `HOSTINGER_SSH_PORT`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_KNOWN_HOSTS`
- `HOSTINGER_DEPLOY_PATH`

The optional `RABBIT_PORT` environment variable defaults to `8080`; the service
binds to `127.0.0.1` for an existing TLS reverse proxy.
