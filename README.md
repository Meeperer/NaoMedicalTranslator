# NaoMedical — Doctor–Patient Translation

**NaoMedical-Chat-Translator** · A full-stack web application that acts as a real-time translation bridge between a doctor and a patient.
---

## Project overview

NaoMedical is a healthcare-focused web app that lets a **doctor** and a **patient** communicate across language barriers. Each user chooses a role (Doctor or Patient) and a language. Text messages are translated into the other party's language in near real time, and conversations are logged so they can be searched and summarized later.

**Features:** text chat, audio recording (stored and playable in the thread), keyword search across conversations, AI-generated medical summary (symptoms, diagnoses, medications, follow-up), and **conversation names** (auto-generated when summarizing; editable by users). Conversation updates use **polling** (every 3 seconds).

---

## Features attempted and completed

| Feature | Status | Notes |
| :--- | :---: | :--- |
| Real-time doctor–patient translation | Done | Two roles; debounced preview; translation on send; polling for updates |
| Text chat interface | Done | Doctor (teal) vs Patient (blue); translated on top, original below |
| Audio recording & storage | Done | MediaRecorder; upload to server; playable in thread with duration |
| Conversation logging | Done | Text and audio in MongoDB with timestamps; persists across sessions |
| Conversation search | Done | Keyword/phrase search; highlighted excerpt and context; link to conversation |
| AI-powered medical summary | Done | Groq LLM; optional `GROQ_API_KEY` (free at [console.groq.com](https://console.groq.com)) |
| Conversation names | Done | Auto-generated when summarizing; editable in chat; shown on conversations list with language pair |

---

## Tech stack used

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, Vite, React Router, CSS variables |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Translation | [MyMemory API](https://mymemory.translated.net/) (free, no key) |
| AI summary | [Groq](https://console.groq.com/) (Llama 3.1 8B Instant) |
| Real-time | Polling (every 3 s) |
| Audio | MediaRecorder, Multer, `server/uploads` |
| Deployment | Vercel (frontend + API serverless; no WebSockets — polling only), MongoDB Atlas, Vercel Blob (audio) |

---

## AI tools and resources leveraged

- **Translation:** MyMemory REST API (no API key).
- **Language detection:** Heuristic when “auto” is requested.
- **Medical summary:** Groq API (`groq-sdk`), medical-scribe prompt, model `llama-3.1-8b-instant`.
- **Prototyping:** Figma & Canva.
- **ChatGPT and other Ai sites** Used for researching.
- **Google Translate** Proof Checking of translated words.

---

## Security

- **Secrets:** Never commit `.env` or real API keys. Use `server/.env` locally (copy from `.env.example`) and set environment variables in your host (Vercel, Render) for production. `.gitignore` excludes `.env`, `.env.local`, and `server/.env`.
- **API keys:** `GROQ_API_KEY` and `MONGODB_URI` are read only on the server; they are never sent to the client or logged.
- **Errors:** In production, API error responses use generic messages so internal details (paths, stack traces) are not exposed to clients.

---

## Known limitations, trade-offs, or unfinished parts

- **Audio:** Stored and played only; no speech-to-text or translation.
- **AI summary:** Optional; requires `GROQ_API_KEY` in `server/.env`.
- **Search:** Submit-to-search only; one excerpt per message.
- **Deployment:** When running the backend separately (e.g. Render), set `VITE_API_URL` so the frontend can reach it.
- **Serverless (Vercel):** See [Serverless limitations](#serverless-limitations-vercel) below (no WebSockets, cold starts, Blob for audio).

---

## Prerequisites

- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier)
- (Optional) [Groq API key](https://console.groq.com/) for “Generate summary”

---

## Setup (local)

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/naomedical.git
cd naomedical
npm run install:all
```

### 2. Backend environment

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:

- `PORT` — server port (default `5000`)
- `MONGODB_URI` — MongoDB connection string
- `GROQ_API_KEY` — (optional) for “Generate summary”
- `NODE_ENV` — `development` or `production`

### 3. Run locally

From project root:

```bash
npm run dev
```

- Backend: http://localhost:5000 (API)
- Frontend: http://localhost:3000 (proxies `/api`, `/uploads` to backend)

---

## Deployment (Vercel — full-stack, backend on Vercel)

**Default:** Frontend and backend both run on [Vercel](https://vercel.com). The React app is served from `client/dist`; the Express API runs as **serverless functions** under `/api/*`. Audio uploads use [Vercel Blob](https://vercel.com/docs/storage/vercel-blob).

### Serverless limitations (Vercel)

When the backend runs on Vercel, it runs as **serverless functions**, not a long-lived Node process. That implies:

| Limitation | Effect |
| :--- | :--- |
| **No WebSockets** | Serverless functions are request/response only; there is no persistent connection. The app uses **polling** (GET `/api/conversations/:id` every 3 seconds) for new messages and updates. |
| **Cold starts** | The first request after idle (or after deploy) can take a few seconds while the function boots. Later requests are faster. |
| **Execution timeout** | Functions have a max execution time (e.g. 10–60 s depending on plan). Long-running work (e.g. big summaries) must finish within that window. |
| **No persistent disk** | The function filesystem is read-only and not shared between invocations. Audio uploads **must** use [Vercel Blob](https://vercel.com/docs/storage/vercel-blob); the app does this when `VERCEL` is set. |
| **Stateless** | Each request is a new invocation. Session state lives in the database (MongoDB), not in memory. |

## Project structure

```
naomedical/
├── api/                    # Vercel serverless: all /api/* requests
│   ├── catchall.js         # Main handler (rewrite sends /api/:path* here)
│   ├── health.js           # GET /api/health (standalone)
│   └── [[...path]].js      # Legacy catch-all (optional; catchall.js used via rewrite)
├── client/
│   ├── src/
│   │   ├── components/     # Layout, ChatMessage, AudioRecorder
│   │   ├── pages/          # Home, Chat, Search, Landing
│   │   ├── api.js          # API client (BASE = /api or VITE_API_URL + /api)
│   │   └── App.jsx
│   └── vite.config.js      # Dev proxy: /api, /uploads → backend
├── server/                  # Express app (runs as serverless on Vercel or standalone)
│   ├── config/             # Multer (disk locally; memory + Vercel Blob on Vercel)
│   ├── models/             # Conversation (Mongoose)
│   ├── routes/             # conversations, ai
│   ├── services/           # translate, openai (Groq), detect
│   ├── utils/               # safeError (client-safe messages in production)
│   └── uploads/             # local only (Vercel uses Blob)
├── vercel.json             # Build, output dir, rewrites (/api/* → catchall)
├── render.yaml              # Optional: backend-only on Render (rootDir: server)
├── package.json
└── README.md
```

---

## API overview

| Endpoint | Method | Description |
| :--- | :---: | :--- |
| `/api/conversations` | GET | List conversations (includes `name`, language pair) |
| `/api/conversations` | POST | Create (body: `doctorLanguage`, `patientLanguage`) |
| `/api/conversations/:id` | GET | Get one conversation |
| `/api/conversations/:id` | PATCH | Update conversation name (body: `name`) |
| `/api/conversations/:id/messages` | POST | Add text (body: `role`, `content`) |
| `/api/conversations/:id/audio` | POST | Upload audio (form: `audio`, `role`, `duration`) |
| `/api/conversations/search?q=...` | GET | Search conversations |
| `/api/ai/translate` | POST | Translate (body: `text`, `fromLang`, `toLang`) |
| `/api/ai/summarize/:conversationId` | POST | Generate medical summary and conversation name (Groq) |
| `/api/health` | GET | Health check (no DB); returns `{ ok, vercel }` |

---

