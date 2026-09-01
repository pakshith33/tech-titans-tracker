# Tech Titans Tracker — Agent Handoff Notes

This file exists so a fresh agent session (or a future you) can pick up this project without re-reading the entire chat history. It captures the current state, the reasoning behind key decisions, and known constraints/gotchas.

Last updated: 2026-09-01. CricHeroes: HTML upload only (no URL fetch); scraping APIs analysed not built ([`CRICHEROES_IMPORT_HANDOFF.md`](CRICHEROES_IMPORT_HANDOFF.md) §12a). Android home-screen icon / Play Store later: analysed not built (§15). Header Import Preview **removed**.

## 1. What this app is

A single-page React app for a group called "Tech Titans" to track shared tournament/match costs, who owes what, and to nudge players to pay via WhatsApp + UPI. Hosted on GitHub Pages, backed by Firebase (Auth + Firestore).

- Live site: `https://pakshith33.github.io/tech-titans-tracker`
- GitHub repo: `https://github.com/pakshith33/tech-titans-tracker` (branch `main` = source, branch `gh-pages` = built static site pushed by the `gh-pages` npm package)
- Firebase project: `tech-titans-expense-tracker`
- Local path: `tech-titans-tracker/tech-titans-tracker/` is the actual CRA app root (note the doubled folder name — the outer `tech-titans-tracker/` is the git repo root, the inner one is where `package.json` lives).

Almost the entire admin app lives in [`src/App.js`](src/App.js). Import, public board, and settlement math are split: wizard/parser/fuzzy, [`src/PublicBoard.js`](src/PublicBoard.js), [`src/settlementMath.js`](src/settlementMath.js). Don’t explode the whole app into a component tree unless asked.

Public hash routes (no Google sign-in):

- `#/pay?...` — Pay Now landing (UPI apps); params in the URL.
- `#/board` — public dues board. Live: `https://pakshith33.github.io/tech-titans-tracker/#/board`

## 2. Data model (Firestore, no backend server)

Top-level collections, all flat (no subcollections):

- **`players`**: `{ id, name, mobile, upiId (optional), active }` — **admin-only** in rules (contains mobile/UPI). `upiId` is for the tournament treasurer; WhatsApp now shows the ID as text, not a long Pay Now URL.
- **`playerDirectory`**: `{ id, name, active }` — **public read**. Written whenever an admin saves a player and backfilled on admin login. Used by `#/board` so mobiles never go public.
- **`tournaments`**: `{ id, name, startDate, endDate, totalFee, status: "Upcoming"|"Ongoing"|"Completed", treasurerId, archived }` — **public read**, admin write.
- **`matches`**: `{ id, tournamentId, name, date, participantIds: [], additionalAmount, cricheroesMatchId? }` — **public read**, admin write. `cricheroesMatchId` unique app-wide (import UI).
- **`payments`**: `{ id, tournamentId, playerId, amount, date, type: "payment"|"refund", note }` — **public read**, admin write. Missing `type` treated as `"payment"`. Settlement one-tap uses note containing `"Settlement tab"`.
- **`admins`**: doc ID = teammate's exact sign-in email. Existence = whitelist. Not public.
- **`cricheroesPlayerMaps`**: admin-only. Doc id `id_{cricheroesPlayerId}` or `name_{normalized}`.

All amounts are computed client-side — `computeTournamentStats()` in [`src/settlementMath.js`](src/settlementMath.js); WhatsApp copy in `computeCentralizedSettlement()` in `App.js`. No stored balance field.

## 3. Auth & security model

- Google Sign-In via Firebase Auth (`signInWithPopup`) for **admins**.
- Whitelist = `admins/{email}` docs. Client `isTeamMember` is UX only; **Firestore rules** enforce writes.
- **Public read** (unauthenticated): `tournaments`, `matches`, `payments`, `playerDirectory`. Anyone with `#/board` can see names, amounts, match participation, playerIds. They **cannot** read `players` (mobiles/UPI).
- Admin-only: `players`, `admins`, `cricheroesPlayerMaps`, and all **writes**.
- Deploy rules: `npm run rules:deploy` (required for `#/board` and `playerDirectory`).
- Adding admins is a Firebase Console-only step (document ID = exact email).

