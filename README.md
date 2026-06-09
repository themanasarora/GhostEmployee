# GhostEmployee

> Hire AI Employees, Not AI Tools.

GhostEmployee is an autonomous AI workforce platform where users hire specialized AI employees that collaborate, debate, and execute tasks like a real team.

---

## Monorepo Structure

```
ghostemployee/
├── apps/
│   ├── web/          # Next.js 14 frontend (TypeScript + Tailwind)
│   └── api/          # FastAPI backend (Python 3.11+) — Phase 2
├── infra/
│   └── docker/       # Dockerfiles and compose configs
├── docs/             # Architecture decisions, runbooks
└── .github/
    └── workflows/    # CI/CD pipelines
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, TailwindCSS |
| Auth | Firebase Authentication |
| Backend | FastAPI (Python) — Phase 2 |
| Database | PostgreSQL via Firebase Firestore (Phase 1) → Supabase (Phase 2) |
| AI Layer | OpenRouter (GPT-4o, Claude, Gemini) |
| Deployment | Vercel (frontend), Railway (backend) |

## Getting Started

### Prerequisites
- Node.js 20+
- npm 9+

### Development

```bash
# Install dependencies
npm install

# Copy environment variables
cp apps/web/.env.example apps/web/.env.local
# Fill in your Firebase config in .env.local

# Start frontend dev server
npm run dev
```

App runs at `http://localhost:3001`

## Environment Variables

See `apps/web/.env.example` for all required variables.

## Development Roadmap

- **Phase 0** ✅ — Monorepo scaffold, Firebase auth, basic frontend
- **Phase 1** — Employee hiring, goal assignment, multi-agent pipeline
- **Phase 2** — Board meeting mode, report generation
- **Phase 3** — Custom employees, tool integrations, team workspaces
- **Phase 4** — Enterprise auth, autonomous execution

## Contributing

1. Branch from `main`: `git checkout -b feature/your-feature`
2. Commit with conventional commits: `feat:`, `fix:`, `chore:`
3. Open a PR — CI must pass before merge

---

Built with intent. Every AI employee has a role, a memory, and a job to do.
