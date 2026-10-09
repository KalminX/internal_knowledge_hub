import { db } from '../db';
import { getEmbeddingProvider } from '../embeddings';
import { RetrievalResult } from '../types';

export interface RetrievalOptions {
  similarityThreshold?: number;
  maxChunks?: number;
  enableHybrid?: boolean;
}

export interface RetrievalContext {
  results: RetrievalResult[];
  contextText: string;
  totalTokens: number;
}

export async function retrieveAuthorizedContext(
  organizationId: string,
  userId: string,
  query: string,
  options: RetrievalOptions = {}
): Promise<RetrievalContext> {
  const threshold = options.similarityThreshold ?? (
    process.env.RAG_SIMILARITY_THRESHOLD ? parseFloat(process.env.RAG_SIMILARITY_THRESHOLD) : 0.45
  );
  const maxChunks = options.maxChunks ?? (
    process.env.RAG_MAX_CHUNKS ? parseInt(process.env.RAG_MAX_CHUNKS, 10) : 6
  );
  const enableHybrid = options.enableHybrid ?? (
    process.env.RAG_HYBRID_SEARCH_ENABLED !== 'false'
  );

  // 1. Generate query embedding
  const embeddingProvider = getEmbeddingProvider();
  const queryEmbedding = await embeddingProvider.generateQueryEmbedding(query);

  // 2. Perform authorized vector retrieval strictly inside database boundary
  const rawResults = await db.searchAuthorizedChunks(
    organizationId,
    userId,
    queryEmbedding,
    threshold,
    maxChunks * 2, // fetch candidate pool
    enableHybrid ? query : undefined
  );

  // 3. Deduplicate / prune overlapping content
  const selected: RetrievalResult[] = [];
  const seenTexts = new Set<string>();

  for (const item of rawResults) {
    // Quick text overlap check
    const normalizedSnippet = item.content.slice(0, 100).toLowerCase();
    if (seenTexts.has(normalizedSnippet)) continue;
    seenTexts.add(normalizedSnippet);

    selected.push(item);
    if (selected.length >= maxChunks) break;
  }

  // 4. Construct bounded evidence text
  let totalTokens = 0;
  const contextSections: string[] = [];

  for (const item of selected) {
    totalTokens += item.tokenCount;
    contextSections.push(
      `--- SOURCE DOCUMENT: "${item.documentTitle}" | SECTION: "${item.headingPath || 'General'}" | PAGE: ${item.pageNumber || 1} | CHUNK_ID: ${item.chunkId} ---\n${item.content}\n`
    );
  }

  const contextText = contextSections.join('\n\n');

  return {
    results: selected,
    contextText,
    totalTokens,
  };
}
