import io
import re
from dataclasses import dataclass
from typing import List, Optional
import pypdf
import docx


@dataclass
class ExtractedSection:
    content: str = ""
    heading_path: str = "General"
    page_number: int = 1


@dataclass
class ExtractionResult:
    text: str
    sections: List[ExtractedSection]
    page_count: int = 1


class ExtractionError(Exception):
    pass


def normalize_content(raw_text: str) -> str:
    if not raw_text:
        return ""
    text = raw_text.replace('\r\n', '\n').replace('\r', '\n')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def parse_markdown_sections(markdown_text: str) -> List[ExtractedSection]:
    normalized = normalize_content(markdown_text)
    lines = normalized.split('\n')
    sections: List[ExtractedSection] = []

    current_heading = "Overview"
    current_lines = []

    for line in lines:
        heading_match = re.match(r'^(#{1,6})\s+(.+)$', line)
        if heading_match:
            if current_lines:
                content = "\n".join(current_lines).strip()
                if content:
                    sections.append(ExtractedSection(content=content, heading_path=current_heading))
                current_lines = []
            current_heading = heading_match.group(2).strip()
        else:
            current_lines.append(line)

    if current_lines:
        content = "\n".join(current_lines).strip()
        if content:
            sections.append(ExtractedSection(content=content, heading_path=current_heading))

    return sections if sections else [ExtractedSection(content=normalized, heading_path="General")]


def extract_document_content(file_bytes: bytes, file_name: str, mime_type: str) -> ExtractionResult:
    ext = file_name.split('.')[-1].lower() if '.' in file_name else ''

    # 1. Markdown and Text
    if ext in ['md', 'markdown', 'txt'] or 'markdown' in mime_type or 'text/plain' in mime_type:
        raw_text = file_bytes.decode('utf-8', errors='replace')
        normalized = normalize_content(raw_text)
        sections = parse_markdown_sections(normalized)
        return ExtractionResult(text=normalized, sections=sections, page_count=1)

    # 2. DOCX
    if ext == 'docx' or 'wordprocessingml' in mime_type:
        try:
            doc = docx.Document(io.BytesIO(file_bytes))
            sections: List[ExtractedSection] = []
            current_heading = "Overview"
            current_paras = []

            for p in doc.paragraphs:
                p_text = p.text.strip()
                if not p_text:
                    continue
                if p.style and p.style.name and p.style.name.startswith('Heading'):
                    if current_paras:
                        sections.append(ExtractedSection(content="\n\n".join(current_paras), heading_path=current_heading))
                        current_paras = []
                    current_heading = p_text
                else:
                    current_paras.append(p_text)

            if current_paras:
                sections.append(ExtractedSection(content="\n\n".join(current_paras), heading_path=current_heading))

            full_text = "\n\n".join([s.content for s in sections])
            if not full_text.strip():
                raise ExtractionError("DOCX file is empty or text could not be extracted.")

            return ExtractionResult(text=full_text, sections=sections, page_count=1)
        except Exception as e:
            if isinstance(e, ExtractionError):
                raise
            raise ExtractionError(f"Failed to extract DOCX: {str(e)}")

    # 3. PDF
    if ext == 'pdf' or 'application/pdf' in mime_type:
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            sections: List[ExtractedSection] = []
            all_text_parts = []
            num_pages = len(reader.pages)

            for page_idx, page in enumerate(reader.pages, start=1):
                page_text = page.extract_text() or ""
                normalized_page = normalize_content(page_text)
                if normalized_page:
                    all_text_parts.append(normalized_page)
                    page_sections = parse_markdown_sections(normalized_page)
                    for ps in page_sections:
                        ps.page_number = page_idx
                        sections.append(ps)

            if not all_text_parts:
                raise ExtractionError("PDF contains no extractable text. Scanned PDFs requiring OCR are not currently supported.")

            full_text = "\n\n".join(all_text_parts)
            return ExtractionResult(text=full_text, sections=sections, page_count=num_pages)
        except Exception as e:
            if isinstance(e, ExtractionError):
                raise
            raise ExtractionError(f"Failed to extract PDF: {str(e)}")

    raise ExtractionError(f"Unsupported document format: .{ext} ({mime_type}). Supported: PDF, DOCX, TXT, MD.")
