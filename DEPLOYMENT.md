# Production Deployment Guide (Django + Gemini Enterprise RAG)

This guide describes how to deploy the **Secure Internal Knowledge Hub** to production using Python 3.13, Django 5.2, PostgreSQL, Gunicorn, and Google Gemini / Anthropic Claude.

---

## 1. Prerequisites & Cloud Accounts

- **Python 3.13+ runtime**
- **PostgreSQL 16+** (with `pgvector` extension for production vector search)
- **Google Gemini API Key** (`GEMINI_API_KEY`) or **Anthropic API Key** (`ANTHROPIC_API_KEY`)
- **Web Host**: AWS ECS / App Runner, Google Cloud Run, Render, Railway, Fly.io, or DigitalOcean

---

## 2. Environment Variables Configuration

Configure the following environment variables in your production environment:

```env
# Django Settings
DJANGO_SECRET_KEY=generate-a-strong-random-secret-key-for-prod
DJANGO_DEBUG=False
ALLOWED_HOSTS=hub.yourdomain.com,api.yourdomain.com

# Database (PostgreSQL)
# Format: postgres://USER:PASSWORD@HOST:PORT/NAME
DATABASE_URL=postgres://hub_user:securepassword@db.yourdomain.com:5432/knowledge_hub

# LLM Providers (Priority: Gemini -> Claude -> Local Synthesizer)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash

# Optional Anthropic Claude Fallback
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Dedicated Embedding Provider (mock | google | openai)
EMBEDDING_PROVIDER=google
EMBEDDING_MODEL=text-embedding-004

# RAG & Retrieval Tuning
RAG_SIMILARITY_THRESHOLD=0.35
RAG_MAX_CHUNKS=6
RAG_MAX_CONTEXT_TOKENS=3500
RAG_HYBRID_SEARCH_ENABLED=true
MAX_UPLOAD_FILE_SIZE_MB=25
```

---

## 3. Database Migration & Initialization

```bash
# Activate virtual environment
source .venv/bin/activate

# Apply migrations to PostgreSQL
python manage.py migrate

# (Optional) Seed initial demo organization and SOP baseline
python manage.py seed_data
```

---

## 4. Running in Production with Gunicorn & WhiteNoise

```bash
# Install production WSGI server
pip install gunicorn

# Collect static assets
python manage.py collectstatic --noinput

# Run Gunicorn WSGI workers
gunicorn knowledge_hub.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --threads 2 \
  --timeout 60 \
  --access-logfile - \
  --error-logfile -
```

---

## 5. Automated Health Check & Monitoring

- **HTTP Liveness Probe**: `GET /chat/` (returns 200 OK)
- **System Verification**: `python manage.py check --deploy`
- **Security Audit Logs**: Monitored in real time at `/audit/`
