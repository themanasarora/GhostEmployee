# Firebase Setup Guide

This guide walks you through creating and connecting a Firebase project to GhostEmployee.

---

## 1. Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**
3. Name it `ghostemployee-dev` (or your choice)
4. Disable Google Analytics for now (can enable later)
5. Click **Create project**

---

## 2. Enable Authentication Methods

1. In the Firebase console, go to **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method**, enable:
   - **Email/Password** — toggle on
   - **Google** — toggle on, add your project support email
   - **GitHub** — see GitHub OAuth setup below

### GitHub OAuth Setup

1. Go to [https://github.com/settings/developers](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set **Homepage URL**: `http://localhost:3000`
4. Set **Authorization callback URL**: copy from Firebase (it looks like `https://your-project.firebaseapp.com/__/auth/handler`)
5. Click **Register application**
6. Copy **Client ID** and generate a **Client secret**
7. Back in Firebase → GitHub provider → paste Client ID and Client secret → Save

---

## 3. Get Your Firebase Config

1. In Firebase console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** → click **</>** (Web)
3. Register app name: `ghostemployee-web`
4. Copy the `firebaseConfig` object values

---

## 4. Set Environment Variables

```bash
# In apps/web/
cp .env.example .env.local
```

Fill in your `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ghostemployee-dev.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ghostemployee-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=ghostemployee-dev.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abc123
```

---

## 5. Add Authorized Domains

1. Firebase Console → Authentication → **Settings** tab
2. Under **Authorized domains**, add:
   - `localhost` (already there)
   - Your Vercel deployment domain (e.g. `ghostemployee.vercel.app`) when you deploy

---

## 6. GitHub Actions Secrets

For CI/CD, add these secrets to your GitHub repo under **Settings → Secrets → Actions**:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## 7. Vercel Deployment

1. Push this repo to GitHub
2. Go to [https://vercel.com](https://vercel.com) → **New Project** → import repo
3. Set **Root Directory** to `apps/web`
4. Add all `NEXT_PUBLIC_FIREBASE_*` environment variables under **Environment Variables**
5. Deploy

---

## Auth Flows Available

| Flow | Route | Method |
|------|-------|--------|
| Register | `/register` | Email/password + Google + GitHub |
| Login | `/login` | Email/password + Google + GitHub |
| Password reset | `/forgot-password` | Email link |
| Protected dashboard | `/dashboard` | Redirects to `/login` if unauthenticated |
| Sign out | Dashboard nav | Firebase `signOut()` |
