# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Floaty Bub is a React + TypeScript + Capacitor AI chat assistant application with multi-role dialogue, knowledge base management, skills library, voice interaction, and data synchronization. Supports Web and native iOS.

## Common Commands

### Web Development
- `npm run dev` - Start Vite dev server on http://localhost:5173
- `npm run build` - Type check and build for production
- `npm run check` - Run TypeScript type checking only (`tsc -b --noEmit`)
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build locally

### iOS Development (via Capacitor)
- `npm run cap:sync` - Sync web build to iOS project (`npx cap sync`)
- `npm run cap:open:ios` - Open iOS project in Xcode (`npx cap open ios`)
- `npm run cap:run:ios` - Run on iOS device with live reload

### Local Proxy Server (for TTS/search features)
```bash
cd local-server
npm install
npm run dev  # Starts on http://localhost:3001
```

### Data Integrity
- `npm run check-data-integrity` - Validate knowledge base and session data consistency

## Architecture

### Tech Stack
- **Frontend**: React 18.3 + TypeScript 5.8 + Vite 6.3
- **Mobile**: Capacitor 7.4 (iOS only)
- **Styling**: Tailwind CSS 4.1 + DaisyUI 5.0 (themes via CSS variables)
- **State**: Zustand 5.0 with IndexedDB persistence
- **Routing**: React Router DOM 7.3
- **Backend/DB**: Supabase (PostgreSQL + Auth + Realtime)
- **Storage**: AWS S3 / Aliyun OSS / Tencent COS (adapter pattern)

### Local-First Architecture
The app uses a **"Local-First, Cloud-Sync"** strategy:

1. **Read Flow**: UI → Zustand Store → IndexedDB (immediate render) → background Cloud Pull → update Store & IndexedDB
2. **Write Flow**: UI → update Store & IndexedDB → add sync task to queue → DataSyncService pushes to Cloud
3. **Data Isolation**: Sensitive data in IndexedDB is keyed by `user_id` (e.g., `knowledge:bases:{userId}`)

### Directory Structure

```
src/
├── components/         # UI components (PascalCase)
│   ├── auth/
│   ├── navigation/
│   └── [Component].tsx
├── hooks/              # React hooks (camelCase, use* prefix)
├── screens/            # Page-level components (Views)
│   ├── chats/
│   ├── settings/       # Desktop/Mobile view splits
│   └── _debug/         # Debug pages
├── services/           # Business logic (no UI)
│   ├── storage/        # Cloud storage adapters
│   ├── DataSyncService.ts
│   └── knowledgeService.ts
├── store/              # Zustand stores
│   ├── index.ts        # Main store
│   ├── storage.ts      # IndexedDB adapter
│   └── knowledgeStore.ts
├── types/              # Global types
└── utils/              # Utility functions
```

### Naming Conventions
- **React Components**: `PascalCase` (e.g., `UserAvatar.tsx`)
- **Hooks**: `camelCase` with `use` prefix (e.g., `useAuth.ts`)
- **Service Classes**: `PascalCase` (e.g., `DataSyncService.ts`)
- **Service Instances**: `camelCase` (e.g., `knowledgeService.ts`)
- **Constants**: `UPPER_SNAKE_CASE`

### Path Aliases
Always use `@/` alias instead of relative paths:
- ✅ `import { Button } from '@/components/ui/button'`
- ❌ `import { Button } from '../../../components/ui/button'`

Only `./` is allowed for same-directory imports.

## Environment Setup

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Required variables:
   - `VITE_SUPABASE_URL` - Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

3. Optional variables:
   - `VITE_API_SECRET` / `API_SECRET` - For API authentication
   - `VITE_API_BASE_URL` - Production API base URL
   - Storage configs (AWS S3 / Aliyun OSS / Tencent COS)

## Key Services

### DataSyncService (`src/services/DataSyncService.ts`)
Handles offline sync queue, network state listening, and conflict resolution. Queues sync tasks when offline and processes them when connection returns.

### KnowledgeService (`src/services/knowledgeService.ts`)
Manages knowledge base CRUD, caching strategies, and user scope switching.

### StorageService (`src/services/storage/`)
Multi-cloud storage adapter supporting AWS S3, Aliyun OSS, and Tencent COS. Configured via Settings UI.

## Serverless API (Vercel)

API routes in `api/` directory:
- `/api/tts` - TTS proxy with streaming (Fish Audio)
- `/api/search` - Google CSE web search
- `/api/health` - Health check
- `/api/models` - Available models list
- `/api/model-info` - Model details
- `/api/validate-key` - API key validation

## Git Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `chore:` - Build/tooling changes
- `docs:` - Documentation changes
