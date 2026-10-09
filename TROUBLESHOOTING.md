# Troubleshooting & Operations FAQ

This document addresses common operational challenges, error messages, and configuration issues.

---

## 1. Document Extraction & Ingestion

### Q: PDF upload errors with "PDF contains no extractable text"
- **Cause**: The PDF is a scanned image or bitmap without an embedded text layer.
- **Resolution**: Run the document through an OCR pre-processor before upload. The system deliberately rejects empty text extraction to prevent indexing blank chunks.

### Q: DOCX upload fails or formatting is lost
- **Cause**: Password-protected or corrupted Word files.
- **Resolution**: Verify that the document is not encrypted with a password and contains standard Word headings and paragraphs.

---

## 2. Vector Search & Embedding Dimensions

### Q: "Embedding dimension mismatch (expected 1536, got X)"
- **Cause**: Different embedding models have distinct vector dimensions (e.g. `text-embedding-3-small` is 1536-dim, whereas some models are 768 or 3072).
- **Resolution**: Ensure all chunks in the database were indexed with the matching `EMBEDDING_DIMENSION`. When switching embedding providers, re-index existing documents using the re-indexing pipeline.

### Q: The assistant abstains on questions that should be in the document
- **Troubleshooting Steps**:
  1. Check if the document status is `ready` (not `uploading`, `failed`, or `retired`).
  2. Check the user's role: if the document scope is `restricted`, verify whether the user has permission.
  3. Lower the similarity threshold in `.env` (e.g., set `RAG_SIMILARITY_THRESHOLD=0.40`).
  4. Ensure the question includes specific policy terms found in the document.

---

## 3. Database & RLS Permissions

### Q: Supabase error: "Access denied to organization"
- **Cause**: The requesting user is not registered as an active member of the target organization in `organization_memberships`.
- **Resolution**: Verify membership via the Members & Roles tab in the admin dashboard or run `SELECT * FROM organization_memberships WHERE user_id = '...';` in Supabase.

### Q: Vector search RPC not found
- **Cause**: The migration `20261010000002_rls_policies.sql` has not been executed on the PostgreSQL instance.
- **Resolution**: Re-run the SQL migration in Supabase SQL Editor.