## 4. Settlement math (`computeTournamentStats` in settlementMath.js)

- `costPerMatch = round(totalFee / numMatches)`.
- Match cost = `costPerMatch + additionalAmount`, split across `participantIds`.
- `owed` / `paid` / `balance = owed - paid` (positive = owes).
- **Whole rupees only** (`Math.round` everywhere) — do not switch to decimals without asking.

## 5. WhatsApp + UPI

Current WhatsApp copy (don’t reopen without asking):

- Per-match breakdown sorted by date; 3 closings (due / refund / settled).
- **Due line is treasurer UPI ID as text** (`Pay via UPI ID: …`). No long `#/pay` URL in the message (user request 2026-08-21).
- `#/pay` page still exists for old links / in-app UPI buttons; amount omitted on deep links (₹2k cap).
- iOS: `tez://`, `phonepe://`, `paytmmp://` + generic `upi://`.
- Settlement: **Mark Received / Mark Refunded** writes a payment/refund (`note` mentions Settlement tab). **Mark unsettled** on a settled row deletes the latest Settlement-tab payment for that player (else latest payment). No confirm modal.

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

- Charts; non-tournament club expenses; membership fees; admin vs viewer roles; in-app admins UI; WhatsApp Business API.
- **PWA / Play Store APK** — not built; analysis and recommended path in §15. Do not implement until the user asks and supplies icon art if needed.
- Live CricHeroes **paste-URL** import (Cloudflare 403 + CORS). HTML upload is the path. Scraping APIs: analysis only ([`CRICHEROES_IMPORT_HANDOFF.md`](CRICHEROES_IMPORT_HANDOFF.md) §12a); bookmarklet only if asked. Do not wire ZenRows/ScrapingBee unless the user explicitly chooses path B.
- Integration **inside** the official CricHeroes Android app. Header **Import Preview** was removed (wizard remains).
- True animated GIF files on `#/board` — header uses AI **stills** in `public/cricket-*-header.png` plus CSS motion.

## 10. Quick file map

- [src/App.js](src/App.js) — auth, admin UI, settlement, WhatsApp, Pay page, bell/popup, wires import wizard.
- [src/PublicBoard.js](src/PublicBoard.js) — `#/board` (no login).
- [src/settlementMath.js](src/settlementMath.js) — `computeTournamentStats`, `inr`, `fmtDate`, `publicBoardUrl`.
- [src/CricHeroesImportWizard.js](src/CricHeroesImportWizard.js) — Matches-tab import.
- [src/parseCricHeroesScorecard.js](src/parseCricHeroesScorecard.js) — HTML parser.
- [src/cricheroesFuzzy.js](src/cricheroesFuzzy.js) — fuzzy match + map keys.
- [src/firebase.js](src/firebase.js) — Firebase init.
- [firestore.rules](firestore.rules) — public reads + `playerDirectory` + `cricheroesPlayerMaps`.
- [public/cricket-pitch-header.png](public/cricket-pitch-header.png) / [public/cricket-ball-header.png](public/cricket-ball-header.png) — board header art.
- [functions/](functions/) — unused URL callable (403); [FUNCTIONS_SETUP.md](FUNCTIONS_SETUP.md).
- [CRICHEROES_IMPORT_HANDOFF.md](CRICHEROES_IMPORT_HANDOFF.md) — import decisions.
- [Sample Scorecard.html](Sample%20Scorecard.html) — parser fixture.

## 11. TournamentDetail notable state

- Filter/sort: `wa*`, `settlement*`, `payment*`
- `showCloneMatchPicker`, `confirmMatchDelete`, **`showCricImport`**

