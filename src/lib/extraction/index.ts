import mammoth from 'mammoth';

export interface ExtractedSection {
  content: string;
  headingPath?: string;
  pageNumber?: number;
}

export interface ExtractionResult {
  text: string;
  sections: ExtractedSection[];
  pageCount?: number;
  metadata?: Record<string, unknown>;
}

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExtractionError';
  }
}

/**
 * Normalizes text while preserving heading structure, bullet points, and paragraph boundaries.
 */
export function normalizeContent(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses markdown into structured sections by heading hierarchy.
 */
export function parseMarkdownSections(markdownText: string): ExtractedSection[] {
  const normalized = normalizeContent(markdownText);
  const lines = normalized.split('\n');
  const sections: ExtractedSection[] = [];

  let currentHeading = 'Overview';
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (currentLines.length > 0) {
        sections.push({
          content: currentLines.join('\n').trim(),
          headingPath: currentHeading,
        });
        currentLines = [];
      }
      currentHeading = headingMatch[2].trim();
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      content: currentLines.join('\n').trim(),
      headingPath: currentHeading,
    });
  }

  return sections.filter(s => s.content.length > 0);
}

export async function extractDocumentContent(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<ExtractionResult> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // 1. Markdown & Text files
  if (ext === 'md' || ext === 'markdown' || mimeType.includes('markdown') || ext === 'txt' || mimeType.includes('text/plain')) {
    const rawText = buffer.toString('utf-8');
    const normalized = normalizeContent(rawText);
    const sections = parseMarkdownSections(normalized);
    return {
      text: normalized,
      sections: sections.length > 0 ? sections : [{ content: normalized, headingPath: 'General' }],
      pageCount: 1,
    };
  }

  // 2. DOCX files
  if (ext === 'docx' || mimeType.includes('wordprocessingml')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const rawText = result.value;
      if (!rawText || rawText.trim().length === 0) {
        throw new ExtractionError('DOCX file is empty or text could not be extracted.');
      }
      const normalized = normalizeContent(rawText);
      const sections = parseMarkdownSections(normalized);
      return {
        text: normalized,
        sections: sections.length > 0 ? sections : [{ content: normalized, headingPath: 'General' }],
        pageCount: 1,
      };
    } catch (err: any) {
      throw new ExtractionError(`Failed to extract DOCX: ${err.message}`);
    }
  }

  // 3. PDF files
  if (ext === 'pdf' || mimeType.includes('application/pdf')) {
    try {
      // Dynamic require of pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      const rawText = data.text || '';
      
      if (!rawText || rawText.trim().length === 0) {
        throw new ExtractionError('PDF contains no extractable text. Scanned PDFs requiring OCR are not currently supported.');
      }

      const normalized = normalizeContent(rawText);
      const sections = parseMarkdownSections(normalized);

      return {
        text: normalized,
        sections: sections.length > 0 ? sections : [{ content: normalized, headingPath: 'General', pageNumber: 1 }],
        pageCount: data.numpages || 1,
        metadata: data.info,
      };
    } catch (err: any) {
      if (err instanceof ExtractionError) throw err;
      throw new ExtractionError(`Failed to extract PDF: ${err.message}`);
    }
  }

  throw new ExtractionError(`Unsupported document format: .${ext} (${mimeType}). Supported formats: PDF, DOCX, TXT, MD.`);
}
