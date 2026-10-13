# Easy start — portable downloads

Download a ready-to-run ZIP from [GitHub Releases](https://github.com/kimilooo/paybox-lens/releases/latest).
Portable ZIPs include a checksum-verified official Node.js 24 LTS runtime and a
prebuilt dashboard. No Git, npm install, system Node setup, Docker, database
account or administrator installation is needed.

## Choose your download

| Computer | Release asset | Start after extracting |
| --- | --- | --- |
| Windows 10/11, x64 | `paybox-lens-v0.10.0-win-x64.zip` | Double-click `Start-PayBox-Lens.cmd` |
| Apple Silicon Mac | `paybox-lens-v0.10.0-darwin-arm64.zip` | Open `Start-PayBox-Lens.command` |
| Intel Mac | `paybox-lens-v0.10.0-darwin-x64.zip` | Open `Start-PayBox-Lens.command` |
| Linux, x64 | `paybox-lens-v0.10.0-linux-x64.zip` | Run `./Start-PayBox-Lens.sh` |

Use the named **portable asset**, not GitHub's automatic “Source code” download.
Extract the entire ZIP to a normal folder before starting; do not run inside the
ZIP viewer. Keep the included `runtime/`, `local/`, `scripts/` and `dist/` folders
together. Packages use the official Node runtime's OS requirements. Launchers
are not a signed/notarized desktop installer or a malware-free certification.

Your browser opens at **http://localhost:3000/** after the local server is ready.
If it does not open, type that URL yourself. Keep the launcher window open;
closing it or pressing Ctrl+C stops Lens. The first screen shows fictional demo
data. Click **Connect PayBox**, optionally select **Keep me signed in on this
device**, and complete authorization in PayBox.

## Local data survives upgrades

Portable mode creates encrypted SQLite and its local key in:

| OS | Default data folder |
| --- | --- |
| Windows | `%APPDATA%\PayBoxLens` |
| macOS | `~/Library/Application Support/PayBoxLens` |
| Linux | `$XDG_DATA_HOME/paybox-lens`, or `~/.local/share/paybox-lens` |

Both `lens.sqlite` and `encryption.key` stay on your device. The startup window
prints the actual folder. The maintainer does not receive your local private
data. PayBox and public chain providers receive their required service requests;
see [Privacy](PRIVACY.md). Browser localStorage copies remain unencrypted, and
private mode is display masking.

To upgrade, stop Lens, back up the DB **and** key privately, extract the new
portable ZIP to another folder and use its launcher. The stable data path and
localhost URL allow remembered authorization to survive package replacements,
subject to PayBox expiry/revocation and existing browser cookies.

If you previously used `npm start`, its database defaults to the old project's
`data/` folder. Before your **first** portable launch, stop both copies and copy
the old `lens.sqlite` and matching `encryption.key` to the portable data folder.
Do not overwrite an existing DB/key or mix different keys. Keep the original
backup. Missing browser cookies or a changed client/port can still require
reconnecting. No migration sends data to the maintainer.

## Problems

- **Port in use:** close the other Lens window before starting again. If needed,
  set `LENS_PORT` in a local `.env`; changing it can require new PayBox consent.
- **macOS/Linux script permission:** from a terminal in the extracted folder,
  run `sh Start-PayBox-Lens.command` or `sh Start-PayBox-Lens.sh` respectively.
- **Different CPU/old OS:** choose the matching asset and a supported OS; do not
  substitute a binary from an unverified download.
- **Forgotten/expired authorization:** reconnect in PayBox. Never paste tokens,
  seed phrases or private keys into Lens or a bug report.
- **Incomplete history:** check the coverage notices. Portable installation
  does not change provider limits or guarantee history since wallet creation.

`LENS_DATA_DIR` overrides the portable data folder when intentionally set. Do not
copy `.env.example` unless you want to customize settings; it contains source-mode
defaults. Developers can still follow [the source setup](LOCAL_SETUP.md).

## Verify a download

The release includes `SHA256SUMS` for the downloadable ZIPs. Each extracted
package also has `PACKAGE-SHA256SUMS` for its files, including the runtime.
Node archive pins and version are recorded in `release.json`; its binary/license
and verification metadata are in `runtime/`. Checksums identify the reviewed
bytes; passing scans or matching hashes are not a guarantee of no vulnerabilities.
