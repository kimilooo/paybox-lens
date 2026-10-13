# Publication checks — v0.8.0

Prepared for the public-source release on 2026-10-13.

| Check | Observed result |
| --- | --- |
| Automated suite | 88 passed, 0 failed on Node 24 / Linux |
| Clean dependency installation | npm ci --ignore-scripts succeeded; test-only dependencies |
| Build / Worker validation without Site configuration | Passed from sanitized public snapshot |
| Local startup / HTTP smoke test | Passed: demo served, local session available, SQLite/key created, direct DB file URL returned 404 |
| Loopback listener / Host / Origin / CSRF | Automated tests passed |
| Encrypted persistence / key mismatch / rotating refresh / disconnect race | Automated tests passed with fictional OAuth responses |
| npm audit | 0 reported vulnerabilities at the time of this check |
| Gitleaks 8.30.1 directory scan | 0 findings in the sanitized public tree |
| Publication allowlist | Excludes Site identity, private Git history, DB/key, real .env, exports and generated build output |
| GitHub Actions CI / CodeQL / Secret Check | Configured; remote execution requires publication and must be verified in Actions |
| GitHub PR dependency review | Configured; runs when a pull request changes dependencies |

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
CodeQL results are not claimed to have passed before the GitHub run completes.
No antivirus/malware-free certificate or live user-consent test is claimed.

To repeat: `npm ci --ignore-scripts`, `npm test`, `npm run build`, `npm run check`,
`npm run security`, `npm run release:prepare`, and run Gitleaks on the generated
public tree. Review the actual repository Security and Actions tabs for remote
scan results before relying on a security badge.
