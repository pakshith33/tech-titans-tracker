# CricHeroes Match Import — Feature Handoff

Parked notes so a new agent (or a later session) can continue without re-deriving decisions from chat.

Last updated: 2026-08-18 (Option 1: HTML upload + client preview; URL fetch abandoned due to 403).

## Goal

Reduce manual match entry by importing CricHeroes scorecard data, previewing match/players, then (later) mapping players and creating a match.

**Current input method:** upload a saved CricHeroes scorecard **`.html` file** (not live URL fetch).

## Implementation status

### Done

- Cloud Function `parseCricHeroesScorecard` deployed in **`asia-south1`** (left deployed per user; **not used** by the upload path).
  - Live URL fetch from GCP returns **HTTP 403** from CricHeroes — confirmed.
- Browser parser: [`src/parseCricHeroesScorecard.js`](src/parseCricHeroesScorecard.js)
- App UI: header **Import Preview** → upload `.html` / `.htm` → show match name, date, both teams + players.
- Function local parser still under [`functions/parseScorecard.js`](functions/parseScorecard.js); setup notes in [`FUNCTIONS_SETUP.md`](FUNCTIONS_SETUP.md).

### Not done yet (parked until preview is confirmed good)

- Team pick, fuzzy map / create player, billing checkboxes, create match in a tournament
- Product questions listed below (user asked to park until preview looks right)

## Confirmed product decisions (do not re-litigate unless user changes them)

1. **Input (updated):** Upload saved CricHeroes scorecard **HTML file**. Live URL paste via Cloud Function is blocked (403).
2. **Team selection:** Admin chooses which side is “our” team (later step).
3. **Player list:** Show all players from the selected team (batters + Yet to Bat). Admin decides whom to bill (later).
4. **Billing:** Admin explicitly selects who is billed (later).
5. **Player matching:** Fuzzy-match + manual map / create new (later).
6. **Match name:** Form like `Hawks vs Tech Titans`.
7. **Date:** Match date only (ignore time).
8. **Teams tab:** Not required for v1.
9. **Cloud Function:** Leave deployed for now; unused by upload+preview path.

## Sample artifacts already in repo (for parser design)

- Screenshot of scorecard UI (shared in chat; also under Cursor assets).
- [`Sample Scorecard.html`](Sample%20Scorecard.html) — saved “Webpage, Complete” HTML of:
  `https://cricheroes.com/scorecard/26150403/rising-cup-season-54-saturday/hawks-vs-tech-titans/scorecard`
- Related saved assets may exist under `Sample Scorecard_files/` (page dependencies; parser should prefer the main HTML).

### What the sample HTML proved

- Page is a **Next.js** app (`next.cricheroes.com`).
- Useful match fields are present in the saved DOM (not an empty shell): tournament name, venue, date, both team innings, batters, bowlers, **Yet to Bat**.
- Player profile links exist (`/player-profile/{id}/{slug}/matches`).
- No clean official public API found in the saved page.
- Direct fetch from this Cursor sandbox to `cricheroes.com` was blocked (403/timeout). Local user-saved HTML worked for analysis.
- Browser-side fetch from our GitHub Pages origin will almost certainly fail CORS / bot protection — **a backend (or equivalent) is required for “paste URL”**.

### Tech Titans players extracted from sample (batters + Yet to Bat)

Harindra Reddy Lingannagari, Kushal, Sridhar Dwadasi, Kiran Ram, Ajay, Rakesh Das Salesforce, Vikas Deep Banna, Shekar MS, Satvik Reddy, Akshith, Syam Kumar Ananthasetty, Rajesh Askani.

Note: that list had **12** names on this card — billing selection is intentionally left to admin.

Name quirks to handle in matching: role suffixes `(c)` / `(wk)`, casing variants (`Shekar Ms` vs `Shekar MS`).

## App context (existing)

- Single-file CRA app: mostly [`src/App.js`](src/App.js).
- Hosted on GitHub Pages; Firebase Auth + Firestore.
- Match shape: `{ id, tournamentId, name, date, participantIds: [], additionalAmount }`.
- Players: `{ id, name, mobile, upiId?, active }`.
- Settlement uses `participantIds` only (not cricket stats).
- Broader project notes: [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md).

## Current blocker (in progress)

**Paste URL requires a server-side fetch/parse step.**  
No Cloud Functions (or other backend) exist in this repo yet (`package.json` has Firestore rules deploy + gh-pages only).

Do **not** implement a provider until the user picks one.

### Backend preference answers from user (2026-08-14)

1. **OK to put a credit card** on pay-as-you-go, but wants clear pricing first (not “charged per import” confusion).
2. **Provider not chosen yet** — wants more detail before deciding Firebase vs Cloudflare/other.
3. **Volume:** about **4–5 imports per month**.
4. **v1 input:** paste URL; user will test and is willing to revert the feature if it does not work.

### Pricing notes captured for decision (verify on vendor pages if stale)

