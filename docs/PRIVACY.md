# Privacy and data flow

> **Maintainer statement:** “When you install and run PayBox Lens locally on your
> own device, I, Kimiloo, do not receive your financial data, access tokens,
> contacts or private notes. There is no maintainer-controlled database,
> telemetry collector or analytics endpoint in this app.”

That statement applies to the reviewed local code, not every possible remote
deployment. The app contacts PayBox for the wallet/credential grants you approve,
portfolio snapshots, this client's requests and discovery. Public wallet addresses
go to configured chain-history providers. No PayBox token is sent to those history
providers. The maintainer receives no copy through Lens. PayBox and those providers
can observe their requests according to their own policies. npm/GitHub receive
ordinary installation/download traffic. Official PayBox/MoonPay links open their
services when you choose them.

| Data | Local installation | Stateless hosted installation |
| --- | --- | --- |
| Access token | Local server; encrypted in SQLite only when remember is selected | Browser tab memory; passes through the hosting bridge |
| Refresh token | Local server and encrypted SQLite, only with offline_access consent | Not requested |
| OAuth verifier | Session-bound local server state, consumed on callback | Temporary sessionStorage, removed on callback |
| Public OAuth client ID | Local encrypted configuration; reused | Browser localStorage; non-secret |
| Contacts/notes, public history, snapshots and preferences | Browser localStorage plus encrypted local SQLite backup | Browser localStorage |
| Imported/request details | Tab memory unless explicitly exported; annotations are backed up | Tab memory unless explicitly exported |
| Wallet private keys / raw card secrets | Not requested, signed or stored by Lens | Not requested, signed or stored by Lens |

The local DB backup restores missing browser storage keys. Existing browser values
win during startup, then are saved to SQLite. Writes are batched, so use exports or
stop editing briefly before shutdown if you need a reliable backup. A backup error
is reported; it does not silently claim successful persistence. Wallet-set scopes
keep independent contact books/history caches separate. This is not a whole-account
archive and does not backfill portfolio values from wallet creation.

`data/lens.sqlite` and `data/encryption.key` stay on your computer. The encryption
key is not a password you must send to anyone. Back up both files privately while
the server is stopped. The DB encrypts record values and obscures record keys; the
key file remains available to your local server. OS administrators/malware with
your file permissions can read both. Browser storage is unencrypted. Private mode
hides sensitive content visually; timestamps, networks and some counts can remain.

A remote hosting operator can inspect request bodies and bearer tokens passing
through that operator's server. Therefore **do not claim that a hosted owner has
no technical access**. For the maintainer-no-access model, run your own local copy.
The demo uses fictional records. Public source and tests must contain no real
account export, database, note, token, private key or screenshot of real finances.
