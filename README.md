# AI Chamber Escape — Multiplayer social survival game

**AI Chamber Escape** is a cinematic, tense, and competitive multiplayer drawing game inspired by Skribbl.io mechanics, styled with a premium futuristic sci-fi theme. 

Up to 12 players are sealed inside a high-security AI chamber. One player transmits "survival codes" via neural draw signals (drawing on the canvas) while others crack the codes (guessing in real time through chat). Only the top 3 players verified by the AI core will escape when the final protocol concludes; the rest remain contained.

---

## 🚀 Key features

- **Responsive layout**: Fully optimized for mobile-first views (`aspect-ratio: 1/1` drawing canvas, thumb toolbars, sticky bottom chat, collapsible player drawer) and three-column desktop controls.
- **Batched stroke streams**: Synchronized remote drawing batches coordinate points every 20-25 ms to deliver low-latency visual replication.
- **Local latency minimization**: Drawer strokes render instantly (<16 ms) on the active client canvas without waiting for server network loops.
- **Web Audio API synthesizer**: Programmatic audio engine generates background hum drones, verification chimes, warning counts, and door operations entirely in code (no media assets to download).
- **Persistent rejoining grace**: Players re-uplink within 60 seconds to restore their seats, scores, and verified states.
- **Contextual AI Security Feed**: The AI system core monitors chat answers, times, and errors, outputting alerts like `SUBJECT PRIYA — RESPONSE EFFICIENCY EXCELLENT` to build tension.
- **Redis state integration**: Seamless chamber sessions backup with graceful in-memory falling back for local debugging.

---

## 🛠️ Tech stack

- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + Cyber aesthetic design (glitch keyframes, glassmorphism overlays)
- **Backend**: Node.js + Express
- **Realtime**: Socket.IO
- **State sharing**: Redis (with memory cache fallback)
- **Monorepo setup**: npm workspaces

---

## 📁 Repository layout

```
/
├── package.json (root workspace)
├── docker-compose.yml
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           ├── types.ts (Chamber status structs)
│           ├── events.ts (Strict Socket.IO contracts)
│           └── words.ts (1000 Indian-English words categorized)
└── apps/
    ├── server/
    │   ├── package.json
    │   ├── src/
    │   │   ├── index.ts (Express app & Socket.IO listeners)
    │   │   ├── game.ts (State machine engine)
    │   │   ├── redis.ts (Redis/Memory DB adapter)
    │   │   └── game.test.ts (Unit tests)
    │   └── Dockerfile
    └── web/
        ├── package.json
        ├── index.html
        ├── nginx.conf
        ├── src/
        │   ├── App.tsx (Main client logic)
        │   ├── index.css (CRT glitch animations & cyber palette)
        │   └── components/
        │       ├── AudioSystem.ts (Web Audio synth)
        │       ├── DrawingCanvas.tsx (Pointer event drawer)
        │       └── NeonCore.tsx (Animated AI core)
        └── Dockerfile
```

---

## ⚙️ Environment variables

Create a `.env` file at the root or within workspace folders to configure variables:

```bash
# Server Configuration (apps/server/.env)
PORT=4000
REDIS_URL=redis://localhost:6379 # Omit to fallback to in-memory store

# Web Configuration (apps/web/.env)
VITE_SOCKET_URL=http://localhost:4000
```

---

## 💻 Local setup

To run the application locally, you need [Node.js](https://nodejs.org/) installed.

### 1. Install dependencies
From the root folder, run:
```bash
npm install
```

### 2. Run the application (Developer mode)
Start the frontend and backend concurrently:
```bash
npm run dev
```
- **Web App**: http://localhost:3000
- **Server Gateway**: http://localhost:4000

Alternatively, run them separately:
```bash
# Run server only
npm run dev:server

# Run web client only
npm run dev:web
```

### 3. Run game engine tests
To verify state transitions and scoring calculations:
```bash
npm run test --workspace=apps/server
```

---

## 🐳 Docker orchestration

Build and run all services (Redis, Server, Web client) with Docker Compose:

```bash
# Build & Spin up container services
docker compose up --build

# Run in background
docker compose up -d

# Stop services
docker compose down
```

---

## ☁️ Production deployment

### 1. Fly.io
Deploy the monorepo by exposing the server port and static frontend folder or deploying them as separate apps.
1. Run `fly launch` in `apps/server` and set `REDIS_URL`.
2. Run `fly launch` in `apps/web` to build static Nginx assets.

### 2. Render / Railway
Create two separate services linked to this repository:
1. **Backend Service**:
   - Build command: `npm install && npm run build --workspace=apps/server`
   - Start command: `npm run start`
   - Set environment variables (`PORT`, `REDIS_URL`).
2. **Frontend Service**:
   - Build command: `npm install && npm run build --workspace=apps/web`
   - Publish directory: `apps/web/dist` (static site) or use the Dockerfile to deploy under Nginx.
   - Set `VITE_SOCKET_URL` pointing to your backend address.
# Scribble-AI-Chamber-Escape
