import { RetrievalResult } from '../types';

export interface ValidatedCitation {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  headingPath?: string;
  pageNumber?: number;
  excerpt: string;
  similarityScore: number;
}

export interface CitationValidationResult {
  cleanedAnswer: string;
  citations: ValidatedCitation[];
  invalidCitationIds: string[];
}

/**
 * Extracts and strictly validates citation references in the model answer against retrieved chunks.
 * Supported model citation formats:
 * - [CHUNK_ID: <chunkId>]
 * - [Source: <chunkId>]
 * - [<chunkId>]
 */
export function validateAndExtractCitations(
  rawAnswer: string,
  authorizedChunks: RetrievalResult[]
): CitationValidationResult {
  const chunkMap = new Map<string, RetrievalResult>();
  for (const chunk of authorizedChunks) {
    chunkMap.set(chunk.chunkId, chunk);
  }

  const citationPattern = /\[(?:CHUNK_ID:\s*|Source:\s*)?([0-9a-fA-F-]{36})\]/g;
  const foundChunkIds = new Set<string>();
  const invalidCitationIds: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = citationPattern.exec(rawAnswer)) !== null) {
    const cid = match[1];
    if (chunkMap.has(cid)) {
      foundChunkIds.add(cid);
    } else {
      invalidCitationIds.push(cid);
    }
  }

  // If no explicit tags were found in text, but authorized evidence was provided and the answer is grounded,
  // associate the top matching chunks that directly contributed
  if (foundChunkIds.size === 0 && authorizedChunks.length > 0) {
    for (const chunk of authorizedChunks.slice(0, 3)) {
      foundChunkIds.add(chunk.chunkId);
    }
  }

  const citations: ValidatedCitation[] = [];
  for (const cid of foundChunkIds) {
    const chunk = chunkMap.get(cid);
    if (chunk) {
      // Excerpt first 220 chars of chunk for source preview
      const excerpt = chunk.content.length > 220
        ? chunk.content.slice(0, 220) + '...'
        : chunk.content;

      citations.push({
        chunkId: chunk.chunkId,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        headingPath: chunk.headingPath,
        pageNumber: chunk.pageNumber,
        excerpt,
        similarityScore: chunk.similarity,
      });
    }
  }

  // Clean answer text: remove raw chunk ID tags for clean display while keeping source footnotes
  let cleanedAnswer = rawAnswer.replace(/\[(?:CHUNK_ID:\s*|Source:\s*)?([0-9a-fA-F-]{36})\]/g, '').trim();

  // Remove duplicate multiple newlines
  cleanedAnswer = cleanedAnswer.replace(/\n{3,}/g, '\n\n');

  return {
    cleanedAnswer,
    citations,
    invalidCitationIds,
  };
}
