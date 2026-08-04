# ACA Skills Assessment — self-hosted server

Run the offline-first PWA on a machine you control, over HTTPS.

**The hardware does not matter.** `sync-server.mjs` is dependency-free Node, so
any always-on machine running Node 22+ works: a Raspberry Pi, an old laptop, a
NAS, a home server, a VPS you control. A Pi is one convenient option, not a
requirement.

## Prerequisites

- Node.js >= 22 (see `engines` in `package.json`)
- A way to serve HTTPS on your own network — see [Reaching it
  privately](#reaching-it-privately). A service worker will not register over
  plain HTTP, so the app would lose offline support without it.

## Build the app

```bash
npm install
BASE_PATH=/ VITE_PRIVATE=true npm run build
```

This creates `dist/`. Both build flags matter for self-hosting:

- **`BASE_PATH=/`** — the server serves the app at the site root, so assets must
  resolve from `/` (the default build targets a GitHub Pages subpath instead).
- **`VITE_PRIVATE=true`** — enables the private-instance features: the in-app
  **Sync** button, the past-assessments page link, and teaching links. These are
  hidden on the public build, where visitors self-assess and export locally. On
  your own server the app and `/sync` share an origin, so sync needs no extra
  config.

## Teaching lessons (private)

Embedded teaching content is built only in the private deployment. On the Mac
where `~/Documents/ACA/2024/Lessons/` lives:

```bash
# Convert Org lessons to HTML fragments and refresh the lessons map
node tools/build-lessons.mjs            # -> lessons-content/*.html + src/data/lessons.json

# Commit the map (fragments stay git-ignored)
git add src/data/lessons.json && git commit -m "chore: refresh lessons map"

# Copy fragments to the server
rsync -a lessons-content/ ken@pi.tailc5e20.ts.net:~/aca-skills-assessment/lessons-content/
```

Then on the server:

```bash
cd ~/aca-skills-assessment
git pull
BASE_PATH=/ VITE_PRIVATE=true npm run build
sudo systemctl restart aca-assessment
```

The `lessons-content/*.html` fragments are git-ignored (private) and reach the
server only via rsync. The public GitHub Pages build has an empty
`lessons-content/`, so it bundles no teaching content.

## Run the server

```bash
node self-host/sync-server.mjs
```

The server:
- Serves the built app (static files from `dist/`) on `:8787`
- Accepts `POST /sync` (JSON session data) and saves to `self-host/sessions/<id>.json`
- Handles SPA routing (unmatched paths → `index.html`)

Change the port with an environment variable:

```bash
PORT=3000 node self-host/sync-server.mjs
```

## Reaching it privately

A service worker needs HTTPS, so the server needs a TLS origin. Any of these
work — pick whichever fits your network:

- **Tailscale** (what this was developed against):
  ```bash
  tailscale serve --https=443 http://localhost:8787
  tailscale serve status     # prints the https URL
  ```
  You get a URL like `https://<hostname>.<tailnet>.ts.net`.
- **A reverse proxy** on your LAN (Caddy, nginx) with a local certificate.
- **WireGuard or any other VPN**, with the server reachable on the tunnel.

Keep it off the public internet. The app assumes this endpoint is private.

## Use the PWA

1. Open the HTTPS URL in your phone's browser
2. Tap **Add to Home Screen** (iOS/Android)
3. The app is installed and works offline
4. Use the in-app **Sync** button to upload session results (no config needed;
   app and server share an origin)

Session JSON is saved as `self-host/sessions/<session-id>.json`. Copy it off with
`scp`, or read it on the server.

## Running on boot (systemd)

`/etc/systemd/system/aca-assessment.service` — adjust `User` and the paths to
match your own account and checkout:

```ini
[Unit]
Description=ACA Skills Assessment Server
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
User=ken
WorkingDirectory=/home/ken/aca-skills-assessment
ExecStart=/usr/bin/node /home/ken/aca-skills-assessment/self-host/sync-server.mjs
Restart=on-failure
Environment=PORT=8787

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aca-assessment
```

**If you rename or move the checkout, update `ExecStart` and run
`daemon-reload`.** The unit hardcodes the path, so a moved file breaks the
service at its next restart rather than immediately — which hides the failure
until a reboot.
