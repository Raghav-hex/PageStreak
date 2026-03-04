# 📚🔥 PageStreak

> Read more. Build streaks. Finish books.

A personal e-reader web app with built-in habit tracking. Upload EPUB or PDF → read in focused 200-word chunks → build daily streaks → hit your page targets.

---

## ✨ Features

- **EPUB & PDF reading** — epub.js renders original formatting, fonts, and images
- **200-word chunks** — 2 chunks = 1 page, auto-calculated on upload
- **TOC navigation** — slide-in drawer to jump anywhere
- **Dark / Light / Sepia themes** — with adjustable font size and column width
- **Swipe + arrow key navigation** — mobile swipe, desktop arrow keys
- **24h rolling streak** — starts from first chunk of each session
- **1 weekly freeze token** — miss a day without breaking your streak
- **GitHub-style heatmap** — 365-day reading activity
- **Daily page target** — set and override per day
- **Per-book stats** — total time, ETA, start/finish dates
- **Library grid/list toggle** — with cover art auto-extracted from EPUB
- **Email/password auth** — forever session until manual logout

---

## 🏗️ Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Zustand |
| EPUB rendering | epub.js (iframe, full fidelity) |
| PDF text | pdfminer.six |
| Backend | FastAPI (Python 3.12) |
| Database | PostgreSQL (books stored as blobs) |
| Auth | JWT (bcrypt passwords, forever tokens) |
| Deployment | Render free tier |
| Monitoring | Sentry (optional) |

---

## 🚀 Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 20+ (for frontend dev)
- Python 3.12+

### Quick Start

```bash
# 1. Clone and configure
git clone <your-repo>
cd pagestreak
cp .env.example .env
# Edit .env if needed

# 2. Start everything
docker-compose up --build

# App: http://localhost:5173
# API: http://localhost:8000
# API Docs: http://localhost:8000/api/docs (DEBUG=true)
```

### Run Without Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # edit DATABASE_URL
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Run Tests

```bash
cd backend
python -m pytest tests/ -v
```

---

## 🌐 Deploy to Render (Free)

1. Push to GitHub
2. Go to [render.com](https://render.com) → **New** → **Blueprint**
3. Connect your repo — Render auto-detects `render.yaml`
4. It will create:
   - `pagestreak-backend` (FastAPI web service)
   - `pagestreak-frontend` (Static site)
   - `pagestreak-db` (PostgreSQL free tier)
5. Set `SENTRY_DSN` manually in backend environment (optional)
6. Deploy! ✅

### ⚠️ Render Free Tier Notes
- Backend **spins down after 15 min inactivity** — first request takes ~30s to wake
- PostgreSQL free tier has **1GB storage** limit — supports ~200 average books
- Static frontend has **unlimited bandwidth**

---

## 📁 Project Structure

```
pagestreak/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   │   ├── auth.py   # Register, login, logout, profile
│   │   │   ├── books.py  # Upload, list, chunks, TOC
│   │   │   └── reading.py # Progress tracking, dashboard, stats
│   │   ├── core/
│   │   │   ├── config.py    # Pydantic settings
│   │   │   ├── database.py  # SQLAlchemy engine
│   │   │   └── security.py  # JWT + bcrypt
│   │   ├── models/
│   │   │   └── user.py   # All DB models (User, Book, Streak, etc.)
│   │   ├── schemas/
│   │   │   └── schemas.py # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── book_processor.py  # EPUB/PDF parsing & chunking
│   │   │   └── streak_service.py  # 24h streak engine
│   │   └── main.py       # FastAPI app entry point
│   ├── alembic/          # DB migrations
│   ├── tests/            # pytest tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── reader/   # EpubReader, Toolbar, TOC, ProgressBar
│   │   │   ├── library/  # Library grid/list view
│   │   │   ├── dashboard/ # Streak, heatmap, progress ring
│   │   │   ├── auth/     # Login/register
│   │   │   └── common/   # Onboarding
│   │   ├── services/
│   │   │   └── api.js    # Axios API client
│   │   ├── store/
│   │   │   └── authStore.js # Zustand auth state
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── render.yaml
└── .env.example
```

---

## 🔧 Configuration

All config via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SECRET_KEY` | — | JWT signing secret (generate randomly!) |
| `DEBUG` | `false` | Enable API docs + verbose logging |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `SENTRY_DSN` | — | Sentry error tracking DSN |
| `MAX_UPLOAD_SIZE_MB` | `100` | Max EPUB/PDF upload size |

---

## 📖 Streak Engine

```
Every chunk navigated forward:
  → Log timestamp + reading_log entry
  → Recalculate pages today (chunks // 2)
  → If pages_today >= daily_target → streak is active

On app load / dashboard:
  → now - last_active_at > 24h?
     YES → freeze token available?
              YES → consume token, streak preserved 🧊
              NO  → streak resets to 1 💔
     NO  → streak alive ✅

Every Monday 00:00 UTC:
  → freeze_tokens_remaining resets to 1
```

---

## 🛠️ Development Notes

**Adding new EPUB features**: See `backend/app/services/book_processor.py`

**Chunk size**: Defined as `WORDS_PER_CHUNK = 200` in `book_processor.py`

**Page definition**: `WORDS_PER_PAGE = 400` (2 chunks)

**Themes**: Defined in `frontend/src/components/reader/EpubReader.jsx` `THEMES` object

---

## 📝 License

MIT
