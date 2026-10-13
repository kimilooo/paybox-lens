# PayBox Lens architecture and debugging boundaries

## User story

Connect PayBox → discover granted wallets and credential modes → normalize portfolio snapshots and this client's requests → fetch public chain pages → render amounts and coverage → export a scoped report.

## Layers

| Layer | Modules | Contract |
| --- | --- | --- |
| Domain / normalization | `analytics.js`, `history-data.js`, `address.js` | No network or browser storage. Explicit units, wallet-specific IDs, nullable historical values, failed/pending accounting. |
| History use case | `solana-history.js`, `history-ui.js` | Read-only RPC port; round-robin pages; discover open and historical owned token accounts; dedupe records and replace unavailable-detail placeholders. |
| Transport adapters | `worker/history.js`, `browserSolanaHistory`, `evm-history.js` | Fixed provider URLs, valid network/address pairs, bounded time, no PayBox bearer on public reads. Browser fallback uses user's network and provider CORS. |
| Persistence adapter | `history-cache.js`, `snapshots.js` | Wallet-set isolation. USD snapshots / public chain records only; no tokens, MCP request artifacts or credentials. Explicit storage-limit warning. |
| PayBox adapter | `paybox.js`, `worker/index.js` | OAuth + PKCE, stable public client registration per redirect, fixed official endpoints, read/handoff allowlist, session generation guard and one initialization per session. No payments/signatures/swaps. |
| Local annotations | `contact-book.js` | Pure validation / updates, scoped storage adapter, bounded records, address matching, manual identity evidence only. Contact edits do not alter financial fields. |
| Explanations | `explanations.js` | Deterministic English from recorded facts, nullable fee payer / USD / origin, status-first wording. |
| Privacy projection | `privacy.js` | Whitelisted display objects; no raw identifiers, amounts or personal text. Source state stays separate. |
| Presentation | `app.js`, `historyPanel` | English states, exact amount strings, date/source filters, evidence-aware unknown fields. |
| Export | `exports.js` | Real PDF/XLSX/CSV files from loaded records; no fictional historical prices, gains or identity mapping. |

The server and browser Solana transports use the same history use case. Domain parsing does not know which transport fetched a transaction. External data is translated before financial aggregation. Public-reader fallback is not an unrestricted proxy and never sends PayBox authorization or cookies.

## Confirmed breaks and regression evidence (v0.5)

- Undated signatures were discarded by activity filtering; now retained for an unbounded date view.
- A one-lamport SOL movement could be hidden / rounded by floating fee subtraction; raw integer subtraction and exact strings preserve it.
- Solana and EVM IDs lacked wallet identity; a transfer between granted wallets could overwrite one side.
- EVM pending records were counted as successful. Unknown token decimals were defaulted to 18.
- Completed scans did not refresh; partial token discovery could never be retried.
- A long first wallet starved subsequent sources. Page scheduling is now round-robin.
- Reload discarded progress; reconnect now restores validated public-history records and cursors for the same wallet set.
- Successful detail parsing retained an old unavailable-detail placeholder. It is now replaced and the missing count recomputed.
- Closed owned token accounts visible in old transaction metadata were ignored; they are now queued for signature scanning.
- Shared-server provider blocks had no alternative transport; browser-only public reads are attempted, subject to provider/CORS availability.
- A late MCP response after disconnect restored the old MCP session ID; generation guards prevent it from contaminating a new connection.
- A malformed request-history response was treated as a successful empty ledger. It now becomes a source warning.
- Routescan gas values were lost in response mapping; they are retained.

Each bug was exercised with a failing regression test before its fix. Unit/integration tests isolate external transport at the fetch boundary; real parsers, synchronization, persistence, UI and exports are exercised.

## Coverage is evidence, not a boolean completeness claim

`historyState.complete` means this run's tasks ended or were marked unavailable. It does not mean the entire account is archived. The UI distinguishes gaps. Cached records are labeled restored and refreshed after connection. RPC signature exhaustion is not a proven wallet creation date. Historical closed token accounts can only be recovered if they can be discovered from available data. Unindexed networks and other clients' requests remain outside the documented public scope.

