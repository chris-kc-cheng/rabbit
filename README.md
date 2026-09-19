# Rabbit prototype

A responsive learner-facing prototype for Rabbit, a positive and adaptive
learning platform for students aged 10 and above.

## Included in this prototype

- A polished lesson player that works on desktop and mobile layouts.
- Ten deterministic elementary-math question generators covering arithmetic,
  fractions, place value, measurement, time, and word problems.
- Four choices per question, with every wrong choice tied to a misconception and
  actionable feedback rather than a random value.
- KaTeX formula rendering and an accessible SVG fraction model.
- Hints, answer feedback, streaks, points, lesson progress, and a final summary.
- Optional parent-configured point goals with a family-selected reward. Prototype
  settings are kept in the current browser only.
- Generator tests for determinism, option uniqueness, and distractor rationale.

This is intentionally a client-only prototype. It does not yet persist learner
progress on the server or include authentication, adaptive scheduling, the
learning API, or PDF services described in `AGENTS.md`.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local development intentionally uses the Next.js development server rather than
Docker Compose. Select the **P** avatar to open the prototype parent reward
settings.

### A small secret

Click or keyboard-activate the rabbit mascot—or tap the rabbit logo on mobile—to
discover why the project is called Rabbit.

## Checks

```bash
npm test
npm run lint
npm run build
```

## Production deployment on Hostinger

`deploy-production.yml` builds an immutable production image in GitHub Actions,
publishes it to GitHub Container Registry, copies only `compose.prod.yml` to a
dedicated Hostinger directory, and deploys that exact image. The Compose project,
container network, deploy directory, and loopback-only port are Rabbit-specific,
so unrelated Compose projects on the same host are not stopped or removed.

Configure a protected GitHub environment named `production` with these secrets:

| Name | Purpose |
| --- | --- |
| `HOSTINGER_HOST` | Hostname or IP of the Docker host |
| `HOSTINGER_USER` | SSH user allowed to run Docker Compose |
| `HOSTINGER_SSH_PORT` | SSH port, normally `22` |
| `HOSTINGER_SSH_KEY` | Private deployment key |
| `HOSTINGER_KNOWN_HOSTS` | Pre-verified `known_hosts` entry for the host |
| `HOSTINGER_DEPLOY_PATH` | Dedicated absolute path, such as `/opt/rabbit` |

Optionally set the environment variable `RABBIT_PORT` (default `3100`). The app
binds to `127.0.0.1` on that port so Hostinger's existing reverse proxy can route
the production domain without exposing the Node server publicly. The host needs
Docker Engine, the Docker Compose plugin, and sufficient access for the SSH user.

Production deploys run automatically after a push to `main`, or manually through
the workflow dispatch control. They use the Compose project name
`rabbit-learning`; they never issue a host-wide prune or operate on another
project.
