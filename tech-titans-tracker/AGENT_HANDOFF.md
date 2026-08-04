# Tech Titans Tracker — Agent Handoff Notes

This file exists so a fresh agent session (or a future you) can pick up this project without re-reading the entire chat history. It captures the current state, the reasoning behind key decisions, and known constraints/gotchas.

Last updated: 2026-08-04. Repo is clean and fully pushed at this point (`git log --oneline -1` → `301e1ea Link updates`, in sync with `origin/main`).

## 1. What this app is

A single-page React app for a group called "Tech Titans" to track shared tournament/match costs, who owes what, and to nudge players to pay via WhatsApp + UPI. Hosted on GitHub Pages, backed by Firebase (Auth + Firestore).

- Live site: `https://pakshith33.github.io/tech-titans-tracker`
- GitHub repo: `https://github.com/pakshith33/tech-titans-tracker` (branch `main` = source, branch `gh-pages` = built static site pushed by the `gh-pages` npm package)
- Firebase project: `tech-titans-expense-tracker`
- Local path: `tech-titans-tracker/tech-titans-tracker/` is the actual CRA app root (note the doubled folder name — the outer `tech-titans-tracker/` is the git repo root, the inner one is where `package.json` lives).

Almost the entire app lives in one file: [src/App.js](src/App.js) (~1040 lines). It's a deliberately single-file CRA app — no router library, no component folder structure. Keep that pattern unless there's a strong reason to split it up.

## 2. Data model (Firestore, no backend server)

Four top-level collections, all flat (no subcollections):

- **`players`**: `{ id, name, mobile, upiId (optional), active }` — `upiId` is only meaningful for whoever is set as a tournament's treasurer; it drives the UPI "Pay Now" link.
- **`tournaments`**: `{ id, name, startDate, endDate, totalFee, status: "Upcoming"|"Ongoing"|"Completed", treasurerId, archived }`
- **`matches`**: `{ id, tournamentId, name, date, participantIds: [], additionalAmount }` — `additionalAmount` is extra cost for that match (e.g. umpire fee) split across participants on top of the base per-match share.
- **`payments`**: `{ id, tournamentId, playerId, amount, date, type: "payment"|"refund", note }` — `type`/`note` were added recently; older payment docs won't have them and that's fine (code treats missing `type` as `"payment"`).
- **`admins`**: doc ID = a teammate's exact sign-in email (e.g. `admins/pakshith33@gmail.com`). Field contents don't matter — only *existence* of the doc is checked. This is the whitelist (see Auth section).

All amounts are computed client-side from these collections — there's no separate "balance" field stored anywhere. `computeTournamentStats()` and `computeCentralizedSettlement()` in `App.js` derive everything on the fly from `matches` + `payments`.

## 3. Auth & security model

- Google Sign-In via Firebase Auth (`signInWithPopup`).
- Whitelist = the `admins` Firestore collection (NOT a hardcoded array in code — that was an earlier design, replaced deliberately). On sign-in, `isTeamMember(email)` in `App.js` does `getDoc(doc(db, "admins", email))`; if it doesn't exist, the user is signed back out with an "Access Denied" message.
- **The real enforcement is server-side**: [firestore.rules](firestore.rules) mirrors the same check — `players`/`tournaments`/`matches`/`payments` all require `exists(/databases/$(database)/documents/admins/$(request.auth.token.email))`. The client-side check in `App.js` is just UX (friendly message instead of a stream of permission-denied errors); it is not what actually protects the data.
- Why `admins/{email}` and not a hardcoded list in the rules file: hardcoding real teammate email addresses into a *public* GitHub repo's `firestore.rules` would leak PII. Storing emails as Firestore *data* (not code) avoids that — the rules file itself contains no real email addresses, only logic.
- **Firestore deploy config**: [firebase.json](firebase.json) + [.firebaserc](.firebaserc) (project alias → `tech-titans-expense-tracker`). Deploy rules with `npm run rules:deploy` (defined in `package.json`, needs `npx firebase login` once first).
- **Manual, one-time, human-only step**: someone with Firebase Console access must add one document per teammate to the `admins` collection (Document ID = their exact email, any placeholder field like `role: "member"`). No agent can do this — it's a Console UI action, not something in the repo.

