# ACA Skills Assessment — Raspberry Pi Server

Run the offline-first PWA on a Raspberry Pi (or any machine) over Tailscale HTTPS.

## Prerequisites

- Node.js >= 20
- Tailscale installed and logged in on the Pi

## Build the App

```bash
npm install
BASE_PATH=/ VITE_PRIVATE=true npm run build
```

This creates `dist/` with the compiled app. The two build flags matter for
self-hosting:

- **`BASE_PATH=/`** — the server serves the app at the site root, so assets must
  be resolved from `/` (the default build targets a GitHub Pages subpath instead).
- **`VITE_PRIVATE=true`** — enables all private-instance features: the in-app **Sync** button,
  the past-assessments page link, and teaching links. These are hidden on
  the public build, where visitors self-assess and export locally; on your own
  server the app and `/sync` share an origin, so sync works with no extra config.

## Teaching lessons (private)

Embedded teaching content is built only in the private deployment. On the Mac where
`~/Documents/ACA/2024/Lessons/` lives:

```bash
# Convert Org lessons to HTML fragments and refresh lessons map
node tools/build-lessons.mjs            # -> lessons-content/*.html + src/data/lessons.json

# Commit the map (fragments stay git-ignored)
git add src/data/lessons.json && git commit -m "chore: refresh lessons map"

# Deploy fragments to the Pi
rsync -a lessons-content/ ken@100.85.235.11:~/aca-skills-assessment/lessons-content/
```

Then on the Pi:

```bash
cd ~/aca-skills-assessment
git pull
BASE_PATH=/ VITE_PRIVATE=true npm run build
sudo systemctl restart aca-assessment
```

The `lessons-content/*.html` fragments are git-ignored (private) and only reach the Pi
via rsync. The public GitHub Pages build has an empty `lessons-content/`, so it bundles
no teaching content.

## Run the Server

```bash
node pi/sync-server.mjs
```

The server:
- Serves the built app (static files from `dist/`) on `:8787`
- Accepts `POST /sync` (JSON session data) and saves to `pi/sessions/<id>.json`
- Handles SPA routing (unmatched paths → `index.html`)

Environment variable to change the port:

```bash
PORT=3000 node pi/sync-server.mjs
```

## Expose over Tailscale HTTPS

Once the server is running locally, expose it to your Tailnet:

```bash
tailscale serve --https=443 http://localhost:8787
```

Get the public HTTPS URL:

```bash
tailscale serve status
```

You'll see a URL like `https://<hostname>.<tailnet>.ts.net`. Copy it and open on your phone (or any device on the Tailnet).

## Use the PWA

1. Open `https://<hostname>.<tailnet>.ts.net` in your phone's browser
2. Tap **Add to Home Screen** (iOS/Android)
3. The app is now installed and works offline
4. Use the in-app **Sync** button to upload session results to the server (no config needed; app and server share the same origin)

Session JSON is saved as `pi/sessions/<session-id>.json`. Download via SCP or view directly on the Pi.

## Running on Boot (systemd)

Create `/etc/systemd/system/aca-assessment.service`:

```ini
[Unit]
Description=ACA Skills Assessment Server
After=network-online.target tailscale.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/skills-assessment
ExecStart=/usr/bin/node /home/pi/skills-assessment/pi/sync-server.mjs
Restart=on-failure
Environment="PORT=8787"

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aca-assessment
```

## Not Just the Pi

This server runs on any machine (Mac, Linux, etc.). If you have the source and Node installed, `node pi/sync-server.mjs` works anywhere on the Tailnet.
