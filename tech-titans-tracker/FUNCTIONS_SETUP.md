# CricHeroes Function — Blaze setup & deploy (other computer)

Function-only slice. No app UI yet.

- Project: `tech-titans-expense-tracker`
- Region: `asia-south1`
- Callable name: `parseCricHeroesScorecard`
- Auth: Firebase ID token + `admins/{email}` must exist
- Budget alert: **$1 USD**

App root (where `firebase.json` lives):

`tech-titans-tracker/tech-titans-tracker/`

---

## A. One-time: enable Blaze + $1 budget alert

### A1. Upgrade to Blaze

1. Open [Firebase Console](https://console.firebase.google.com/) → project **tech-titans-expense-tracker**.
2. Click **Upgrade** (or gear → **Usage and billing** → **Modify plan**).
3. Choose **Blaze (pay as you go)**.
4. Link / create a Google Cloud billing account and add a credit card.
5. Confirm the project is on **Blaze**.

At 4–5 imports/month this should stay near **$0**. You still need Blaze for Cloud Functions.

### A2. Set a $1 budget alert (Google Cloud)

1. Open [Google Cloud Console Budgets](https://console.cloud.google.com/billing/budgets) (same Google account).
2. Select the **billing account** linked to this Firebase project.
3. **Create budget**.
4. Name: e.g. `tech-titans-tracker-1usd`.
5. Projects: include **tech-titans-expense-tracker**.
6. Amount: **$1** (budget type: specified amount).
7. Thresholds: alert at **50%** and **100%** (email to your billing admins is fine).
8. Save.

You will get email if spend approaches/hits $1. Normal import usage should not.

### A3. Optional but useful APIs check

In Google Cloud Console → **APIs & Services** → enable if not already:

- Cloud Functions API
- Cloud Build API
- Artifact Registry API
- Cloud Run API (used by 2nd gen functions)

First `firebase deploy --only functions` often prompts / enables these.

---

## B. On the deploy computer (after pulling this branch)

```bash
cd /path/to/tech-titans-tracker/tech-titans-tracker

# Frontend deps (only if you also build the site)
npm install

# Functions deps + local parser smoke test (no network, uses Sample Scorecard.html)
cd functions
npm install
npm run test:parse
cd ..

# Firebase login (once per machine)
npx firebase login

# Confirm project
npx firebase use tech-titans-expense-tracker

# Deploy ONLY functions (do not redeploy on every frontend change)
npm run functions:deploy
# equivalent: npx firebase deploy --only functions
```

### Important: what deploy does / does not change

`npm run functions:deploy` / `firebase deploy --only functions` uploads **Cloud Function code only**.

It does **not**:
- delete or change Firestore `admins/{email}` documents you added manually
- change players / tournaments / matches / payments data
- change Authentication users
- redeploy Firestore rules (that is `npm run rules:deploy` only)

Your manual admin whitelist in Firestore stays as-is.

After deploy, Console → **Functions** should show `parseCricHeroesScorecard` in **asia-south1**.

---

## C. Smoke-test the callable (after deploy)

Callable endpoints require a Firebase Auth ID token for a user whose email exists in `admins/{email}`.

### C1. Get an ID token

The app uses the **modular** Firebase SDK, so `firebase` is **not** defined in the browser console.

A temporary helper is in `App.js` (after you pull + run local or deploy the frontend):

1. Sign in to the app as an admin.
2. DevTools → **Console**:

```js
await window.__ttCopyIdToken()   // copies token to clipboard
// or:
await window.__ttGetIdToken()    // prints full token
```

**Important:** the live GitHub Pages site will only have this helper after you deploy the frontend once (`npm run deploy`), **or** run locally:

```bash
cd tech-titans-tracker/tech-titans-tracker
npm start
# open http://localhost:3000 → sign in → run the console commands above
```

Local `npm start` is enough to get a token; you do **not** need gh-pages deploy just to test the Function.

### C2. Call the function via HTTP (callable protocol)

**Normal call:**

```bash
curl -sS -X POST \
  "https://asia-south1-tech-titans-expense-tracker.cloudfunctions.net/parseCricHeroesScorecard" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"data":{"url":"https://cricheroes.com/scorecard/26150403/rising-cup-season-54-saturday/hawks-vs-tech-titans/scorecard"}}'
```

**Debug call** (adds a `debug` object on success; failures always include `error.details.debug`):

```bash
curl -sS -X POST \
  "https://asia-south1-tech-titans-expense-tracker.cloudfunctions.net/parseCricHeroesScorecard" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -d '{"data":{"url":"https://cricheroes.com/scorecard/26150403/rising-cup-season-54-saturday/hawks-vs-tech-titans/scorecard","debug":true}}'
```

Success shape (wrapped by callable as `{ "result": { ... } }`):

```json
{
  "result": {
    "matchId": "26150403",
    "matchName": "Hawks vs Tech Titans",
    "date": "2026-07-18",
    "teams": [
      { "name": "Hawks", "players": [{ "name": "...", "cricheroesPlayerId": "..." }] },
      { "name": "Tech Titans", "players": [{ "name": "...", "cricheroesPlayerId": "..." }] }
    ],
    "sourceUrl": "https://cricheroes.com/...",
    "debug": { "stage": "success", "httpStatus": 200, "htmlBytes": 123456, "fetchMs": 800 }
  }
}
```

(`debug` only present when you pass `"debug": true`.)

### C3. If it fails — what to send the agent

1. **Full curl response JSON** (especially `error.status`, `error.message`, and `error.details.debug`).
   - `details.debug.stage` will be one of: `auth`, `validate_url`, `fetch`, `parse`, …
   - `details.debug.reason` explains why (e.g. `http_not_ok`, `timeout`, `incomplete_parse`).
2. **Cloud Logging** snippet for that request:
   - Firebase Console → **Functions** → `parseCricHeroesScorecard` → **Logs**
   - or Google Cloud Console → **Logging** → filter `parseCricHeroesScorecard`
3. Optional: if fetch worked but parse failed, save the scorecard HTML again (like `Sample Scorecard.html`) and put it in the repo / chat.

Do **not** send your ID token or credit card details.

### C4. Common failure meanings

| `details.debug.stage` / `reason` | Likely meaning |
|---|---|
| `auth` / `missing_auth` | No Bearer token |
| `auth` / `not_in_admins_collection` | Signed in, but email not in Firestore `admins` |
| `fetch` / `http_not_ok` | CricHeroes blocked/rejected Cloud Function IP |
| `fetch` / `timeout` | CricHeroes slow or unreachable from GCP |
| `fetch` / `html_too_small` | Challenge/block page instead of scorecard |
| `parse` / `incomplete_parse` | HTML fetched but layout differed from sample |

---

## D. Cost / abuse reminders

- Redeploy Functions **only when `functions/` changes**, not with every `npm run deploy` (gh-pages).
- Endpoint rejects unsigned callers and non-`admins` emails.
- Do not share ID tokens.
- Keep the $1 budget alert on.

---

## E. Git push from this workspace note

This Cursor workspace may not be able to write to `.git` one level up. From your other computer (or a local terminal with repo access):

```bash
cd /path/to/tech-titans-tracker   # git root
git status
git add tech-titans-tracker/functions \
        tech-titans-tracker/firebase.json \
        tech-titans-tracker/package.json \
        tech-titans-tracker/.gitignore \
        tech-titans-tracker/CRICHEROES_IMPORT_HANDOFF.md \
        tech-titans-tracker/FUNCTIONS_SETUP.md
# Include Sample Scorecard.html if you want the smoke-test fixture in the repo
git add "tech-titans-tracker/Sample Scorecard.html"
git commit -m "Add CricHeroes scorecard callable Cloud Function (asia-south1)."
git push
```

Then run section **A** (if not done) and **B** on the deploy computer.
