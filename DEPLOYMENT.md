# Production Deployment Guide

This guide describes how to deploy the **Secure Internal Knowledge Hub** to production using Supabase (PostgreSQL + pgvector), Anthropic Claude API, and Vercel or Docker.

---

## 1. Prerequisites & Cloud Accounts

- **Supabase Account** (or self-hosted PostgreSQL 16+ with `pgvector` and `uuid-ossp`)
- **Anthropic API Key** (for Claude 3.5 Sonnet / Haiku generation)
- **OpenAI API Key** (for `text-embedding-3-small` or Voyage embeddings)
- **Vercel** or container host (AWS ECS, Google Cloud Run, Railway, or Fly.io)

---

## 2. Supabase / PostgreSQL Setup

### Step A: Enable Extensions & Run Migrations
In your Supabase SQL Editor or via Supabase CLI (`supabase db push`), execute the migrations in order:

1. `supabase/migrations/20261010000001_initial_schema.sql`
2. `supabase/migrations/20261010000002_rls_policies.sql`

This sets up:
- The `vector(1536)` IVFFlat cosine index
- All tenant isolation tables
- Stored procedure `match_document_chunks_authorized`
- Row Level Security policies

### Step B: Create Private Storage Bucket
In Supabase Dashboard > Storage:
- Create bucket name: `internal-knowledge-documents`
- Set **Public bucket**: `Disabled` (Private)

---

## 3. Environment Variables Configuration

Configure the following environment variables in your deployment environment (e.g. Vercel Project Settings):

```env
# Application Runtime Mode
NEXT_PUBLIC_APP_MODE=supabase

# Supabase Credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_STORAGE_BUCKET=internal-knowledge-documents

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Dedicated Embedding Provider
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=sk-proj-...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# RAG Retrieval Quality Tuning
RAG_SIMILARITY_THRESHOLD=0.55
RAG_MAX_CHUNKS=6
RAG_MAX_CONTEXT_TOKENS=3500
RAG_HYBRID_SEARCH_ENABLED=true
MAX_UPLOAD_FILE_SIZE_MB=15
```

---

## 4. Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Link and deploy
vercel
vercel --prod
```

---

## 5. Deploying with Docker Compose

A standalone Docker Compose configuration is provided for self-hosted infrastructure:

```bash
docker compose up -d
npm run build
npm start
```
