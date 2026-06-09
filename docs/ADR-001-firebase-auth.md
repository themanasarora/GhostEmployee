# ADR 001 — Authentication: Firebase over Clerk

**Date:** Phase 0  
**Status:** Accepted

---

## Context

We need an authentication provider for Phase 0 that:
- Supports email/password, Google OAuth, and GitHub OAuth
- Is free at development scale
- Requires minimal backend infrastructure to get started
- Has a clear migration path to more advanced auth (MFA, SAML) later

The original blueprint specified Clerk. The project has pivoted to Firebase Authentication.

## Decision

Use **Firebase Authentication** for Phase 0 and Phase 1.

## Rationale

| Factor | Firebase Auth | Clerk |
|--------|--------------|-------|
| Free tier | Generous (10K users/month) | 10K MAU free then paid |
| Backend dependency | None for Phase 0 | Requires webhook sync |
| SDK maturity | Very high | High |
| Google OAuth | Built-in | Built-in |
| GitHub OAuth | Built-in | Built-in |
| Admin SDK | Yes (for backend Phase 2) | Yes |
| SAML / Enterprise SSO | Firebase + custom SAML | Native |
| Migration to backend | Firebase Admin SDK JWT verification | Clerk JWT verification |

Firebase requires zero backend in Phase 0 (auth state lives entirely in the browser), which removes the need to run a backend server until Phase 1 when we add agent execution. Clerk's UI components are opinionated and harder to style consistently with our design system.

## Consequences

- Phase 2 backend (FastAPI) will verify Firebase ID tokens using the Firebase Admin SDK — a standard, well-documented pattern.
- If we ever need enterprise SAML SSO, we will evaluate migrating to a dedicated auth provider at that point.
- Firebase project must be configured with authorized domains when deploying to production.
