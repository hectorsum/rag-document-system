# RAG Document Intelligence Platform

Ask questions about your PDF documents using AI. Upload files, get embeddings stored in Pinecone, and chat with Claude about the content with source citations.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, Tailwind CSS v4, React Query |
| Backend | NestJS, Prisma v7, PostgreSQL (Supabase) |
| AI | Claude Sonnet 4.5 (streaming), Xenova/all-MiniLM-L6-v2 embeddings (local) |
| Vector DB | Pinecone (384-dim, cosine) |
| Storage | Supabase Storage |
| Auth | JWT (7-day tokens) |

## Project Structure

```
RAG-Documents/
├── rag-app/                Next.js 16 frontend
│   └── src/
│       ├── app/            Pages (App Router)
│       ├── components/     UI components
│       ├── hooks/          React Query hooks
│       ├── lib/            Axios API client
│       └── types/          Shared TypeScript types
├── rag-backend/            NestJS backend
│   ├── prisma/             Schema
│   └── src/
│       ├── modules/
│       │   ├── auth/       JWT auth (register + login + /me)
│       │   ├── documents/  Upload, list, delete, status polling
│       │   ├── rag/        Embedding · LLM · Vector DB · Orchestrator
│       │   ├── chat/       Sessions + SSE streaming messages
│       │   └── analytics/  Cost tracking + usage stats
│       ├── prisma/         PrismaService (pg adapter)
│       └── common/         Guards · Interceptors · Types
└── .github/workflows/      CI/CD pipelines
```

## Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com) project — PostgreSQL DB + Storage bucket named `documents`
- [Pinecone](https://pinecone.io) index — 384 dimensions, cosine metric
- [Anthropic](https://console.anthropic.com) API key

## Local Development

### Backend

```bash
cd rag-backend
cp .env.example .env   # fill in your keys
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

Runs at `http://localhost:3001`. Swagger docs: `http://localhost:3001/api/docs`.

### Frontend

```bash
cd rag-app
# set NEXT_PUBLIC_API_URL=http://localhost:3001 in .env.local
npm install
npm run dev
```

Runs at `http://localhost:3000`.

## Environment Variables

### Backend (`rag-backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: `documents`) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX_NAME` | Pinecone index name |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `JWT_SECRET` | ≥32-char secret for JWT signing |
| `PORT` | Backend port (default: `3001`) |
| `CORS_ORIGIN` | Allowed frontend origin (default: `*`) |

### Frontend (`rag-app/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL |

## Docker

```bash
# from project root — builds both services
docker compose up --build
```

## Deployment

### Backend → Railway

1. Create a new Railway service pointing to the `rag-backend` directory.
2. Add all backend env vars in the Railway Variables panel.
3. Railway reads `railway.toml` and uses the Dockerfile automatically.

### Frontend → Vercel

1. Import the `rag-app` directory into Vercel.
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL.
3. Vercel reads `vercel.json` — every push to `main` triggers a deploy.

### GitHub Actions Secrets

| Secret | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Frontend build-time API URL |
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |

## RAG Pipeline

```
PDF upload
  → text extraction (pdfjs-dist legacy build)
  → chunking (500-token chunks, 50-token overlap)
  → embeddings (MiniLM-L6-v2, 384 dims)
  → Pinecone upsert

User question
  → embed question
  → Pinecone similarity search (top-5, score > 0.3)
  → context assembly
  → Claude Sonnet 4.5 (streaming SSE)
  → answer + source citations + cost recorded
```

## API Overview

Full interactive docs at `/api/docs`.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current user info |
| POST | `/documents/upload` | Upload PDF |
| GET | `/documents` | List documents |
| GET | `/documents/:id/status` | Processing status |
| DELETE | `/documents/:id` | Delete document + vectors |
| GET | `/chat/sessions` | List chat sessions |
| POST | `/chat/sessions` | New session |
| GET | `/chat/sessions/:id` | Session + messages |
| GET | `/chat/sessions/:id/stream` | SSE chat stream |
| DELETE | `/chat/sessions/:id` | Delete session |
| GET | `/analytics/costs` | Cost summary (30 days) |
| GET | `/analytics/usage` | Usage stats |
| GET | `/health` | Service health check |
