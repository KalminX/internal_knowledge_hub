export interface IEmbeddingProvider {
  providerName: string;
  modelName: string;
  dimension: number;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
  generateQueryEmbedding(query: string): Promise<number[]>;
}
