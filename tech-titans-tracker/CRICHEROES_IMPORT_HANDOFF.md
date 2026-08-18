# CricHeroes Match Import — Agent Handoff

Fresh agents: read this + [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md). Do **not** re-litigate decisions below unless the user changes them.

**Last updated:** 2026-08-18 (Scorecard-tab save caution + live billing selection count).

---

## 1. Goal

Import a CricHeroes scorecard into a Tech Titans Tracker tournament match with minimal manual player entry: upload saved HTML → confirm team → map players (remembered) → choose who to bill → create match.

---

## 2. Current status: **implemented (needs user deploy/test)**

| Piece | Status |
|---|---|
| HTML upload + client parser | Done |
| Matches-tab full wizard | Done |
| Header “Import Preview” (parse-only) | Kept |
| Upload caution: save from **Scorecard** tab | Done (wizard + Import Preview) |
| Bill step: dynamic “N of M selected” count | Done |
| `cricheroesPlayerMaps` + rules | Code done — user must `npm run rules:deploy` |
| Frontend on gh-pages | User runs `npm run deploy` |
| Live URL fetch via Cloud Function | **Abandoned** — CricHeroes returns **HTTP 403** from GCP |
| Cloud Function `parseCricHeroesScorecard` | Still **deployed** (user choice); **unused** by current UI |

### User deploy checklist (other computer)

```bash
cd tech-titans-tracker/tech-titans-tracker
npm install
npm run rules:deploy    # required for cricheroesPlayerMaps
npm run deploy          # CRA build + gh-pages
```

Live: `https://pakshith33.github.io/tech-titans-tracker`

---

## 3. How to use (product)

1. Open a tournament → **Matches**.
2. Click **Import CricHeroes**.
3. On CricHeroes: open the match → **Scorecard** tab (not Summary / Commentary / Teams / etc.) → **File → Save Page As…** (HTML).
4. Wizard steps:
   1. **Upload** `.html` / `.htm` — UI shows a **Caution** that the file must be from the **Scorecard** tab
   2. **Team** — auto-selects “Tech Titans” when present; admin confirms
   3. **Map** — fuzzy + saved maps; edit; new player (name + **required** mobile); Activate inactive; click **Save mappings**
   4. **Bill** — all selected by default; live count **“N of M players selected for billing”**; optional additional ₹; **Create match**
5. Header **Import Preview** still exists for parse-only checks (same Scorecard-tab caution; no create).

---

## 4. Confirmed decisions (do not re-ask unless user wants change)

1. **Input:** upload saved scorecard HTML — **not** live URL (403 from Cloud Functions). Save from the match **Scorecard** tab only (caution shown in UI).
2. **Entry:** tournament **Matches** tab; keep header Import Preview for now.
3. **Team:** auto-select Tech Titans when present; admin must confirm.
4. **Players shown:** batters + “Yet to Bat” for selected team.
5. **Mapping:** fuzzy match + durable Firestore maps; always show mapping UI; admin can edit and **Save** (overwrites prior map).
6. **Map key:** prefer stable **CricHeroes player id**; else normalized **name**.
7. **New player:** name + **required** mobile; `active: true`.
8. **Player list for mapping:** **all** players including inactive; show “(inactive)” + **Activate** button.
9. **Inactive + billed:** **block** create until admin activates.
10. **Billing default:** all selected; admin can uncheck; UI shows **dynamic “N of M players selected for billing”** count.
11. **Additional amount:** manual field on bill step.
12. **Duplicate `cricheroesMatchId`:** **block** app-wide; show tournament name, match name, date; admin must delete older match first.
13. **Create:** on confirm → write match + toast; close wizard.
14. **Cloud Function:** leave deployed; not used by HTML path.
15. **UI:** wizard uses a colorful step rail (upload/team/map/bill).

---

## 5. Data model additions

### `cricheroesPlayerMaps/{id}`

