import json
from django.utils import timezone
from hub.models import (
    Document, DocumentVersion, DocumentChunk, IngestionJob,
    IngestionStage, DocumentStatus, AuditLog, Profile, Organization
)
from hub.services.storage import store_private_file
from hub.services.extraction import extract_document_content
from hub.services.chunking import chunk_document_sections
from hub.services.embeddings import get_embedding_provider

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15MB


def process_document_ingestion(
    org_id: str,
    user_id: str,
    title: str,
    file_name: str,
    mime_type: str,
    file_bytes: bytes,
    category: str = "General",
    access_scope: str = "organization",
    existing_document_id: str = None
) -> dict:
    if not file_bytes:
        raise ValueError("Upload payload is empty.")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File size exceeds maximum limit of 15MB.")

    allowed_exts = {'pdf', 'docx', 'txt', 'md', 'markdown'}
    ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
    if ext not in allowed_exts:
        raise ValueError(f"Unsupported file type: .{ext}. Supported: PDF, DOCX, TXT, MD.")

    org = Organization.objects.get(id=org_id)
    user = Profile.objects.get(id=user_id) if user_id else None

    # Determine or create Document Record
    if existing_document_id:
        document = Document.objects.get(id=existing_document_id, organization=org)
        version_number = (document.current_version_number or 1) + 1
        document.status = DocumentStatus.PROCESSING
        document.save()
    else:
        document = Document.objects.create(
            organization=org,
            title=title,
            category=category,
            access_scope=access_scope,
            status=DocumentStatus.UPLOADING,
            current_version_number=1,
            created_by=user,
        )
        version_number = 1

    # 1. Storage
    storage_info = store_private_file(org_id, str(document.id), version_number, file_name, file_bytes)
    embedding_provider = get_embedding_provider()

    doc_version = DocumentVersion.objects.create(
        document=document,
        version_number=version_number,
        file_name=file_name,
        mime_type=mime_type,
        file_size_bytes=storage_info["file_size_bytes"],
        storage_path=storage_info["storage_path"],
        file_hash=storage_info["file_hash"],
        embedding_model=embedding_provider.model_name,
        embedding_dimension=embedding_provider.dimension,
        created_by=user,
    )

    job = IngestionJob.objects.create(
        organization=org,
        document=document,
        version=doc_version,
        stage=IngestionStage.EXTRACTION,
        status="in_progress",
    )

    try:
        # 2. Extraction
        job.stage = IngestionStage.EXTRACTION
        job.save()
        extraction = extract_document_content(file_bytes, file_name, mime_type)

        # 3. Chunking
        job.stage = IngestionStage.CHUNKING
        job.save()
        prepared_chunks = chunk_document_sections(extraction.sections, max_tokens=450, overlap_tokens=60)

        if not prepared_chunks:
            raise ValueError("No meaningful text extracted from document.")

        # 4. Embedding
        job.stage = IngestionStage.EMBEDDING
        job.save()
        chunk_texts = [c.content for c in prepared_chunks]
        embeddings = embedding_provider.generate_embeddings(chunk_texts)

        # 5. Indexing
        job.stage = IngestionStage.INDEXING
        job.save()

        if existing_document_id:
            # Delete old version chunks
            DocumentChunk.objects.filter(document=document).delete()

        chunk_objs = []
        for idx, (chunk, emb) in enumerate(zip(prepared_chunks, embeddings)):
            chunk_obj = DocumentChunk(
                document=document,
                version=doc_version,
                organization=org,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                token_count=chunk.token_count,
                heading_path=chunk.heading_path,
                page_number=chunk.page_number,
                metadata_json=json.dumps({"file_name": file_name, "version": version_number}),
            )
            chunk_obj.set_embedding(emb)
            chunk_objs.append(chunk_obj)

        DocumentChunk.objects.bulk_create(chunk_objs)

        # Complete
        doc_version.chunk_count = len(chunk_objs)
        doc_version.save()

        document.current_version_number = version_number
        document.status = DocumentStatus.READY
        document.save()

        job.stage = IngestionStage.COMPLETED
        job.status = "completed"
        job.completed_at = timezone.now()
        job.save()

        AuditLog.objects.create(
            organization=org,
            user=user,
            action="DOCUMENT_UPDATED" if existing_document_id else "DOCUMENT_INGESTED",
            entity_type="document",
            entity_id=str(document.id),
            metadata_json=json.dumps({
                "title": document.title,
                "file_name": file_name,
                "version": version_number,
                "chunk_count": len(chunk_objs),
            }),
        )

        return {
            "document": document,
            "job": job,
            "chunk_count": len(chunk_objs),
            "version_number": version_number,
        }

    except Exception as e:
        document.status = DocumentStatus.FAILED
        document.save()

        job.stage = IngestionStage.FAILED
        job.status = "failed"
        job.error_message = str(e)
        job.completed_at = timezone.now()
        job.save()

        AuditLog.objects.create(
            organization=org,
            user=user,
            action="DOCUMENT_INGESTION_FAILED",
            entity_type="document",
            entity_id=str(document.id),
            metadata_json=json.dumps({"file_name": file_name, "error": str(e)}),
        )
        raise e


def retire_document(org_id: str, document_id: str, user_id: str) -> None:
    doc = Document.objects.get(id=document_id, organization_id=org_id)
    doc.status = DocumentStatus.RETIRED
    doc.save()

    user = Profile.objects.get(id=user_id) if user_id else None
    AuditLog.objects.create(
        organization_id=org_id,
        user=user,
        action="DOCUMENT_RETIRED",
        entity_type="document",
        entity_id=str(doc.id),
        metadata_json=json.dumps({"title": doc.title}),
    )
