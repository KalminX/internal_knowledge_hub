import re
from dataclasses import dataclass
from typing import List, Set
from hub.services.retrieval import RetrievalResult


@dataclass
class ValidatedCitation:
    chunk_id: str
    document_id: str
    document_title: str
    heading_path: str
    page_number: int
    excerpt: str
    similarity_score: float


@dataclass
class CitationValidationResult:
    cleaned_answer: str
    citations: List[ValidatedCitation]
    invalid_citation_ids: List[str]


def validate_and_extract_citations(
    raw_answer: str,
    authorized_chunks: List[RetrievalResult]
) -> CitationValidationResult:
    chunk_map = {c.chunk_id: c for c in authorized_chunks}
    pattern = r'\[(?:CHUNK_ID:\s*|Source:\s*)?([0-9a-fA-F-]{36})\]'

    found_ids: Set[str] = set()
    invalid_ids: List[str] = []

    for match in re.finditer(pattern, raw_answer):
        cid = match.group(1)
        if cid in chunk_map:
            found_ids.add(cid)
        else:
            invalid_ids.append(cid)

    # If no tags present in text, associate top matching chunks if evidence was retrieved
    if not found_ids and authorized_chunks:
        for chunk in authorized_chunks[:3]:
            found_ids.add(chunk.chunk_id)

    citations = []
    for cid in found_ids:
        chunk = chunk_map.get(cid)
        if chunk:
            excerpt = chunk.content[:220] + "..." if len(chunk.content) > 220 else chunk.content
            citations.append(ValidatedCitation(
                chunk_id=chunk.chunk_id,
                document_id=chunk.document_id,
                document_title=chunk.document_title,
                heading_path=chunk.heading_path,
                page_number=chunk.page_number,
                excerpt=excerpt,
                similarity_score=chunk.similarity,
            ))

    # Clean raw chunk tags out of user answer
    cleaned_answer = re.sub(pattern, '', raw_answer).strip()
    cleaned_answer = re.sub(r'\n{3,}', '\n\n', cleaned_answer)

    return CitationValidationResult(
        cleaned_answer=cleaned_answer,
        citations=citations,
        invalid_citation_ids=invalid_ids,
    )
