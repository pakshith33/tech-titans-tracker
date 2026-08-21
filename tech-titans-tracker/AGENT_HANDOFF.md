# Tech Titans Tracker — Agent Handoff Notes

This file exists so a fresh agent session (or a future you) can pick up this project without re-reading the entire chat history. It captures the current state, the reasoning behind key decisions, and known constraints/gotchas.

Last updated: 2026-08-21. CricHeroes: no paste-URL fetch; no hook inside their Android app. See [`CRICHEROES_IMPORT_HANDOFF.md`](CRICHEROES_IMPORT_HANDOFF.md) §12–§13.

## 1. What this app is

A single-page React app for a group called "Tech Titans" to track shared tournament/match costs, who owes what, and to nudge players to pay via WhatsApp + UPI. Hosted on GitHub Pages, backed by Firebase (Auth + Firestore).

- Live site: `https://pakshith33.github.io/tech-titans-tracker`
- GitHub repo: `https://github.com/pakshith33/tech-titans-tracker` (branch `main` = source, branch `gh-pages` = built static site pushed by the `gh-pages` npm package)
- Firebase project: `tech-titans-expense-tracker`
- Local path: `tech-titans-tracker/tech-titans-tracker/` is the actual CRA app root (note the doubled folder name — the outer `tech-titans-tracker/` is the git repo root, the inner one is where `package.json` lives).

Almost the entire app lives in [`src/App.js`](src/App.js). CricHeroes import was split into focused modules under `src/` (parser, fuzzy map, wizard) — keep that pattern for import-related work; don’t explode the whole app into a component tree unless asked.

## 2. Data model (Firestore, no backend server)

Top-level collections, all flat (no subcollections):

- **`players`**: `{ id, name, mobile, upiId (optional), active }` — `upiId` is only meaningful for whoever is set as a tournament's treasurer; it drives the UPI "Pay Now" link.
- **`tournaments`**: `{ id, name, startDate, endDate, totalFee, status: "Upcoming"|"Ongoing"|"Completed", treasurerId, archived }`
- **`matches`**: `{ id, tournamentId, name, date, participantIds: [], additionalAmount, cricheroesMatchId? }` — `cricheroesMatchId` set by CricHeroes import when present; must be unique app-wide (enforced in import UI).
- **`payments`**: `{ id, tournamentId, playerId, amount, date, type: "payment"|"refund", note }` — missing `type` treated as `"payment"`.
- **`admins`**: doc ID = teammate's exact sign-in email. Existence = whitelist.
- **`cricheroesPlayerMaps`**: durable CricHeroes → app player mappings. Doc id `id_{cricheroesPlayerId}` or `name_{normalized}`; fields `{ id, playerId, cricheroesPlayerId, cricheroesName, updatedAt }`. Details in CricHeroes handoff.

All amounts are computed client-side — `computeTournamentStats()` / `computeCentralizedSettlement()` in `App.js`. No stored balance field.

## 3. Auth & security model

- Google Sign-In via Firebase Auth (`signInWithPopup`).
- Whitelist = `admins/{email}` docs. Client `isTeamMember` is UX only; **Firestore rules** enforce access.
- Collections requiring admin: `players`, `tournaments`, `matches`, `payments`, `cricheroesPlayerMaps`.
- Deploy rules: `npm run rules:deploy`. Project: `tech-titans-expense-tracker` (`.firebaserc`).
- Adding admins is a Firebase Console-only step (document ID = exact email).

## 4. Settlement math (`computeTournamentStats` in App.js)

- `costPerMatch = round(totalFee / numMatches)`.
- Match cost = `costPerMatch + additionalAmount`, split across `participantIds`.
- `owed` / `paid` / `balance = owed - paid` (positive = owes).
- **Whole rupees only** (`Math.round` everywhere) — do not switch to decimals without asking.

## 5. WhatsApp + UPI Pay Now

Settled design — don’t reopen without user ask:

- Per-match breakdown sorted by date; 3 closing variants (owe / refund / settled).
- UPI deep links **omit amount** (₹2k deep-link cap bypass); Pay Now https page for WhatsApp auto-link.
- `#/pay` public hash route; iOS uses per-app schemes (`tez://`, `phonepe://`, `paytmmp://`) + generic fallback.
- Mark Received/Refunded = one-tap payment docs; no confirm modal.

Full detail of older iterations lives in git history / prior chat; behavior above is current.

