import crypto from 'crypto';
import { IEmbeddingProvider } from './types';

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'for', 'and', 'are', 'you', 'can', 'how', 'many', 'about',
  'with', 'from', 'that', 'this', 'into', 'next', 'does', 'have', 'been', 'will',
  'what', 'when', 'where', 'which', 'who', 'why'
]);

/**
 * Deterministic semantic mock embedding provider.
 * Uses hashed term-frequency projection normalized on the unit sphere (1536 dimensions).
 * This allows full offline RAG pipeline execution, testing, and UI evaluation without external API keys.
 */
export class DeterministicMockEmbeddingProvider implements IEmbeddingProvider {
  public providerName = 'mock';
  public modelName = 'mock-deterministic-v1';
  public dimension = 1536;

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(t => this.computeVector(t));
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    return this.computeVector(query);
  }

  private computeVector(text: string): number[] {
    const vector = new Array(this.dimension).fill(0);
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    if (words.length === 0) {
      vector[0] = 1;
      return vector;
    }

    for (const word of words) {
      const hash = crypto.createHash('md5').update(word).digest();
      const idx1 = hash.readUInt16BE(0) % this.dimension;
      const idx2 = hash.readUInt16BE(2) % this.dimension;
      const idx3 = hash.readUInt16BE(4) % this.dimension;
      const sign = (hash[6] % 2 === 0) ? 1 : -1;

      vector[idx1] += 1.0 * sign;
      vector[idx2] += 0.5 * sign;
      vector[idx3] += 0.25;
    }

    // Normalize to unit length (L2 norm)
    let sumSq = 0;
    for (let i = 0; i < this.dimension; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq) || 1;
    for (let i = 0; i < this.dimension; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }
}

/**
 * OpenAI text-embedding-3-small (or compatible API) embedding provider.
 */
export class OpenAIEmbeddingProvider implements IEmbeddingProvider {
  public providerName = 'openai';
  public modelName: string;
  public dimension = 1536;
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, modelName = 'text-embedding-3-small', apiUrl = 'https://api.openai.com/v1/embeddings') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.apiUrl = apiUrl;
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const batchSize = 20;
    const allVectors: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: batch,
          model: this.modelName,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI Embedding API error (${res.status}): ${errorText}`);
      }

      const json = await res.json();
      const sorted = json.data.sort((a: any, b: any) => a.index - b.index);
      allVectors.push(...sorted.map((item: any) => item.embedding));
    }

    return allVectors;
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([query]);
    return embeddings[0];
  }
}

export function getEmbeddingProvider(): IEmbeddingProvider {
  const providerType = process.env.EMBEDDING_PROVIDER || 'mock';
  const apiKey = process.env.EMBEDDING_API_KEY;

  if (providerType === 'openai' && apiKey) {
    const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
    return new OpenAIEmbeddingProvider(apiKey, model);
  }

  return new DeterministicMockEmbeddingProvider();
}

export const defaultEmbeddingProvider = getEmbeddingProvider();
