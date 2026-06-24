# NovaSift

An intelligent desktop client that uses AI to automatically categorize, triage, and organize your chaotic Gmail inbox.

Built with Electron, React, TypeScript, SQLite, and the Gmail API.

---

## Why this exists

Busy inboxes mix important mail with newsletters, promotions, notifications, and receipts. NovaSift:

- Surfaces **important** and **action-required** mail first
- Groups everything else by **category** (work, personal, newsletters, etc.)
- Lets you **label senders** so future mail from them is handled your way
- Keeps everything **local** on your machine with optional Gmail label sync

---

## Features

| Feature | Description |
|---------|-------------|
| **Gmail OAuth** | Desktop OAuth flow; tokens encrypted at rest |
| **AI classification** | OpenAI assigns importance + category + action flag |
| **Grouped inbox** | View by importance, category, or all mail |
| **Sender rules** | Match by exact email or entire domain; applies retroactively |
| **Manual overrides** | Change importance/category per message |
| **Gmail label sync** | Optional `AI/*` labels in Gmail (toggle in Settings) |
| **Background sync** | Polls Gmail on an interval; incremental updates via History API |
| **System tray** | Sync now, open app, quit |

---

## Screenshots & UI

The app has four main areas:

1. **Onboarding** — Connect Gmail
2. **Inbox** — Message list + detail panel with AI reasoning
3. **Senders** — Frequent senders and rule management
4. **Settings** — OpenAI key, sync options, label sync toggle

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Desktop | Electron 33 |
| UI | React 18 + TypeScript + Tailwind CSS |
| Build | electron-vite + Vite 5 |
| Local DB | SQLite (`better-sqlite3`) |
| Gmail | Gmail API v1 (`googleapis`) |
| AI | OpenAI API (structured JSON output) |

---

## Prerequisites

- **Node.js 18+**
- **macOS** (primary target; Electron supports Windows/Linux too)
- A **Google Cloud** project with Gmail API enabled
- An **OpenAI API key** with billing enabled

---

## Quick start

### 1. Clone and install

```bash
cd gmail-ai-organizer
npm install
```

`postinstall` downloads Electron and rebuilds native modules for SQLite.

### 2. Google Cloud setup

#### a) Create a project

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (note the **Project ID**)

#### b) Enable Gmail API

1. Go to **APIs & Services → Library**
2. Search **Gmail API** → **Enable**

Or use the direct link (replace `YOUR_PROJECT_NUMBER`):

```
https://console.developers.google.com/apis/api/gmail.googleapis.com/overview?project=YOUR_PROJECT_NUMBER
```

#### c) OAuth consent screen

1. **APIs & Services → OAuth consent screen**
2. User type: **External** (or Internal for Workspace)
3. Fill app name, support email, developer contact
4. **Scopes** — add:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
5. **Test users** — add every Gmail address you will sign in with  
   (Required while the app is in **Testing** mode)

#### d) Create OAuth credentials

1. **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth client ID**
3. Application type: **Desktop app**
4. **Download JSON**
5. Save as `credentials.json` in the project root:

```bash
cp ~/Downloads/client_secret_*.json ./credentials.json
```

The file must contain an `"installed"` block (Desktop app format). See `credentials.json.example`.

### 3. Run the app

```bash
npm run dev
```

### 4. First-time setup in the app

1. Click **Connect Gmail** — complete OAuth in the browser
2. Open **Settings** → paste your **OpenAI API key** → **Save**
3. Click **Sync now** in the status bar
4. Browse mail under **Inbox** (group by importance or category)

---

## Configuration

Settings are stored locally in SQLite and editable in the app:

| Setting | Default | Description |
|---------|---------|-------------|
| OpenAI model | `gpt-4o-mini` | Or `gpt-4o` for higher accuracy |
| Sync interval | 5 min | Background Gmail poll frequency |
| Lookback days | 30 | How far back the first sync fetches |
| Gmail label sync | Off | Mirror classifications to `AI/*` labels |
| Pause AI | Off | Fetch mail without classifying |

Optional: set `OPENAI_API_KEY` in a `.env` file at the project root (see `.env.example`).

---

## How classification works

For each new message:

1. **Sender rule** is checked first (your rules always win)
2. If no rule → **OpenAI** analyzes from, subject, snippet, and body text
3. Result is saved locally with a one-line **reason**

### Importance levels

- **Critical** — urgent, needs immediate attention
- **High** — important
- **Medium** — normal
- **Low** — can wait

### Categories

Work · Personal · Newsletters · Promotional · Transactional · Finance · Social · Notifications · Spam-like · Low Priority

### Sender rules

On the **Senders** tab, pick a frequent sender and create a rule:

- **Exact email** — e.g. `boss@company.com`
- **Entire domain** — e.g. `@stripe.com`

Rules apply to **existing** cached messages and all **future** mail from that sender.

---

## Gmail label sync (optional)

When enabled in Settings, the app creates labels like:

- `AI/Work`, `AI/Newsletters`, …
- `AI/Importance/High`, `AI/Importance/Critical`, …
- `AI/Action Required`

Labels are **added** to messages; messages are **not** removed from INBOX.

---

## Project structure

```
gmail-ai-organizer/
├── electron/
│   ├── main.ts              # App lifecycle, IPC, system tray
│   ├── preload.ts           # Secure bridge to renderer
│   ├── shared/types.ts      # Shared TypeScript types
│   ├── services/
│   │   ├── gmail.ts         # OAuth, fetch, labels
│   │   ├── classifier.ts    # OpenAI classification
│   │   ├── sender-rules.ts  # Rule matching
│   │   ├── label-sync.ts    # Gmail label mirror
│   │   ├── sync-pipeline.ts # Sync + classify orchestration
│   │   └── db.ts            # SQLite schema & queries
│   └── workers/
│       └── sync-worker.ts   # Background sync loop
├── src/                     # React UI
│   ├── App.tsx
│   ├── pages/               # Inbox, Senders, Settings, Onboarding
│   ├── components/
│   └── hooks/
├── credentials.json         # Your OAuth file (gitignored)
├── credentials.json.example
└── package.json
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start app in development mode |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run pack` | Build unpackaged app in `release/` |
| `npm run dist` | Build macOS `.dmg` installer |

---

## Troubleshooting

### `credentials.json not found`

- Download OAuth **Desktop app** JSON from Google Cloud
- Save as `/path/to/project/credentials.json`
- Google often names it `client_secret_....json` — rename or copy it

### `Error 403: access_denied`

Your Gmail is not a **Test user** on the OAuth consent screen. Add it under **APIs & Services → OAuth consent screen → Test users**.

### `Gmail API has not been used in project ... or it is disabled`

Enable Gmail API: [API Library](https://console.cloud.google.com/apis/library/gmail.googleapis.com) → **Enable** → wait 2–5 minutes.

### Sync is slow

First sync fetches up to **30 days** of mail (configurable). This can take several minutes for large inboxes because:

- Each message is fetched individually from Gmail
- AI classification runs per message (needs OpenAI key)

**Tips:**

- Add your OpenAI API key in Settings before syncing
- Lower **Lookback days** in Settings (e.g. 7) for a faster first sync
- Mail appears in the inbox before all classification finishes — watch the status bar for progress

### `OpenAI API key not configured`

Go to **Settings**, paste your key (`sk-...`), and **Save**.

### Classification errors

- Verify API key and billing at [platform.openai.com](https://platform.openai.com/)
- Try `gpt-4o-mini` (cheaper, default) if rate limits hit

---

## Security & privacy

- `credentials.json`, `token.enc`, and API keys are **gitignored**
- OAuth refresh tokens encrypted via Electron `safeStorage` (macOS Keychain)
- Renderer process has **no Node.js access** — all Gmail/OpenAI calls go through the main process over IPC
- Email content sent to OpenAI is limited to metadata + truncated body for classification
- All classifications and rules are stored in a local SQLite database under your user data folder

---

## Data storage

| Data | Location |
|------|----------|
| SQLite DB | `~/Library/Application Support/gmail-ai-organizer/gmail-organizer.db` |
| OAuth token | `~/Library/Application Support/gmail-ai-organizer/token.enc` |
| Settings | Inside SQLite `settings` table |

---

## License

MIT