A browser fallback can succeed where shared-server access fails, but does not remove provider rate limits or prove archive completeness. The user's actual browser/network response must be observed before claiming live account history is fixed. The actual account portfolio was inspected through native read-only tools. Eight holdings normalized with correct units and tags; priced subtotals matched. No account values or identifiers are kept in source fixtures. Native ChatGPT request history belongs to a different OAuth client and is not copied into the hosted dashboard.

## Live-schema and scope fixes (v0.6)

- `items` and `shiftedBalance` were not recognized; raw atomic balances appeared as display quantities.
- Individual-wallet reads omitted aggregate `x_connection`; the UI incorrectly reported X status unavailable and mislabeled live handles as demo.
- Solana’s numeric network ID was not labeled. Provider dust flags and claim-domain spam were ignored.
- Public-client registration was recreated on every connection, resetting this-client request scope. A non-secret public client ID now persists per redirect; tokens and PKCE verifiers do not persist in localStorage.
- History scanning omitted Optimism/Arbitrum/Polygon. Fixed-host adapters now cover them, including correct POL units for Polygon fees. Other returned networks are named as coverage gaps.
- Already discovered unavailable details required a recent-page rescan. Refresh now retries a known signature directly, while giving regular wallet sources their turn.

Current production evidence: read-only granted-wallet queries returned four Ethereum normal records and one Solana record; Base was blocked. Fresh domain/DOM/build checks cover the code, but live browser OAuth/CORS and complete archives are not certified.

## Applied skills

- [Systematic Debugging](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md): root cause, reproduction, minimal fix, evidence.
- [Architecture Patterns](https://github.com/wshobson/agents/blob/main/plugins/backend-development/skills/architecture-patterns/SKILL.md): domain / use-case / transport / persistence boundaries.
- [Test-Driven Development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md): observe failures before fixing.
- [Verification Before Completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md): fresh test/build/deployment results before claims.

Skills were read and applied; no third-party skill package was installed in the repository, and the project was not migrated to React or Vercel.

## Content privacy, contacts and explanations (v0.7)

`preparePresentation` enriches raw records with local annotations, then projects a redacted model when private mode is active. Tables use ephemeral row indexes for interaction. Numerical chart geometry and provider history controls are replaced with neutral placeholders. Dialogs use the same privacy projection; copy, export and wallet action paths have independent guards. Session updates may still collect data, but cannot place raw detail values into a private dialog. Privacy is a presentation boundary, not encrypted storage or an authorization boundary.

Contact lookups use a per-book index. Updates create new books, persist successfully, then replace active state. Changing wallet-set scope reloads the appropriate book and closes stale forms. Imported IDs such as `__proto__` are stored as own properties rather than changing object prototypes. Private mode is a browser preference; contact/label books are separated from demo and imported data.

New regression coverage checks canonical address matching, edit/delete persistence semantics, corrupt storage, quota errors, manual identity evidence, exact tiny amounts, pending/failed/signing explanations, own-wallet movements, annotation exports, seven-page DOM redaction, fresh private-mode startup and responses arriving after private mode is enabled.


## Local adapter (v0.8)

`local/server.mjs` is a loopback-only, single-user Node adapter around the same
Worker. `local/store.mjs` encrypts SQLite record values with AES-256-GCM and HMACs
record keys. `frontend/local-connection.js` bootstraps a cookie/CSRF session,
restores missing browser keys, batches allowed workspace backups and keeps
OAuth tokens outside browser JavaScript. Older token-in-tab descriptions above
apply to stateless hosted mode. Local remembered mode explicitly opts into
`offline_access`; refresh tokens rotate with single-flight refresh and fail-closed
handling of ambiguous outcomes. Disconnect generations prevent late authorization
responses from restoring deleted connections. No private source-history or Site
identity is included by `scripts/prepare-public.mjs`. See PRIVACY.md for the
operator/device threat boundary, and LOCAL_SETUP.md for installation and backup.
