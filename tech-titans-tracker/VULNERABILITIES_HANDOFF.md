# Dependabot vulnerabilities handoff

Use this file to resume work. Source of truth for the alert list: [`dependabot-alerts.json`](dependabot-alerts.json) pulled from GitHub Dependabot on 2026-08-21.

Repo: [pakshith33/tech-titans-tracker](https://github.com/pakshith33/tech-titans-tracker)  
Alerts UI: [security/dependabot](https://github.com/pakshith33/tech-titans-tracker/security/dependabot)

Do not infer extra CVEs from `npm audit`. Re-export Dependabot JSON if GitHub’s list has changed.

## Snapshot

| | Count |
|---|---|
| Total alerts in JSON | 28 |
| Open | 24 |
| Auto-dismissed | 4 |
| Critical | 0 |
| High (all / open) | 10 / 8 |
| Medium (all / open) | 16 / 14 |
| Low (all / open) | 2 / 2 |
| Ecosystem | npm only |

Manifests:

- `tech-titans-tracker/package-lock.json` — almost all alerts (CRA app + `firebase-tools`)
- `tech-titans-tracker/functions/package-lock.json` — alert **#1** (`uuid`) only

None of the flagged packages are direct dependencies in app or functions `package.json`. App source does not import them. They come from `react-scripts` 5.0.1, `firebase-tools`, and `firebase-admin`.

## Functional impact (do not treat as product bugs)

Shipped GitHub Pages UI and Cloud Functions (CricHeroes import) **do not call these packages**. Alerts are security/tooling, not missing features.

| Cluster | Where it runs | User-facing impact today |
|---|---|---|
| `webpack-dev-server` | `npm start` only | None in production `build/` |
| `postcss`, `svgo`, `nth-check`, `serialize-javascript`, `nanoid` | CRA webpack build | None unless build fails or CSS/JS output changes after an upgrade |
| `hono`, `js-yaml`, `@opentelemetry/core`, `brace-expansion` | CLI / `firebase-tools` / eslint | Not browser product flows |
| `uuid` (functions) | `firebase-admin` / Google clients | Parse/import code does not call `uuid`; advisory is buffer bounds on v3/v5/v6 `buf` |

Exploit conditions (malicious CSS at build, local `npm start` + malicious site, untrusted YAML in CLI) are **security** issues, not expense-tracker or import defects.

## Do not do these upgrades without a dedicated plan

These jump **majors** and can break start, build, or functions:

| Package | Lockfile now | Dependabot “patched” | Risk |
|---|---|---|---|
| `webpack-dev-server` | **4.15.2** | **5.2.6** | High — CRA 5 expects webpack-dev-server 4; `npm start` can break |
| `uuid` (functions) | **9.0.1** | **11.1.1** | High — can break `firebase-admin` CJS/exports |
| `serialize-javascript` | 4.0.0 and 6.0.2 | **7.0.5** | Medium-high — webpack/terser plugins may expect old major |
| `svgo` / `nth-check` | svgo **1.3.2**, nth-check **1.0.2** (nested) | svgo 2.8.3, nth-check 2.0.1 | Medium — SVG/CSS minify output can change; `postcss-svgo` already has svgo 2.8.3 |

Prefer waiting for `react-scripts` / `firebase-admin` / `firebase-tools` to pull patches, or same-major overrides only.

## Lower-risk patch-level bumps (same major)

Confirm with `npm ls <pkg>` before overriding.

| Package | Current (app lockfile) | Target |
|---|---|---|
| `nanoid` | 3.3.16 | 3.3.18 |
| `underscore` | 1.13.6 | 1.13.8 |
| `hono` | 4.12.32 (`firebase-tools`) | 4.12.34 |
| `js-yaml` | 4.3.0 (some trees) | 4.3.1 |
| `postcss` 8.x | **already 8.5.25** | Past 8.5.23; leftover issue is nested **postcss 7.0.39** under `resolve-url-loader` |

## Open alerts

### High (open)

| # | Package | Advisory | Vulnerable | First patched | Notes |
|---|---|---|---|---|---|
| [2](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/2) | `nth-check` | GHSA-rp65-9cf3-cjxr / CVE-2021-3803 ReDoS | &lt; 2.0.1 | 2.0.1 | Nested 1.0.2 under svgo 1 |
| [6](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/6) | `serialize-javascript` | GHSA-5c6j-r48x-rmvq RCE | &lt;= 7.0.2 | 7.0.3 | Also need #12 → 7.0.5 |
| [7](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/7) | `underscore` | GHSA-qpx9-hpmf-5gmw / CVE-2026-27601 DoS | &lt;= 1.13.7 | 1.13.8 | Same major |
| [17](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/17) | `svgo` | GHSA-2p49-hgcm-8545 / CVE-2026-73650 scripts | &gt;= 1.0.0, &lt; 2.8.3 | 2.8.3 | svgo 1.3.2 still present |
| [18](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/18) | `postcss` | GHSA-6g55-p6wh-862q / CVE-2026-45623 file read | &lt;= 8.5.11 | 8.5.12 | Root postcss already 8.5.25 |
| [19](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/19) | `postcss` | GHSA-r28c-9q8g-f849 / CVE-2026-73646 path traversal | &lt;= 8.5.17 | 8.5.18 | Same |
| [24](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/24) | `js-yaml` | GHSA-5p4m-2wfm-xmqj CPU (dev) | &gt;= 4.0.0, &lt; 4.3.1 | 4.3.1 | firebase-tools / eslint trees |
| [28](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/28) | `nanoid` | GHSA-2v37-7h3g-55p8 / CVE-2026-67213 infinite loop | &lt; 3.3.18 | 3.3.18 | Same major |

### Medium (open)

| # | Package | Summary | First patched |
|---|---|---|---|
| [1](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/1) | `uuid` (**functions** lockfile) | CVE-2026-41907 buffer bounds v3/v5/v6 | 11.1.1 (major — do not force) |
| [3](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/3) | `postcss` | CVE-2023-44270 line return parsing | 8.4.31 |
| [4](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/4) | `webpack-dev-server` | CVE-2025-30359 source leak | 5.2.1 |
| [5](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/5) | `webpack-dev-server` | CVE-2025-30360 source leak | 5.2.1 |
| [8](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/8) | `postcss` | CVE-2026-41305 XSS in stringify | 8.5.10 |
| [9](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/9) | `webpack-dev-server` | CVE-2026-6402 CORS source exposure | 5.2.4 |
| [11](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/11) | `uuid` (app lockfile) | same as #1 | 11.1.1 |
| [12](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/12) | `serialize-javascript` | CVE-2026-34043 CPU DoS | 7.0.5 |
| [14](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/14) | `webpack-dev-server` | CVE-2026-9595 HMR websocket | 5.2.5 |
| [15](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/15) | `webpack-dev-server` | CVE-2026-14631 Host/Origin DoS | 5.2.6 |
| [16](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/16) | `webpack-dev-server` | CVE-2026-14620 CSRF on internal endpoints | 5.2.6 |
| [22](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/22) | `postcss` | CVE-2026-69153 incomplete sourcemap fix | 8.5.23 |
| [25](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/25) | `hono` | CVE-2026-71848 language middleware DoS | 4.12.34 |
| [27](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/27) | `hono` | CVE-2026-71850 `memo()` SSR leak | 4.12.34 |

### Low (open)

| # | Package | Summary | First patched |
|---|---|---|---|
| [10](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/10) | `@tootallnate/once` | CVE-2026-3449 control flow | 2.0.1 (major from 1.1.2 in app lockfile) |
| [26](https://github.com/pakshith33/tech-titans-tracker/security/dependabot/26) | `hono` | CVE-2026-71849 Connection header hop-by-hop | 4.12.34 |

## Auto-dismissed (no action unless they reopen)

| # | Package | Severity |
|---|---|---|
| 13 | `@opentelemetry/core` | medium |
| 20, 21 | `brace-expansion` | high |
| 23 | `hono` | medium |

## Suggested later work order

1. Re-export Dependabot JSON; drop anything GitHub already closed.
2. Same-major overrides only: `nanoid`, `underscore`, `hono`, remaining `js-yaml` 4.3.x — then `npm start`, `npm run build`, `npm --prefix functions run test:parse`.
3. Leave `webpack-dev-server` 4, functions `uuid` 9, and `serialize-javascript` 4/6 until CRA / Admin SDK catch up (or plan an eject/CRACO/upgrade of `react-scripts`).
4. Re-check Dependabot after lockfile change; do not force-dismiss without recording reason.

## Refresh the JSON

```bash
curl -sS -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -o dependabot-alerts.json \
  "https://api.github.com/repos/pakshith33/tech-titans-tracker/dependabot/alerts?per_page=100"
```

Do not commit tokens. `dependabot-alerts.json` is local evidence; keep it out of git if the repo is shared more widely than needed.