- Doc id: `id_{cricheroesPlayerId}` **or** `name_{normalized_name_with_underscores}`
- Fields: `{ id, playerId, cricheroesPlayerId, cricheroesName, updatedAt }`
- Synced in `App.js` via `onSnapshot`
- Helpers: [`src/cricheroesFuzzy.js`](src/cricheroesFuzzy.js) (`mappingDocId`, `resolveStoredMapping`, `bestFuzzyPlayer`, …)
- Rules: [`firestore.rules`](firestore.rules) — `allow read, write: if isAllowed()`

### `matches` extra field

- `cricheroesMatchId` (string, optional) — set on import when parse finds match id
- Uniqueness enforced in UI across **all** matches in the app

### Existing shapes (unchanged)

- Match: `{ id, tournamentId, name, date, participantIds, additionalAmount, cricheroesMatchId? }`
- Player: `{ id, name, mobile, upiId?, active }`

---

## 6. Key files

| File | Role |
|---|---|
| [`src/CricHeroesImportWizard.js`](src/CricHeroesImportWizard.js) | Full import wizard UI |
| [`src/parseCricHeroesScorecard.js`](src/parseCricHeroesScorecard.js) | Browser HTML → `{ matchId, matchName, date, teams[] }` |
| [`src/cricheroesFuzzy.js`](src/cricheroesFuzzy.js) | Fuzzy rank + map keys + stored map lookup |
| [`src/App.js`](src/App.js) | Wires wizard in Matches tab; maps sync; header Import Preview modal; `firebaseSaveCricheroesMaps` |
| [`firestore.rules`](firestore.rules) | Includes `cricheroesPlayerMaps` |
| [`Sample Scorecard.html`](Sample%20Scorecard.html) | Fixture for parser tests |
| [`functions/`](functions/) | Callable URL fetch+parse — **unused** after 403; see [`FUNCTIONS_SETUP.md`](FUNCTIONS_SETUP.md) |

---

## 7. Parser notes

- Built against saved Next.js scorecard DOM (not an official API).
- Players per team = batting card names (duplicated-name pattern) + **Yet to Bat** (same line or next line).
- Strips `(c)` / `(wk)` for display/mapping names.
- Local check: `node --input-type=module` importing `src/parseCricHeroesScorecard.js` against `Sample Scorecard.html`, or `npm --prefix functions run test:parse` for the functions copy.
- Sample match: Hawks vs Tech Titans, date `2026-07-18`, match id `26150403`, 12 players per side.

---

## 8. Cloud Function history (context only)

- Built as callable `parseCricHeroesScorecard` in **`asia-south1`**, Auth + `admins/{email}`.
- Live test: auth OK, fetch **HTTP 403** (challenge/block HTML ~4.5KB).
- Product pivoted to **HTML upload + client parse**.
- Function left deployed per user; do not rely on it for import. Optional later cleanup: delete function to avoid idle Artifact Registry storage.

---

## 9. Likely next work (only if user asks)

- Remove header Import Preview once Matches wizard is trusted.
- Delete unused Cloud Function / tidy `FUNCTIONS_SETUP.md`.
- Improve fuzzy matching edge cases / mapping UX polish.
- Bulk import multiple HTML files.
- Persist mapping “confidence” or last-used tournament team preference.
- README still default CRA boilerplate (rewrite only if asked).

---

## 10. Out of scope unless user asks

- Official CricHeroes API / partnership.
- Paid proxies to bypass 403 for live URL.
- Teams-tab HTML.
- WhatsApp / settlement changes for import.
- Role-based access beyond `admins` whitelist.

---

## 11. Agent working notes

- Prefer extending existing patterns in `App.js` / wizard file; keep amounts as whole rupees (`Math.round`) elsewhere in app.
- Git: repo root may be one level above CRA app; user often deploys/pushes from another machine.
- Never assume; if a product choice isn’t in §4, ask.
- After code that touches rules: remind user to run `npm run rules:deploy`.