## 12. CricHeroes import

**Read [`CRICHEROES_IMPORT_HANDOFF.md`](CRICHEROES_IMPORT_HANDOFF.md) before changing import.**

- Matches → **Import CricHeroes** only (header Import Preview **removed** 2026-08-21).
- Saved HTML must be from the **Scorecard** tab.
- `cricheroesPlayerMaps` + unique `matches.cricheroesMatchId`.
- No live URL fetch (403). Bookmarklet / Android-in-app (CricHeroes) integration: not built. Scraping-API analysis 2026-09-01: not wired. Android Share test still not run on a real phone.
- Cloud Function still deployed, unused.

## 13. Notifications (admin header)

- Bell (top right; keep `flex-shrink: 0` — it was clipped/squeezed on mobile when Import Preview was in the header).
- Header `overflow: hidden` must **not** wrap the bell menu (decorations clip in a separate layer). Menu `z-index` above page content.
- Dropdown + daily popup: grouped by tournament (newest `startDate` first), collapsible; players A–Z with Due/Refund.
- Popup **once per calendar day per email**: `localStorage` key `tt-notify-seen-{email}` = `YYYY-MM-DD`. Bell works anytime. Copy public board link is in the dropdown.

## 14. Public dues board (`#/board`)

- No login. Collapsed player rows; name chips (name only); filters Due/Refund/Settled mean **any tournament** with that status (a player can match both Due and Refund).
- Per expanded player: each tournament payment status + match table (name, date, played yes/no, share ₹).
- Header: counts + names for In progress (`Ongoing`), Upcoming, Completed (non-archived).
- After rules deploy, an admin must sign in once so `playerDirectory` backfills.

## 15. Android home-screen icon / Play Store (analysis 2026-09-01)

**User intent (do not assume further):** easy access **icon on the phone now**, **Play Store later**, installers = **a few admins** who can be instructed in person.

**Not built.** This is **this** tracker (GitHub Pages), not putting anything inside the CricHeroes APK (see CricHeroes handoff §13).

### Current site

- Live: `https://pakshith33.github.io/tech-titans-tracker` (HTTPS).
- [`public/manifest.json`](public/manifest.json) already has `name` / `short_name`, `display: "standalone"`, `start_url: "."`. [`public/index.html`](public/index.html) links the manifest.
- **No service worker** (`src/index.js` does not register one) → Chrome often **won’t** show “Install app”.
- Manifest references `favicon.ico`, `logo192.png`, `logo512.png`, but those files were **missing** from `public/` as of this note → generic/blank icon until real PNGs exist.

Admins can still Chrome → ⋮ → **Add to Home screen** today; it may feel like a browser shortcut until a proper PWA.

### Options (ranked for this club)

| Path | What you get | When to use |
|---|---|---|
| 1. Add to Home screen | Icon this week, no Play | Fine for a few admins + a WhatsApp how-to |
| 2. **PWA** (recommended next *if asked*) | Install prompt, standalone window, same Firebase | Small build: 192×192 + 512×512 (maskable) icons, register SW; respect `homepage` `/tech-titans-tracker/` for SW scope |
| 3. Play Store **TWA / Bubblewrap** | Store listing that opens the **same HTTPS site** | After PWA works on one Android phone. Needs Digital Asset Links on the site, Play Console (~$25 one-time), privacy policy, screenshots. **No Kotlin rewrite.** |
| 4. Capacitor / Cordova APK | Native project + signing + dual deploy | Only if we need camera, Share-target, or on-device HTML. **Not** needed for an icon alone |
| 5. Native rewrite | — | Do not |

### Open before implementing PWA (ask; do not assume)

- Icon art: cricket-ball header vs a square logo PNG the user will provide.
- iPhone Add to Home Screen as well (extra Apple tags).
- User must say **implement** — analysis only until then.

### Do not

- Treat CricHeroes Play listing as this app.
- Ship Play Store before PWA install is verified on a real Android device.
