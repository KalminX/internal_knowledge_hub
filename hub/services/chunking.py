import math
import re
from dataclasses import dataclass
from typing import List, Optional
from hub.services.extraction import ExtractedSection


@dataclass
class PreparedChunk:
    chunk_index: int
    content: str
    token_count: int
    heading_path: str = "General"
    page_number: int = 1


def estimate_token_count(text: str) -> int:
    if not text:
        return 0
    return math.ceil(len(text) / 4)


def split_into_sentences(text: str) -> List[str]:
    # Regex split by sentence-ending punctuation followed by whitespace
    sentences = re.split(r'(?<=[.!?\n])\s+', text)
    return [s.strip() for s in sentences if s.strip()]


def chunk_document_sections(
    sections: List[ExtractedSection],
    max_tokens: int = 450,
    overlap_tokens: int = 60
) -> List[PreparedChunk]:
    chunks: List[PreparedChunk] = []
    chunk_index = 0

    for section in sections:
        section_heading = section.heading_path or "General"
        page_number = section.page_number or 1
        paragraphs = [p.strip() for p in section.content.split('\n\n') if p.strip()]

        current_sentences: List[str] = []
        current_tokens = 0

        def flush():
            nonlocal chunk_index, current_sentences, current_tokens
            if not current_sentences:
                return
            content = " ".join(current_sentences).strip()
            chunks.append(PreparedChunk(
                chunk_index=chunk_index,
                content=content,
                token_count=estimate_token_count(content),
                heading_path=section_heading,
                page_number=page_number,
            ))
            chunk_index += 1

            # Retain overlap sentences
            if overlap_tokens > 0:
                overlap_accum = 0
                overlap_sents = []
                for s in reversed(current_sentences):
                    st = estimate_token_count(s)
                    if overlap_accum + st <= overlap_tokens:
                        overlap_accum += st
                        overlap_sents.insert(0, s)
                    else:
                        break
                current_sentences = overlap_sents
                current_tokens = overlap_accum
            else:
                current_sentences = []
                current_tokens = 0

        for para in paragraphs:
            sentences = split_into_sentences(para)
            for sent in sentences:
                sent_tokens = estimate_token_count(sent)

                if sent_tokens > max_tokens:
                    flush()
                    # Slice oversized sentence by characters
                    rem = sent
                    slice_len = max_tokens * 4
                    while rem:
                        slice_text = rem[:slice_len]
                        chunks.append(PreparedChunk(
                            chunk_index=chunk_index,
                            content=slice_text,
                            token_count=estimate_token_count(slice_text),
                            heading_path=section_heading,
                            page_number=page_number,
                        ))
                        chunk_index += 1
                        rem = rem[slice_len:]
                    continue

                if current_tokens + sent_tokens > max_tokens:
                    flush()

                current_sentences.append(sent)
                current_tokens += sent_tokens

        flush()

    return chunks
