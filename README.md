# Moonmoss Arena Online

This is the online two-player edition. It includes a WebSocket game server, a first-available-player matchmaking queue, and server-authoritative movement, spells, damage, and rounds.

## Run locally

Install Node.js 20 or newer, then in this folder run:

```sh
npm install
npm start
```

Open `http://localhost:3000` in two browser windows (or two different devices on the same network). Enter a name in each and press **Find random opponent**.

## Publish it

1. Create a new GitHub repository and upload this whole folder.
2. Create a **Web Service** on a host that supports persistent Node.js WebSocket servers, such as Render, Railway, or Fly.io.
3. Connect the repository and use these settings:
   - Build command: `npm install`
   - Start command: `npm start`
   - Port: supplied by the host through the `PORT` environment variable (already supported).
4. Copy the public URL the host gives you and share it. Players visiting that one URL will be paired automatically.

Do not use a static-only host for this project: real-time matches need the included server to stay running.
