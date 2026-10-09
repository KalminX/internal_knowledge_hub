import { describe, it, expect } from 'vitest';
import { normalizeContent, parseMarkdownSections } from '../src/lib/extraction';
import { chunkDocumentSections, estimateTokenCount } from '../src/lib/chunking';
import { DeterministicMockEmbeddingProvider } from '../src/lib/embeddings';
import { validateAndExtractCitations } from '../src/lib/citations';
import { hasMinimumRole, canAccessDocument } from '../src/lib/auth/rbac';
import { RetrievalResult } from '../src/lib/types';

describe('Unit Tests: Core RAG Subsystems', () => {
  describe('Text Normalization and Markdown Parsing', () => {
    it('normalizes carriage returns and multiple whitespace lines', () => {
      const input = 'Heading 1\r\n\r\n\r\nSome    spaced    text.\r\nNext line.';
      const output = normalizeContent(input);
      expect(output).toContain('Some spaced text.');
      expect(output).not.toContain('\r');
      expect(output).not.toContain('\n\n\n');
    });

    it('extracts structured sections based on markdown heading tags', () => {
      const md = `# Main Policy\nIntro text here.\n\n## Section 1: PTO\n20 days per year.\n\n## Section 2: Sick Leave\n10 days per year.`;
      const sections = parseMarkdownSections(md);
      expect(sections.length).toBe(3);
      expect(sections[0].headingPath).toBe('Main Policy');
      expect(sections[1].headingPath).toBe('Section 1: PTO');
      expect(sections[1].content).toContain('20 days per year.');
      expect(sections[2].headingPath).toBe('Section 2: Sick Leave');
    });
  });

  describe('Chunking and Token Estimation', () => {
    it('estimates token count appropriately', () => {
      const text = 'This is a sample document sentence.';
      const tokens = estimateTokenCount(text);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBe(Math.ceil(text.length / 4));
    });

    it('chunks text while preserving headingPath and overlap boundaries', () => {
      const sections = [
        {
          headingPath: 'Incident Escalation',
          pageNumber: 2,
          content: 'Step 1: Declare SEV-1 outage. Step 2: Open voice bridge. Step 3: Notify executive stakeholders within 15 minutes. Step 4: Publish public status update.',
        },
      ];

      const chunks = chunkDocumentSections(sections, { maxTokens: 20, overlapTokens: 5 });
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].headingPath).toBe('Incident Escalation');
      expect(chunks[0].pageNumber).toBe(2);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[1].chunkIndex).toBe(1);
    });
  });

  describe('Embedding Provider & Cosine Similarity', () => {
    it('generates deterministic normalized 1536-dim vectors', async () => {
      const provider = new DeterministicMockEmbeddingProvider();
      const vectors = await provider.generateEmbeddings(['Security policy and password standards']);
      expect(vectors.length).toBe(1);
      expect(vectors[0].length).toBe(1536);

      // Verify unit length (L2 norm ~= 1.0)
      let sumSq = 0;
      for (const val of vectors[0]) sumSq += val * val;
      expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 4);
    });

    it('yields higher similarity for semantically related queries than unrelated ones', async () => {
      const provider = new DeterministicMockEmbeddingProvider();
      const [vecTarget] = await provider.generateEmbeddings(['Paid time off vacation days and sick leave']);
      const [vecRelated] = await provider.generateEmbeddings(['How many PTO vacation days do I get?']);
      const [vecUnrelated] = await provider.generateEmbeddings(['Quantum physics and gravitational wave detectors']);

      const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * b[i], 0);

      const simRelated = dot(vecTarget, vecRelated);
      const simUnrelated = dot(vecTarget, vecUnrelated);

      expect(simRelated).toBeGreaterThan(simUnrelated);
    });
  });

  describe('Citation Extraction and Validation', () => {
    it('validates citation tags matching authorized chunks and rejects fabricated ids', () => {
      const validChunkId = 'aaaaaaaa-1111-1111-1111-111111111111';
      const fakeChunkId = 'ffffffff-9999-9999-9999-999999999999';

      const mockRetrieved: RetrievalResult[] = [
        {
          chunkId: validChunkId,
          documentId: 'doc-1',
          versionId: 'v-1',
          documentTitle: 'PTO Policy',
          headingPath: 'Rollover Limits',
          pageNumber: 1,
          content: 'A maximum of 5 unused PTO days may be rolled over into the new year.',
          similarity: 0.88,
          tokenCount: 25,
        },
      ];

      const modelAnswer = `You can roll over 5 days [CHUNK_ID: ${validChunkId}]. You also get 50 bonus days [CHUNK_ID: ${fakeChunkId}].`;

      const result = validateAndExtractCitations(modelAnswer, mockRetrieved);

      expect(result.citations.length).toBe(1);
      expect(result.citations[0].chunkId).toBe(validChunkId);
      expect(result.citations[0].documentTitle).toBe('PTO Policy');
      expect(result.invalidCitationIds).toContain(fakeChunkId);
      expect(result.cleanedAnswer).not.toContain(validChunkId);
    });
  });

  describe('RBAC and Access Control Rules', () => {
    it('enforces role hierarchy rankings', () => {
      expect(hasMinimumRole('owner', 'admin')).toBe(true);
      expect(hasMinimumRole('admin', 'editor')).toBe(true);
      expect(hasMinimumRole('editor', 'member')).toBe(true);
      expect(hasMinimumRole('member', 'editor')).toBe(false);
      expect(hasMinimumRole('editor', 'admin')).toBe(false);
    });

    it('allows members to view organization-scoped ready documents', () => {
      const doc = {
        status: 'ready',
        accessScope: 'organization' as const,
      };
      expect(canAccessDocument('member', 'user-123', 'Engineering', doc)).toBe(true);
    });

    it('blocks regular members from viewing restricted documents without explicit rules', () => {
      const restrictedDoc = {
        status: 'ready',
        accessScope: 'restricted' as const,
        accessRules: [],
      };
      expect(canAccessDocument('member', 'user-123', 'Engineering', restrictedDoc)).toBe(false);
      expect(canAccessDocument('admin', 'admin-999', 'Operations', restrictedDoc)).toBe(true);
      expect(canAccessDocument('owner', 'owner-000', 'Executive', restrictedDoc)).toBe(true);
    });

    it('blocks regular members from viewing retired or uploading documents', () => {
      const retiredDoc = {
        status: 'retired',
        accessScope: 'organization' as const,
      };
      expect(canAccessDocument('member', 'user-123', 'Engineering', retiredDoc)).toBe(false);
      expect(canAccessDocument('editor', 'editor-456', 'People Ops', retiredDoc)).toBe(true);
    });
  });
});
