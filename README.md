# MailTap

A local-first desktop email client for Linux and macOS. All your email stays on your machine — no cloud accounts, no third-party servers, no telemetry.

## Features

- **IMAP sync** — works with Gmail, Outlook, Yahoo, iCloud, ProtonMail (IMAP bridge), Fastmail, and any standard IMAP server
- **Full-text search** — searches subject, body, and attachment content (PDFs, Word docs, spreadsheets, and more)
- **AI classification** — local on-device models classify email as spam, phishing, newsletters, invoices, and custom labels you define; no data ever leaves your machine
- **Threat detection** — flags suspicious links and dangerous attachments (executables, scripts) before you click
- **Analytics dashboard** — visualize email volume, classification breakdown, top senders, and sentiment over time
- **Rules engine** — create conditions-based rules to auto-label, star, move to virtual folders, or delete incoming mail
- **Virtual folders** — organize messages into smart folders without touching the server
- **RAG queries** — ask natural language questions about your email using a local LLM (optional)
- **Privacy-first** — everything runs locally; no accounts, no subscriptions, no external dependencies at runtime

## Screenshots

_Coming soon_

## Installation

### Pre-built packages

Download the latest release from the [Releases page](https://github.com/brucevanhorn2/mailtap/releases):

- **Linux**: `.AppImage` (runs anywhere) or `.deb` (Debian/Ubuntu)
- **macOS**: `.dmg` (Intel and Apple Silicon)

### Build from source

**Prerequisites**

- Node.js 20 or later
- npm 10 or later
- On Linux: `libsecret-1-dev` and `python3` (for native module build)
- On macOS: Xcode Command Line Tools

```bash
git clone https://github.com/brucevanhorn2/mailtap.git
cd mailtap

# Install dependencies (skip system-node native build step)
npm install --ignore-scripts

# Rebuild native modules for Electron's ABI
npm run postinstall

# Start in development mode with hot reload
npm run dev
```

To produce a distributable package:

```bash
npm run build:linux   # AppImage + .deb
npm run build:mac     # .dmg (arm64 + x64)
```

## Getting Started

1. Launch MailTap
2. Open **Accounts > Add Account...** and enter your IMAP credentials
   - Gmail: use an [App Password](https://myaccount.google.com/apppasswords) (not your regular password)
   - Most other providers: use your normal email and password
3. MailTap will begin syncing your inbox in the background

## AI Features

AI classification runs entirely on-device using [Transformers.js](https://huggingface.co/docs/transformers.js). No data is sent to any external service.

To enable AI features:

1. Go to **View > Email Analytics**, then open **Settings > AI**
2. Toggle **Enable AI**
3. On first use, models are downloaded once (~90 MB total) and cached locally

Models used:

| Task | Model | Size |
|------|-------|------|
| Classification | `Xenova/mobilebert-uncased-mnli` | ~26 MB |
| Sentiment | `Xenova/distilbert-base-uncased-finetuned-sst-2-english` | ~67 MB |
| Embeddings | `Xenova/bge-small-en-v1.5` | ~25 MB |

An optional local LLM can be enabled for natural-language email queries ("chat with your email"). Any GGUF-format model compatible with `node-llama-cpp` can be used.

## Development

```bash
npm run dev          # Start with hot reload
npm run build        # Typecheck + bundle
npm run lint         # ESLint
npm run typecheck    # TypeScript checks (main + renderer)
npm run format       # Prettier
```

### Architecture

Three-process Electron app:

```
Renderer (React/Zustand)
    └── window.mailtap (contextBridge)
         └── ipcRenderer
              └── Main process (Node.js)
                   ├── IMAP sync (imapflow)
                   ├── SQLite + FTS5 (better-sqlite3)
                   ├── EML file store
                   └── AI pipeline (Transformers.js / node-llama-cpp)
```

- **Main process** — all Node/Electron APIs, file I/O, SQLite, IMAP
- **Renderer** — React 19, Ant Design 5 (dark theme), Zustand 5
- **EML files** — source of truth; SQLite is a queryable index (can be rebuilt)
- **Shared types** — `src/shared/types.ts` is the single source of truth for all cross-boundary interfaces

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 34 |
| UI | React 19, Ant Design 5 |
| State | Zustand 5 |
| Database | better-sqlite3 11 (WAL mode, FTS5, sqlite-vec) |
| IMAP | imapflow |
| Email parsing | mailparser |
| AI (classification/embeddings) | @huggingface/transformers 3 |
| AI (LLM/RAG) | node-llama-cpp 3 |
| Build | electron-vite, electron-builder |

## Contributing

Pull requests are welcome. For significant changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo and create a feature branch
2. Make your changes
3. Run `npm run typecheck && npm run lint` to verify there are no errors
4. Open a pull request

## License

MIT
