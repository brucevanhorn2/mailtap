# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start app with hot reload (electron-vite dev)
npm run build            # Typecheck + bundle (electron-vite build)
npm run start            # Preview production build
npm run lint             # ESLint (JS/TS/TSX files)
npm run typecheck        # Run both node and web typechecks
npm run typecheck:node   # Typecheck main + preload + shared
npm run typecheck:web    # Typecheck renderer + shared
npm run format           # Prettier write
npm run build:linux      # Package for Linux (AppImage + deb)
npm run build:mac        # Package for macOS (dmg)
```

**Native module rebuild** (required after `npm install`):
```bash
npm install --ignore-scripts   # Skip system node build
npm run postinstall            # Rebuilds better-sqlite3 for Electron's ABI
```

## Architecture Overview

Three-process Electron app with strict IPC isolation:

```
Renderer (React/Zustand) → window.mailtap → Preload Bridge → ipcRenderer → Main Process → Services → SQLite + EML Files
                                                                               ↑
                                                         win.webContents.send (push events)
```

### Process Boundaries

- **Main** (`src/main/`): All Node/Electron APIs, file I/O, SQLite, IMAP
- **Preload** (`src/preload/index.ts`): Exposes `window.mailtap.invoke()` (RPC) and `window.mailtap.on()` (event subscriptions) via `contextBridge`. No direct Node in renderer.
- **Renderer** (`src/renderer/src/`): React 19, Ant Design (dark theme), Zustand stores. No Node access.
- **Shared** (`src/shared/types.ts`): All cross-boundary TypeScript interfaces. Single source of truth for types.

### IPC Pattern

Request-response: `window.mailtap.invoke('channel:action', ...args)` → `ipcMain.handle('channel:action', handler)` in the corresponding `src/main/ipc/*.ipc.ts` file.

Push events (main → renderer): `win.webContents.send('sync:progress' | 'sync:complete' | 'sync:error' | 'mail:new-messages')`. Renderer subscribes via `window.mailtap.on(channel, cb)`.

All IPC handlers are registered by `registerAllIpc()` in `src/main/ipc/index.ts`.

### IPC Channels

| Prefix | File | Channels |
|--------|------|----------|
| `account:*` | `account.ipc.ts` | list, add, remove, update, test-connection, oauth-start |
| `sync:*` | `sync.ipc.ts` | start, stop, status |
| `mail:*` | `mail.ipc.ts` | list, get, get-body, mark-read, delete, save-attachment |
| `mailbox:*` | `mailbox.ipc.ts` | list, unread-counts |
| `search:*` | `search.ipc.ts` | query, suggest |
| `settings:*` | `settings.ipc.ts` | load, save |

### Main Process Services

- **ImapSyncService** — manages one `ImapWorker` per account
- **ImapWorker** — IMAP sync loop: connect → full sync → IDLE (28-min RFC timeout) → reconnect; emits push events; exponential backoff on errors
- **MailRepository** — all SQLite queries (prepared statements)
- **StorageService** — DB init, schema, WAL mode, FTS5
- **EmlStore** — read/write `.eml` files at `{userData}/mail/{accountId}/{YYYY}/{MM}/{uuid}.eml`
- **AccountService** — account CRUD using electron-store; credentials encrypted with `safeStorage`
- **IndexRebuildService** — rebuilds SQLite index from EML files on disk

### Storage Strategy

- **EML files** are the source of truth. SQLite is a queryable index only.
- SQLite DB at `{userData}/mailtap.db`, WAL mode, FTS5 for full-text search
- Settings: `electron-store` key `mailtap-settings`
- Credentials: `electron-store` key `mailtap-credentials` (safeStorage encrypted)

### Renderer State (Zustand)

Five stores in `src/renderer/src/store/`:
- `accountStore` — accounts list
- `mailStore` — messages[], selected message ID, active mailbox, pagination
- `syncStore` — `Record<accountId, SyncStatus>` (updated by push events)
- `searchStore` — search modal state, query, results
- `uiStore` — sidebar visibility/width, display preferences

Business logic lives in custom hooks (`src/renderer/src/hooks/`) that combine store access with `window.mailtap.invoke` calls.

### Build Config

- `electron.vite.config.ts` uses `externalizeDepsPlugin()` (deps not bundled, required at runtime)
- Path aliases: `@shared` → `src/shared/`, `@renderer` → `src/renderer/src/`
- TypeScript is split: `tsconfig.node.json` (main + preload) and `tsconfig.web.json` (renderer)
- Output: `out/main/`, `out/preload/`, `out/renderer/`

## Critical Version Constraints

- **better-sqlite3 must be `^11`** — v9 fails to compile against Electron 34/Node 24 ABI
- **imapflow**: Use `ListResponse` type, not `ListedMailbox` (removed in 1.0.169+)
- Electron 34 requires `contextIsolation: true`, `nodeIntegration: false`
