# System Architecture & Data Flow

This document details the architectural design, component boundaries, and end-to-end data flows for the **Secure Internal Knowledge Hub**.

---

## 1. High-Level System Architecture

```mermaid
graph TD
    subgraph Users["End Users & Personas"]
        Admin["Organization Admin"]
        Editor["Knowledge Editor"]
        Member["Team Member / Employee"]
        External["Unauthorized User"]
    end

    subgraph SecurityGateway["Application Security Boundary"]
        SessionResolver["Session Resolver & Cookie Auth"]
        RBAC["Role-Based Access Controller (Owner/Admin/Editor/Member)"]
    end

    subgraph CoreServices["Server-Only Application Services"]
        IngestionSvc["Ingestion Pipeline Service"]
        RetrievalSvc["Authorized Retrieval Engine"]
        LLMSvc["Claude 3.5 Grounding Service"]
        CitationSvc["Citation Validator"]
        AnalyticsSvc["Analytics Aggregator"]
    end

    subgraph IngestionPipeline["Document Extraction & Chunking"]
        Parser["Parser (PDF / DOCX / MD / TXT)"]
        Normalizer["Whitespace & Heading Normalizer"]
        Chunker["Token-Aware Chunker (Overlap & Page Aware)"]
        Embedder["Embedding Provider (1536-dim)"]
    end

    subgraph StorageLayer["Data & Persistence Tier"]
        Postgres["PostgreSQL DB (Supabase/Local)"]
        PgVector["pgvector IVFFlat Cosine Index"]
        PrivateBucket["Private File Storage (SHA-256)"]
        AuditStream["Immutable Audit Log"]
    end

    Users --> SecurityGateway
    SecurityGateway --> CoreServices
    IngestionSvc --> IngestionPipeline
    IngestionPipeline --> StorageLayer
    RetrievalSvc --> PgVector
    RetrievalSvc --> Postgres
    LLMSvc --> CitationSvc
    CoreServices --> AuditStream
```

---

## 2. Ingestion Pipeline Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Knowledge Admin
    participant API as Documents API
    participant Pipeline as Ingestion Pipeline
    participant Storage as Private Storage
    participant Parser as Extractors (PDF/DOCX/MD)
    participant Chunker as Token Chunker
    participant Embed as Embedding Provider
    participant DB as pgvector & PostgreSQL

    Admin->>API: Upload Document (File, Category, Access Scope)
    API->>API: Verify Role (hasMinimumRole >= editor)
    API->>Pipeline: processDocumentIngestion()
    Pipeline->>Storage: Store original file with SHA256 path
    Pipeline->>DB: Create Document (status: 'uploading') & Job ('validation')
    Pipeline->>Parser: Extract text & section hierarchy
    Parser-->>Pipeline: Extracted sections with headings & pages
    Pipeline->>Chunker: Chunk sections (450 tokens, 60 overlap)
    Chunker-->>Pipeline: Array of prepared chunks
    Pipeline->>Embed: Generate batch embeddings (1536-dim)
    Embed-->>Pipeline: Normalized vector arrays
    Pipeline->>DB: Insert document chunks with embeddings & org_id
    Pipeline->>DB: Update document status ('ready') & Job ('completed')
    Pipeline->>DB: Log DOCUMENT_INGESTED in audit_logs
    Pipeline-->>Admin: Ingestion Success (Ready for authorized queries)
```

---

## 3. Grounded Retrieval & Answer Generation Flow

```mermaid
sequenceDiagram
    autonumber
    actor Employee as Authenticated Employee
    participant ChatAPI as Chat API (/api/chat)
    participant RAG as RAG Service
    participant DB as pgvector Database
    participant Claude as Anthropic Claude 3.5
    participant Validator as Citation Validator

    Employee->>ChatAPI: POST /api/chat (Question, ConversationId)
    ChatAPI->>ChatAPI: Authenticate user & resolve organization
    ChatAPI->>RAG: executeRagPipeline()
    RAG->>DB: Persist User Message
    RAG->>DB: searchAuthorizedChunks(orgId, userId, queryEmbedding)
    Note over DB: Security Filter:\n1. org_id = user.org_id\n2. doc.status = 'ready'\n3. user_can_access_doc(doc.id, user.id)
    DB-->>RAG: Filtered Authorized Evidence Chunks
    
    alt Chunks Empty or Insufficient
        RAG->>DB: Log Unanswered Question in Knowledge Gaps
        RAG-->>Employee: Abstain: "I couldn't find enough information..."
    else Authorized Evidence Available
        RAG->>Claude: Generate Grounded Answer (System Prompt + Evidence)
        Claude-->>RAG: Answer with [CHUNK_ID: <id>] citations
        RAG->>Validator: validateAndExtractCitations(rawAnswer, chunks)
        Validator-->>RAG: Cleaned answer + verified citation objects
        RAG->>DB: Persist Assistant Message + Validated Citations
        RAG->>DB: Record RAG_QUERY_EXECUTED in Audit Logs
        RAG-->>Employee: Grounded Answer + Interactive Source Citations
    end
```

---

## 4. Cloud Connectors Architecture (Google Drive & SharePoint)

```mermaid
graph LR
    subgraph CloudSources["Enterprise Cloud Providers"]
        GDrive["Google Drive (OAuth 2.0 Read-Only)"]
        SharePoint["Microsoft SharePoint / Graph API"]
    end

    subgraph SyncService["Synchronization Worker"]
        Poller["Change Webhook / Delta Sync"]
        AclMapper["Permission & ACL Mapper"]
        DiffEngine["Version Diff & Hash Verifier"]
    end

    subgraph Hub["Knowledge Hub Pipeline"]
        IngestionPipeline["Ingestion Pipeline"]
        PurgeObsolete["Orphan Chunk Purger"]
    end

    CloudSources --> Poller
    Poller --> AclMapper
    AclMapper --> DiffEngine
    DiffEngine -->|New / Modified| IngestionPipeline
    DiffEngine -->|Deleted / Restricted| PurgeObsolete
```
