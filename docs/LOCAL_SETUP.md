# Install locally — Node 24 + built-in SQLite

Prefer a ready-to-run download? Follow [Easy start](EASY_START.md). The portable
ZIP bundles Node.js and needs no Git or npm installation. This page describes
the developer/source setup, which stores data in the project folder by default.

No PostgreSQL account, Docker, remote database or paid history API is required to
start. Public history providers can still limit access; a key does not guarantee
complete lifetime history.

## 1. Install prerequisites

Install [Node.js 24 LTS](https://nodejs.org/en/download) or a supported newer Node
release, and [Git](https://git-scm.com/downloads). In Terminal/PowerShell:

```sh
node --version
git --version
```

Node 20/22 is not supported by this local package: it relies on Node's built-in
SQLite API and the tested Node 24 runtime. npm comes with Node. Some Node versions
print an experimental SQLite warning; no separate SQLite service is required.

## 2. Download and start

```sh
git clone https://github.com/kimilooo/paybox-lens.git
cd paybox-lens
npm ci --ignore-scripts
npm test
npm start
```

Open **http://localhost:3000/** (use `localhost`, not a LAN address). The first
screen uses fictional demo data. Keep the terminal running; Ctrl+C stops the app.
The local server binds only to `127.0.0.1`. Do not put a public reverse proxy or
port-forwarding service in front of it. Windows users run the same commands in
PowerShell; Unix permission modes are best-effort on Windows, so protect the
folder with your user-account ACLs.

Alternatively, download the repository ZIP, extract it, open a terminal in that
folder, then run `npm ci --ignore-scripts`, `npm test` and `npm start`.

## 3. Connect once and keep the local session

1. Click **Connect PayBox**.
2. Select **Keep me signed in on this device** on your own trusted device.
3. Continue to PayBox, sign in there and approve only the credentials you need.
4. PayBox redirects back to the exact local URL. Reloading/reopening Lens then
   restores the encrypted local connection automatically.

Lens never asks you to paste a private key, seed phrase, access token or password.
Selecting remember explicitly requests PayBox's `offline_access` scope. Access
tokens currently last about an hour; refresh tokens rotate and have a 30-day
sliding lifetime. Active use can renew them. Revocation, expiry, lost browser
cookies/key, an interrupted rotation, or changed port/client can require sign-in
again. **One authorization is reusable; it is not a promise of permanent login.**

Without remember, tokens stay in local server memory, not on disk. Closing the
server ends that session. **Disconnect** removes this browser's saved tokens;
workspace backups are retained. Revoke the client in PayBox to revoke its grant
upstream. Never check remember on a shared computer.

## 4. Your local database

The app creates these files automatically:

```text
data/lens.sqlite
data/encryption.key
```

The database stores encrypted remembered sessions and a backup of selected browser
workspace records (contacts/labels, snapshots, validated public history, settings).
The key file stays local. No database password or connection string is needed.
The repository ignores both files. SQL records use prepared statements. Database
and key are protected with restrictive file modes on Unix-like systems.

Stop the server before backing up both files. Do not upload them to GitHub, issues,
chat or the maintainer. Copying just the DB without its key will not restore it.
Clearing browser cookies loses the remembered-session link even if the DB remains;
reconnect instead of trying to retrieve tokens manually. Clearing an on-screen
snapshot/history key also updates its DB backup. Annotations persist separately.

## 5. Optional settings

Copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux,
`Copy-Item .env.example .env` in PowerShell). Defaults work without editing it.

```dotenv
LENS_PORT=3000
LENS_DATA_DIR=./data
SOLANA_RPC_URL=
BLOCKSCOUT_API_KEY=
```

Dedicated provider credentials are optional and server-only. Never commit `.env`.
If port 3000 is occupied, choose another port and open the URL printed on startup.
PayBox callback registration is exact; changing the port creates another client
scope and can require renewed consent. Provider keys do not recover other clients'
PayBox requests or certify full archival coverage.

## Troubleshooting

| Problem | Action |
| --- | --- |
| `node:sqlite` is missing | Install Node 24+, close/reopen the terminal, check `node --version` |
| Port is in use | Stop the other app or change LENS_PORT |
| Host/CSRF error | Use the printed localhost URL; reload; disable a proxy rewriting Host/Origin |
| Remembered connection expired | Connect again; do not replay/copy refresh tokens |
| DB cannot decrypt | Restore the matching key/DB backup; never replace the key blindly |
| Backup warning | Check free disk/permissions; browser data remains; export before troubleshooting |
| History incomplete | Check coverage notices and provider availability; do not assume an empty scan proves no activity |

See [privacy](PRIVACY.md), [architecture](ARCHITECTURE.md) and [security](../SECURITY.md).
