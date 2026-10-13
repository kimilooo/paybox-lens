# Security policy

PayBox Lens is an independent community project, not an official PayBox client.
Please do not attach access tokens, refresh tokens, wallet addresses, private notes,
database files, screenshots of real balances, or `.env` files to public issues.
Report vulnerabilities through GitHub **Security → Report a vulnerability** when
private vulnerability reporting is enabled. Otherwise, open a public issue with
only a general description and request a private reporting channel.

## Security boundaries

- Local mode listens on `127.0.0.1` and requires the canonical `localhost` Host.
- Mutating local API calls require an exact Origin, a session cookie and CSRF token.
- OAuth uses PKCE S256 and single-use, session-bound state. Fixed PayBox endpoints
  reject unexpected discovery URLs and API redirects.
- Remembered connections explicitly request `offline_access`. Tokens stay in the
  local Node server, with AES-256-GCM encrypted SQLite records. Refresh uses a
  single flight and atomically replaces rotating tokens. An ambiguous failure
  requires reconnecting rather than replaying an old refresh token.
- Signing, transfers, payments, arbitrary proxy requests, secret disclosure and
  plugin execution are blocked by the Worker allowlist. Some allowlisted tools
  return human-operated purchase/settings links; they do not execute purchases.
- Browser copies of contacts, public-history records, snapshots and preferences
  are not encrypted. Private mode redacts the display; it is not encryption.
- The database encryption key is a separate local file. Anyone controlling your
  OS account, both database and key, or a remote hosting server can access data.
  This is a single-user local application, not a multi-tenant hosted service.

## Checks and what they mean

GitHub has no general “firewall passed / malware-free” certificate for a repository.
The included workflows run tests, npm advisory checks, a publication-content
check, CodeQL JavaScript/Python analysis and pull-request dependency review. Dependabot
updates npm packages and pinned Actions. Public repositories also receive GitHub
secret scanning; enable push protection in repository settings when available.

Inspect the actual Actions and Security results for the commit you install.
Passing checks reduces known risk; it does not prove that all code, images,
dependencies, future updates or configurations are harmless. Security badges
show workflow state, not a malware certification. Cloning does not run code;
review scripts before executing them. `npm ci --ignore-scripts` avoids dependency
installation lifecycle hooks.

## Configuration

Keep `data/`, `encryption.key`, SQLite files, `.env`, exports, `.openai/` hosting
identity, build output and access tokens out of public releases. Use
`npm run release:prepare` to create the allowlisted publication tree. Never expose
the local server to a LAN/public proxy. Revoke the client in PayBox if your device
or remembered connection is compromised. Delete data only after backing it up;
losing `encryption.key` makes that database unreadable.

References: [GitHub code scanning](https://docs.github.com/en/code-security/concepts/code-scanning/code-scanning),
[secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning),
[PayBox OAuth](https://docs.paybox.sh/connect/oauth).
