import os
import re
from dataclasses import dataclass
from typing import List, Optional
import numpy as np
from hub.models import DocumentChunk, OrganizationMembership, Profile, Document
from hub.services.embeddings import get_embedding_provider, STOP_WORDS
from hub.services.rbac import can_access_document


@dataclass
class RetrievalResult:
    chunk_id: str
    document_id: str
    version_id: str
    document_title: str
    heading_path: str
    page_number: int
    content: str
    similarity: float
    token_count: int


@dataclass
class RetrievalContext:
    results: List[RetrievalResult]
    context_text: str
    total_tokens: int


def cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    va = np.array(a, dtype=np.float32)
    vb = np.array(b, dtype=np.float32)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(va, vb) / (norm_a * norm_b))


def compute_keyword_score(text: str, query: str) -> float:
    if not text or not query:
        return 0.0
    words = [
        w for w in re.split(r'\W+', query.lower())
        if len(w) > 2 and w not in STOP_WORDS
    ]
    if not words:
        return 0.0
    lower_text = text.lower()
    matches = 0
    for w in words:
        stem = w[:4] if len(w) > 4 else w
        if w in lower_text or stem in lower_text:
            matches += 1
    return min(1.0, matches / min(len(words), 3))


def retrieve_authorized_context(
    org_id: str,
    user_id: str,
    query: str,
    threshold: float = 0.45,
    max_chunks: int = 6,
    enable_hybrid: bool = True
) -> RetrievalContext:
    # 1. Resolve user membership & role
    try:
        membership = OrganizationMembership.objects.select_related('user').get(
            organization_id=org_id,
            user_id=user_id,
            is_active=True
        )
    except OrganizationMembership.DoesNotExist:
        # Unauthorized access to organization
        return RetrievalContext(results=[], context_text="", total_tokens=0)

    # 2. Query embedding
    embedding_provider = get_embedding_provider()
    query_vector = embedding_provider.generate_query_embedding(query)

    # 3. Fetch candidate chunks for active organization
    # Document status must be 'ready'
    chunks_qs = DocumentChunk.objects.select_related('document').filter(
        organization_id=org_id,
        document__status='ready'
    )

    scored_results = []

    for chunk in chunks_qs:
        # Enforce document-level access permissions
        doc = chunk.document
        if not can_access_document(membership.role, user_id, membership.department, doc):
            continue

        chunk_vector = chunk.get_embedding()
        sim = cosine_similarity(query_vector, chunk_vector)

        if enable_hybrid:
            kw = compute_keyword_score(chunk.content, query)
            sim = max(sim, kw * 0.70 + sim * 0.30)

        if sim >= threshold:
            scored_results.append((
                sim,
                RetrievalResult(
                    chunk_id=str(chunk.id),
                    document_id=str(doc.id),
                    version_id=str(chunk.version_id),
                    document_title=doc.title,
                    heading_path=chunk.heading_path or "General",
                    page_number=chunk.page_number or 1,
                    content=chunk.content,
                    similarity=sim,
                    token_count=chunk.token_count,
                )
            ))

    # Sort descending by score
    scored_results.sort(key=lambda x: x[0], reverse=True)
    selected = [r[1] for r in scored_results[:max_chunks]]

    # 4. Construct bounded evidence text
    total_tokens = sum(r.token_count for r in selected)
    context_sections = [
        f'--- SOURCE DOCUMENT: "{r.document_title}" | SECTION: "{r.heading_path}" | PAGE: {r.page_number} | CHUNK_ID: {r.chunk_id} ---\n{r.content}\n'
        for r in selected
    ]
    context_text = "\n\n".join(context_sections)

    return RetrievalContext(
        results=selected,
        context_text=context_text,
        total_tokens=total_tokens,
    )
