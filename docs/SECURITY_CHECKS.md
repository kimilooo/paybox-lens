# Publication checks — v0.8.0

Prepared for the public-source release on 2026-10-13.

| Check | Observed result |
| --- | --- |
| Automated suite | 89 passed, 0 failed on Node 24 / Linux, including a Windows CRLF build regression |
| Clean dependency installation | npm ci --ignore-scripts succeeded; test-only dependencies |
| Build / Worker validation without Site configuration | Passed from sanitized public snapshot |
| Local startup / HTTP smoke test | Passed: demo served, local session available, SQLite/key created, direct DB file URL returned 404 |
| Loopback listener / Host / Origin / CSRF | Automated tests passed |
| Encrypted persistence / key mismatch / rotating refresh / disconnect race | Automated tests passed with fictional OAuth responses |
| npm audit | 0 reported vulnerabilities at the time of this check |
| Gitleaks 8.30.1 directory scan | 0 findings in the sanitized public tree |
| Publication allowlist | Excludes Site identity, private Git history, DB/key, real .env, exports and generated build output |
| GitHub Actions CI | First public run passed on Linux and found a CRLF bundling defect on Windows. The build now normalizes bundled modules and has an isolated CRLF regression test; review the latest CI run for both platforms. |
| GitHub CodeQL | [First public analysis completed successfully](https://github.com/kimilooo/paybox-lens/actions/runs/38337074087); inspect the Security tab for analysis findings. Successful execution alone is not a finding-free guarantee. |
| GitHub Secret Check | [First full public Git-history scan passed](https://github.com/kimilooo/paybox-lens/actions/runs/38337074166), with matching values redacted |
| GitHub PR dependency review | Workflow installed, but the first execution reported that Dependency graph must be enabled in [repository security settings](https://github.com/kimilooo/paybox-lens/settings/security_analysis). It is not recorded as passed. |

The first Gitleaks scan flagged the public Solana USDC mint identifier in demo
fixtures as a generic API key. The fictional samples now use `demo-usdc` instead;
live token metadata is unchanged. No secret-detection rule was disabled.

Gitleaks was downloaded from the official project release. The Linux x64 archive
SHA-256 was verified as
`551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`.
Public release files have an independently generated SHA256SUMS manifest. These
hashes detect changes relative to that manifest; they are not a malware guarantee.

These results describe the checked source snapshot and local environment, not a
permanent guarantee about future commits, provider behavior or all platforms.
Review the latest commit's workflow results; the links above record the first publication, not future commits.
No antivirus/malware-free certificate or live user-consent test is claimed.

To repeat: `npm ci --ignore-scripts`, `npm test`, `npm run build`, `npm run check`,
`npm run security`, `npm run release:prepare`, and run Gitleaks on the generated
public tree. Review the actual repository Security and Actions tabs for remote
scan results before relying on a security badge.