## 4. Settlement math (`computeTournamentStats` in App.js)

- `costPerMatch = round(totalFee / numMatches)` — the tournament fee is split evenly across matches.
- Each match's cost = `costPerMatch + additionalAmount` (that match's extra cost), then split evenly among that match's `participantIds`.
- A player's `owed` = sum of their per-match share across every match they played in that tournament.
- A player's `paid` = sum of their `payments` docs for that tournament (refunds are just negative-amount payment docs, see below).
- `balance = owed - paid`. Positive = they owe money. Negative = they're owed a refund. ~0 = settled.
- **Design choice, explicitly confirmed with the user**: all amounts round to whole rupees at every step (`Math.round`), not exact decimals. This was asked and deliberately chosen over more "precise" fractional math — don't "fix" this into decimals without checking first.

## 5. WhatsApp message + payment flow (the most-iterated-on part)

This went through several rounds of changes — here's the current final state and *why*, so it isn't accidentally re-litigated:

1. **Message format**: for each player, the message opens with a per-match fee breakdown (`↣ {match name} ➤ Match Fee: ₹{amount}`), then `Total Cost For All Matches`, `You have paid a total of`, `Total Amount Due` (this line's number is signed — negative naturally reads as "they're owed a refund", no separate wording needed). Then one of 3 closing variants depending on owed/overpaid/settled — this 3-variant structure was explicitly kept per user request (not collapsed into one generic template).
2. **UPI deep link**: `buildUpiPaymentLink()` builds a `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...` link from the treasurer's `upiId`. Opens PhonePe/GPay/etc directly with amount pre-filled.
3. **Why there's also a "Pay Now" landing page**: raw `upi://` custom-scheme links are NOT reliably auto-linked/tappable inside a plain WhatsApp text message (WhatsApp mainly auto-links `http(s)://`). So `buildPayNowUrl()` wraps the same params into a link to our *own* hosted page: `https://pakshith33.github.io/tech-titans-tracker/#/pay?pa=...&pn=...&am=...&tn=...`. WhatsApp reliably auto-links this since it's a normal https URL.
4. **The `PayPage` component + `#/pay` hash route**: added directly in `App.js`. `parsePayParamsFromHash()` reads `window.location.hash`; if it starts with `#/pay`, `App()` returns `<PayPage params={...}/>` as the very first thing, before any auth check. This page is intentionally public and reads nothing from Firestore — everything it needs is already in the URL (same info already visible in the WhatsApp message text, so no new privacy exposure). Hash-based routing was chosen specifically because GitHub Pages has no server-side rewrites — only the part of the URL before `#` is ever sent to the server, so this needs zero server config.
4b. **iOS fix for the generic `upi://pay` link (added after a real user report of "payment links not working on iPhone")**: the generic `upi://` scheme only works reliably on Android, where the OS shows a native picker of every installed UPI app. iOS has no such picker — one specific app silently claims the generic scheme (often WhatsApp itself, since it registers as a UPI handler too), with zero way for us to control which, and no error if nothing claims it. This is a documented iOS/NPCI limitation, not something fixable via URL parameters. Fix: `buildUpiAppLinks()` builds per-app custom-scheme links instead (`tez://upi/pay?...` for Google Pay — **not** `gpay://`, which silently fails on iOS — `phonepe://pay?...` for PhonePe, `paytmmp://pay?...` for Paytm), and `PayPage` now renders one button per app plus an "Other UPI App" fallback using the original generic link, plus a tap-to-copy UPI ID (`params.vpa`) as a manual-entry fallback. Don't collapse this back into a single generic button without re-confirming — that regresses iOS.
4c. **₹2,000 limit on UPI deep link payments (NPCI security rule, cannot be bypassed)**: UPI apps (PhonePe, GPay, Paytm) treat deep-link/intent payments similarly to "QR Share & Pay" (scanning a QR from gallery) rather than verified merchant checkout. NPCI enforces a ₹2,000 cap on such payments to non-verified merchants as fraud protection. Since the treasurer is a regular person (not an NPCI-registered merchant with `mc`/`tr` params), this limit applies. **This is not fixable via URL parameters or code changes** — faking merchant credentials would violate UPI terms. The fix: `PayPage` now detects amounts > ₹2,000, shows a warning, and prominently displays the "copy UPI ID and pay manually" flow (which bypasses this limit since it's a normal P2P transfer inside the app). The app buttons are de-emphasized but still shown as a fallback for users who want to try anyway.
5. **"Pay Now" as clickable *text* (hiding the URL) is impossible** — explicitly investigated and confirmed with the user. WhatsApp consumer chat messages (opened via a `wa.me` pre-filled link) have zero markdown/hyperlink support — no `[text](url)` syntax. WhatsApp only ever auto-links raw URLs and displays the literal URL as the clickable text. The only way to get a real tappable "Pay Now" *button* (hiding the URL) is the paid WhatsApp Business API with Meta-approved message templates — a completely different, heavier system, explicitly out of scope. **Final decision: leave the message as-is, do not attempt to hide the URL.** Don't re-attempt this without re-confirming scope with the user — it was asked about twice and settled on "leave as is."
6. **"Mark Received" / "Mark Refunded"**: one-tap buttons in the Settlement tab (`TournamentDetail` component, `section === "settlement"`). `markSettled(b)` auto-creates a `payments` doc for the player's exact outstanding balance (positive amount = received from them, negative = refund paid out — both go through the *same* `payments` collection, tagged with `type: "payment"|"refund"`). No confirmation modal (explicitly chosen — one tap, reversible by deleting the payment in the Payments tab like any other entry).

## 6. Known environment constraint for agents (important!)

In this Cursor sandbox, shell write access is jailed to the **workspace root only**, which is the inner `tech-titans-tracker/tech-titans-tracker/` folder. The actual `.git` directory lives one level up, at `tech-titans-tracker/.git`. This means:

- `git add` / `git commit` / `git push` **cannot be run by the agent** in this sandbox — every attempt fails with `Unable to create '.git/index.lock': Operation not permitted`, even when retried with elevated-permission flags. This is a hard filesystem jail, not an approval-gate that can be bypassed.
- **The user has been running these commands themselves** after each round of agent edits (confirmed: commits `6c37932`, `d9f96e6`, `301e1ea` were all authored by the user outside the agent's shell). A new agent should expect to hand off git operations the same way — give the user exact `git add/commit/push` commands rather than trying to run them directly, unless a future environment doesn't have this restriction (test once with a harmless read like `git status`; if a write like `git commit` fails with an `Operation not permitted` on `.git/index.lock`, it's this same constraint).
- `npm install` and running the CRA dev/build/test tooling all work fine (writes stay within the workspace root, e.g. `node_modules/`, `build/`).
- `firebase login` and `firebase deploy` / `npm run deploy` (gh-pages publish) also need to be run by the user, since they require interactive browser-based auth this sandbox can't complete.

## 7. Deployment checklist (give this to the user, don't try to run it yourself)

From `tech-titans-tracker/tech-titans-tracker/`:

```bash
npm install                 # only needed if package.json changed
npx firebase login          # one-time, opens a browser
npm run rules:deploy        # only needed if firestore.rules changed
npm run deploy              # builds + publishes to the gh-pages branch
```

Live site updates at `https://pakshith33.github.io/tech-titans-tracker` a minute or two after `npm run deploy` finishes.

## 8. Housekeeping already done (don't redo)

- Removed the unused `xlsx` dependency (CSV export is hand-rolled via `Blob`, not this library).
- Fixed `package.json` `homepage` typo (`pakshtih33` → `pakshith33`).
- `public/index.html` / `public/manifest.json` rebranded from default CRA text to "Tech Titans Tracker" with the app's dark-slate theme color.
- `src/App.test.js` replaced the broken default CRA test with a real smoke test (mocks Firebase, asserts the sign-in screen renders). Run via `CI=true npx react-scripts test --watchAll=false`.
- `src/firebase.js` is the single source of Firebase init (`auth`, `provider`, `db` exports) — `App.js` imports from it, does not duplicate the config.
- Note found once but not yet addressed: `README.md` is still 100% default CRA boilerplate — nobody has asked for it to be rewritten yet, but it's a candidate if documentation work continues.
- Sandbox-specific npm quirk (may not apply elsewhere): this particular sandbox's npm registry proxy rejected `firebase-tools` versions published after a certain cutoff date. Had to pin to `^15.24.0` instead of the actual latest (`15.25.1`) to get `npm install` to succeed. If `npm install` fails with `ETARGET ... no matching version ... with a date before ...`, that's this same quirk — check `npm view <pkg> time --json` and pin to something older.

## 8b. "Dues" tab (tournament-wise pending payments / refunds)

A 5th bottom-nav tab, `DuesTab` in `App.js`, added to answer "who still owes money / who's still owed a refund, per tournament" at a glance, without drilling into each tournament's Settlement section one at a time.

- Iterates every **non-archived** tournament (any status — Upcoming/Ongoing/Completed all included), runs the same `computeTournamentStats()` used everywhere else (no separate data/math), and splits each tournament's `balances` into `pending` (balance > 0, owes money) and `refundsDue` (balance < 0, owed a refund).
- **Deliberately hides already-settled players** per tournament — only non-zero balances are listed, to keep it scannable. If a tournament has zero pending/refund entries it shows an "Everyone's settled" line instead of an empty list.
- Each tournament card shows 3 mini-stats (total pending, total refunds due, % of fee collected) plus the two named lists. Tapping a card opens that tournament (same `onOpenTournament` used elsewhere) so the existing Settlement/WhatsApp tabs are still the place to actually act (mark received/refunded, send a nudge) — this tab is a read-only overview, not a new place to record payments.
- Tournaments are sorted by `totalPending + totalRefundsDue` descending (most urgent first), not by date/status.
- A small top card shows a count of "Tournaments with outstanding dues."
- Explicitly scoped down (confirmed with user, don't add without re-asking): no grand total across all tournaments, no WhatsApp button embedded in this tab, no per-player match/owed/paid breakdown — those already exist elsewhere (Settlement tab, WhatsApp tab, Reports tab) and this view was meant to stay simple.

## 9. Ideas raised but explicitly NOT built (don't assume these are wanted — ask first)

From earlier planning rounds, these were discussed and intentionally deferred/skipped:
- Charts/visual graphs of spend over time (only text/CSV reports exist).
- Tracking general club expenses not tied to a tournament (equipment, jerseys, etc.).
- Recurring/membership fees separate from per-tournament match fees.
- Role-based access (admin vs read-only viewer) — currently everyone in `admins` has full read/write.
- PWA/offline support.
- Moving the `admins` whitelist management into an in-app UI (currently Firebase Console only).
- Any WhatsApp Business API integration for real tappable buttons.

## 10. Quick file map

- [src/App.js](src/App.js) — almost everything: auth, Firestore sync, settlement math, all UI components, the Pay Now page.
- [src/firebase.js](src/firebase.js) — Firebase init only.
- [src/App.test.js](src/App.test.js) — smoke test.
- [firestore.rules](firestore.rules) / [firebase.json](firebase.json) / [.firebaserc](.firebaserc) — Firestore security rules + deploy config.
- [package.json](package.json) — note the `rules:deploy` and `deploy` scripts.
- [public/index.html](public/index.html) / [public/manifest.json](public/manifest.json) — branding.
