# 🇮🇳 Indian Omegle

Anonymous 1-on-1 text & video chat platform — no login required.

---

## 📁 Folder Structure

```
indian-omegle/
├── package.json
├── README.md
├── server/
│   └── index.js          ← Node.js + Express + Socket.io backend
└── public/
    ├── index.html         ← Main HTML page
    ├── css/
    │   └── style.css      ← All styles (dark/light mode, responsive)
    └── js/
        ├── webrtc.js      ← WebRTC peer connection manager
        └── app.js         ← Main frontend logic
```

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js v18+ installed
- npm v8+

### Steps

```bash
# 1. Navigate into the project folder
cd indian-omegle

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# For development (auto-restart on changes):
npm run dev
```

The server will start at: **http://localhost:3000**

Open two browser tabs/windows to test chatting with yourself.

---

## ✨ Features

| Feature | Status |
|---|---|
| Random 1-on-1 text chat | ✅ |
| WebRTC video chat | ✅ |
| "Next" to find new stranger | ✅ |
| Typing indicator | ✅ |
| Anonymous (no login) | ✅ |
| Country filter | ✅ |
| Report / moderation | ✅ |
| Auto-ban after 3 reports | ✅ |
| Dark / Light mode | ✅ |
| Mobile responsive | ✅ |
| Live user stats | ✅ |

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML + CSS + JavaScript
- **Backend**: Node.js + Express
- **Real-time**: Socket.io (WebSockets)
- **Video**: WebRTC (browser-native)
- **Fonts**: Baloo 2 + Noto Sans (Google Fonts)

---

## 🌐 Deploying to Production

### Render / Railway / Heroku

Set environment variable:
```
PORT=3000
```

For HTTPS (required for video chat in production), deploy behind a reverse proxy (nginx/Cloudflare) or use a platform that provides SSL automatically.

### TURN Server for Video (Production)

For video to work across NAT/firewalls in production, add TURN servers to `public/js/webrtc.js`:

```js
this.iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'password'
    }
  ]
};
```

Free TURN servers: [Metered.ca](https://www.metered.ca/tools/openrelay/)

---

## 📜 Notes

- Video chat works best on **localhost** (no HTTPS needed for local dev).
- For production video, you need **HTTPS** and a **TURN server**.
- The report/ban system uses **in-memory storage** — restarts clear all bans.
- For persistence, replace the Maps with a database (Redis/MongoDB).
