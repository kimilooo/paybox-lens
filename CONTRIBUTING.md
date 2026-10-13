# Contributing to PayBox Lens

Bug reports and pull requests are welcome. This is an independent, English-language
community dashboard. Help make it easier to understand and use.

## Report a bug

First check [existing issues](https://github.com/kimilooo/paybox-lens/issues).
Then [open a bug report](https://github.com/kimilooo/paybox-lens/issues/new?template=bug_report.yml)
with reproducible steps, what you expected, what happened, and your app, Node,
operating-system and browser versions. State whether the issue occurs in demo mode
or a connected local workspace. For missing history, include the network and
coverage-status message without publishing a wallet address or account export.

Use fictional examples and redact screenshots/error messages. Never attach
tokens, OAuth callback URLs, `.env`, SQLite databases, encryption keys, private
notes or real financial screenshots. For security vulnerabilities, follow
[SECURITY.md](SECURITY.md) instead of posting exploit details publicly.

Feature ideas are welcome as [issues](https://github.com/kimilooo/paybox-lens/issues/new).
Describe the user's problem and the behavior you want. For a large change, discuss
the scope in an issue before starting implementation.

## Submit a pull request

1. Fork the repository and create a focused branch in your fork.
2. Install Node.js 24+ and run `npm ci --ignore-scripts`.
3. Run `npm start` and open `http://localhost:3000/`. Demo mode is enough for most UI work.
4. Make a small, focused change. Keep UI text and documentation in English.
5. Run the relevant checks below. Add a regression test for a behavior fix when useful.
6. Open a pull request against `main`. Link the related issue, explain the result
   and list the checks you ran. Include demo screenshots for visual changes.

```sh
npm test
npm run build
npm run check
npm run security
npm run release:prepare
```

Documentation-only changes do not need new tests. Check Markdown links and assets,
and run the publication check. The repository's CI also runs on Linux and Windows;
CodeQL, Secret Check and Dependency Review provide additional review evidence.

The public-source manifest lives in `SHA256SUMS`. When changing release files,
run `npm run release:prepare` and copy `public-release/SHA256SUMS` to the repository
root. Keep `public-release/`, generated `dist/`, local `data/`, keys and environment
files out of the commit. Newly added root files need an entry in
`scripts/public-files.mjs`; supported files under the existing public directories
are included automatically.

## Project layout

| Directory | Purpose |
| --- | --- |
| `frontend/` | English dashboard UI, financial calculations and local browser state |
| `worker/` | Constrained PayBox bridge and public-chain history providers |
| `local/` | Loopback HTTP adapter, OAuth sessions and encrypted SQLite storage |
| `scripts/` | Build, startup, validation and public-release preparation |
| `tests/` | Fictional fixtures, provider/OAuth mocks and UI regression checks |
| `docs/` | Setup, architecture, privacy, scan records and demo screenshots |
| `.github/` | Contribution templates, CI, security workflows and Dependabot |

Preserve the current financial and privacy boundaries: unknown values stay
unknown; wallet addresses must not be converted into guessed X identities;
transfers/swaps and realized profit remain distinct; Lens does not sign or execute
transactions. Do not introduce telemetry, raw-token browser storage or new
permissions without documenting the behavior and its effect on users.

Contributions are accepted under the repository's [MIT license](LICENSE).
