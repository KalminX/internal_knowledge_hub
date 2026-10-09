import { ExtractedSection } from '../extraction';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface PreparedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  headingPath?: string;
  pageNumber?: number;
  metadata?: Record<string, unknown>;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Standard heuristic: 1 token ~= 4 characters or ~0.75 words
  return Math.ceil(text.length / 4);
}

export function splitIntoSentences(text: string): string[] {
  // Splits by period/question/exclamation followed by space or newline, while keeping punctuation
  const matches = text.match(/[^.!?\n]+[.!?\n]+/g);
  if (!matches) {
    return [text];
  }
  return matches.map(s => s.trim()).filter(Boolean);
}

export function chunkDocumentSections(
  sections: ExtractedSection[],
  options: ChunkOptions = {}
): PreparedChunk[] {
  const maxTokens = options.maxTokens || 450;
  const overlapTokens = options.overlapTokens || 60;

  const chunks: PreparedChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionHeading = section.headingPath || 'General';
    const pageNumber = section.pageNumber || 1;
    const paragraphs = section.content.split(/\n\n+/).filter(p => p.trim().length > 0);

    let currentChunkSentences: string[] = [];
    let currentChunkTokens = 0;

    const flushChunk = () => {
      if (currentChunkSentences.length === 0) return;
      const content = currentChunkSentences.join(' ').trim();
      chunks.push({
        chunkIndex: chunkIndex++,
        content,
        tokenCount: estimateTokenCount(content),
        headingPath: sectionHeading,
        pageNumber,
      });

      // Retain trailing sentences for overlap
      if (overlapTokens > 0) {
        let overlapAccum = 0;
        const overlapSentences: string[] = [];
        for (let i = currentChunkSentences.length - 1; i >= 0; i--) {
          const sent = currentChunkSentences[i];
          const sentTokens = estimateTokenCount(sent);
          if (overlapAccum + sentTokens <= overlapTokens) {
            overlapAccum += sentTokens;
            overlapSentences.unshift(sent);
          } else {
            break;
          }
        }
        currentChunkSentences = overlapSentences;
        currentChunkTokens = overlapAccum;
      } else {
        currentChunkSentences = [];
        currentChunkTokens = 0;
      }
    };

    for (const para of paragraphs) {
      const sentences = splitIntoSentences(para);

      for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);

        // If a single sentence exceeds max tokens, split by character chunks
        if (sentenceTokens > maxTokens) {
          flushChunk();
          let remaining = sentence;
          while (remaining.length > 0) {
            const slice = remaining.slice(0, maxTokens * 4);
            chunks.push({
              chunkIndex: chunkIndex++,
              content: slice,
              tokenCount: estimateTokenCount(slice),
              headingPath: sectionHeading,
              pageNumber,
            });
            remaining = remaining.slice(maxTokens * 4);
          }
          continue;
        }

        if (currentChunkTokens + sentenceTokens > maxTokens) {
          flushChunk();
        }

        currentChunkSentences.push(sentence);
        currentChunkTokens += sentenceTokens;
      }
    }

    // Flush any remaining sentences in this section
    flushChunk();
  }

  return chunks;
}