**Firebase Cloud Functions (Blaze required for Functions):**
- Not billed as a flat “per import product fee.” Billed on invocations + compute + egress after free quotas.
- Typical free monthly quotas on Blaze (as of docs checked 2026-08-14): **2M invocations**, **400K GB-sec**, **200K CPU-sec**, **5 GB outbound networking**.
- At 4–5 imports/month, invocation/compute/egress for this feature alone should stay **~$0**.
- Caveats: card required; **deployments** can create tiny Artifact Registry / Cloud Build charges; set a **budget alert**; protect the endpoint (auth/rate limit) so outsiders cannot spam it.

**Cloudflare Workers:**
- Free plan: **100k requests/day**, but **10 ms CPU per request** hard cap.
- Fetching CricHeroes HTML is mostly waiting on network (often fine), but **parsing ~170KB HTML** may exceed 10 ms CPU → free plan may be insufficient; Paid is **$5/month minimum**.
- For this workload, Firebase is usually the better “near-$0” fit; Cloudflare free is riskier because of the CPU cap.

## Parked questions (ask user again before implementing beyond blocker)

These were raised after product decisions; user asked to park them:

1. Import entry point: only from the **currently open tournament’s Matches tab**, or also elsewhere?
2. After mapping, billing checkboxes default: **all selected** or **none selected**?
3. Creating a **new player** from import: name only for now (mobile empty), `active: true`?
4. Keep **additional amount** as a manual field on the import confirm step?
5. Re-import of same CricHeroes match: **allow duplicate**, **warn**, or **block**? (Optionally store `cricheroesMatchId` / URL on the match doc.)
6. Auto-select team named **“Tech Titans”** when present (still changeable), or always force manual team pick?

### Backend decisions from user (2026-08-14, follow-up)

1. **Provider:** Firebase Cloud Functions.
2. **Auth gate:** **Yes** — Firebase Auth ID token + `admins/{email}` check.
3. **Budget alert:** **$1**.
4. **Deploy:** User will run Blaze upgrade + deploy commands from agent-provided steps.
5. **Region:** **`asia-south1`**.
6. **First build slice:** **Function only** (no app UI yet). Test via curl/script after deploy. Full import UI later.

No separate “Functions login.” Same as the app today:

1. Someone with Firebase Console access adds `admins/{exact-email}` docs (one per teammate).
2. Each teammate opens the app and signs in with **Google** (`signInWithPopup`).
3. That creates/uses a Firebase Auth user for that Google account.
4. App + Firestore rules already gate on `admins/{email}` existence.
5. Import UI (when built) will send that user’s **ID token** to the Cloud Function; Function verifies token + `admins/{email}`.

Teammates who never sign in to the app are not callable clients for the Function.

### Abuse + redeploy protection plan (confirmed direction)

**Against public abuse**
- Require `Authorization: Bearer <Firebase ID token>`.
- Reject if token invalid/expired.
- Require `exists(admins/{email})` (same whitelist as Firestore).
- Optional later: Firebase App Check; simple per-uid rate limit (e.g. N imports/day in Firestore).
- Do not leave a fully public unauthenticated HTTP endpoint.
- Budget alert at **$1**.

**Against redeploy cost creep**
- Develop/parse logic locally against `Sample Scorecard.html` / emulator before deploying.
- Deploy Functions only when backend code changes (not on every frontend `npm run deploy`).
- Set Google Cloud budget alert at **$1**.
- Optionally periodically clean unused Artifact Registry images (only if charges appear).

### Still-open product questions (PARKED — discuss after preview is confirmed)

User explicitly parked these until HTML upload preview looks good:

1. Import entry point: only from the **currently open tournament’s Matches tab**, or also elsewhere?
2. After mapping, billing checkboxes default: **all selected** or **none selected**?
3. Creating a **new player** from import: name only for now (mobile empty), `active: true`?
4. Keep **additional amount** as a manual field on the import confirm step?
5. Re-import of same CricHeroes match: **allow duplicate**, **warn**, or **block**?
6. Auto-select team named **“Tech Titans”** when present (still changeable), or always force manual team pick?

### After user tries upload preview

1. Does preview show correct match name, date, and both team player lists?
2. Ready to un-park questions and build map/create-match flow?

## Suggested import UX (draft only — not approved)

1. Matches tab → “Import from CricHeroes”.
2. Paste URL → backend returns `{ matchName, date, teams: [{ name, players: [...] }] }`.
3. Admin selects our team.
4. For each player: fuzzy suggestions + manual map / create new + bill checkbox.
5. Confirm → create any new players → create match with selected `participantIds`.

Do not build this UI until blocker + parked questions are resolved as needed.

## Out of scope unless user asks

- Bulk tournament import.
- Using Teams tab HTML.
- WhatsApp / settlement changes.
- Official CricHeroes partnership/API.
- Rewriting README boilerplate (still default CRA).