## 6. Known environment constraint for agents

Workspace is often the **inner** `tech-titans-tracker/tech-titans-tracker/`; `.git` is one level up. Agent may be unable to `git commit`/`push` (`.git/index.lock` Operation not permitted). User typically runs git + `firebase` / `npm run deploy` on another machine. Give exact commands; don’t assume agent can deploy.

## 7. Deployment checklist (user runs)

From `tech-titans-tracker/tech-titans-tracker/`:

```bash
npm install                 # if deps changed
npx firebase login          # one-time
npm run rules:deploy        # if firestore.rules changed
npm run functions:deploy    # only if functions/ changed (not needed for HTML import UI)
npm run deploy              # build + gh-pages
```

## 8. Housekeeping already done (don’t redo)

- Removed unused `xlsx`; fixed homepage typo; rebranded CRA HTML/manifest; real smoke test; single `firebase.js` init.
- `README.md` still default CRA boilerplate — rewrite only if asked.
- npm registry date-cutoff quirk in some sandboxes may require pinning older `firebase-tools`.

## 8b / 8d. Prior features (2026-08-07)

Still present: match/player filters & sorts, clone match/tournament, match delete confirm, toasts/confetti, cricket-themed UI, **Dues** tab (read-only outstanding per tournament). Don’t remove without asking.

## 9. Explicitly NOT built (ask first)

- Charts; non-tournament club expenses; membership fees; admin vs viewer roles; PWA; in-app admins UI; WhatsApp Business API.
- Live CricHeroes **paste-URL** import on Cloud Functions / GitHub Pages (Cloudflare 403 + CORS). HTML upload remains the path; bookmarklet (path A) only if asked.
- Integration **inside** the official CricHeroes Android app (not possible). Share-URL still cannot fetch HTML. Partnership email / WebView / PDF only if asked after Share test.

## 10. Quick file map

- [src/App.js](src/App.js) — most UI, auth, sync, settlement, Pay page, wires import wizard + Import Preview.
- [src/CricHeroesImportWizard.js](src/CricHeroesImportWizard.js) — Matches-tab import wizard.
- [src/parseCricHeroesScorecard.js](src/parseCricHeroesScorecard.js) — HTML parser.
- [src/cricheroesFuzzy.js](src/cricheroesFuzzy.js) — fuzzy match + map keys.
- [src/firebase.js](src/firebase.js) — Firebase init.
- [firestore.rules](firestore.rules) — includes `cricheroesPlayerMaps`.
- [functions/](functions/) — unused URL callable (403); [FUNCTIONS_SETUP.md](FUNCTIONS_SETUP.md).
- [CRICHEROES_IMPORT_HANDOFF.md](CRICHEROES_IMPORT_HANDOFF.md) — **authoritative** import decisions.
- [Sample Scorecard.html](Sample%20Scorecard.html) — parser fixture.

## 11. TournamentDetail notable state

- Filter/sort: `wa*`, `settlement*`, `payment*`
- `showCloneMatchPicker`, `confirmMatchDelete`, **`showCricImport`**

## 12. CricHeroes import (2026-08-18)

**Read [`CRICHEROES_IMPORT_HANDOFF.md`](CRICHEROES_IMPORT_HANDOFF.md) before changing import.**

- Matches → **Import CricHeroes**: upload HTML → team → map/save → bill → create.
- **Caution in UI:** saved HTML must be from the match **Scorecard** tab (also on header Import Preview).
- **Bill step:** shows dynamic **“N of M players selected for billing”** as checkboxes change.
- `cricheroesPlayerMaps` + `matches.cricheroesMatchId` (UI enforces unique id app-wide).
- After pull: `npm run rules:deploy` then `npm run deploy`.
- Cloud Function still deployed, unused.
- **2026-08-21:** URL auto-download not implemented. Path **A** (bookmarklet) is the chosen next option; paid unlocker **B** declined for now. Agent/datacenter fetches of cricheroes.com are Cloudflare-blocked.
- **Android:** cannot modify CricHeroes APK. Share test + partnership draft in CricHeroes handoff §13. Android Share payload **not yet observed** on a real phone.
- Public dues board `#/board` (names + amounts + matches; no mobiles). Bell + session popup for pending/refunds. Settlement **Mark unsettled** deletes last settlement payment. WhatsApp pay line is UPI ID only. Deploy **rules** then frontend.
