# ACA Skills Assessment — Raspberry Pi Server

Run the offline-first PWA on a Raspberry Pi (or any machine) over Tailscale HTTPS.

## Prerequisites

- Node.js >= 20
- Tailscale installed and logged in on the Pi

## Build the App

```bash
cd skills-assessment
npm install
npm run build
```

This creates `dist/` with the compiled app.

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
