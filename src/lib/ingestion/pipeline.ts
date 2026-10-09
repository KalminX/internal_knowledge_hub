import { db } from '../db';
import { storageProvider } from '../storage';
import { extractDocumentContent } from '../extraction';
import { chunkDocumentSections } from '../chunking';
import { getEmbeddingProvider } from '../embeddings';
import { DocumentRecord, DocumentAccessScope, IngestionJob } from '../types';

export interface IngestionInput {
  organizationId: string;
  userId: string;
  title: string;
  category?: string;
  accessScope?: DocumentAccessScope;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  existingDocumentId?: string;
}

export interface IngestionPipelineResult {
  document: DocumentRecord;
  job: IngestionJob;
  chunkCount: number;
  versionNumber: number;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB default

export async function processDocumentIngestion(
  input: IngestionInput
): Promise<IngestionPipelineResult> {
  const {
    organizationId,
    userId,
    title,
    category = 'General',
    accessScope = 'organization',
    fileName,
    mimeType,
    fileBuffer,
    existingDocumentId,
  } = input;

  // 1. Validation Stage
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Upload payload is empty.');
  }

  if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size (${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB) exceeds maximum limit of 15MB.`);
  }

  const allowedExts = ['pdf', 'docx', 'txt', 'md', 'markdown'];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (!allowedExts.includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Supported: PDF, DOCX, TXT, MD.`);
  }

  // Determine or create Document Record
  let document: DocumentRecord;
  let versionNumber = 1;

  if (existingDocumentId) {
    const existing = await db.getDocument(existingDocumentId, userId);
    if (!existing) {
      throw new Error(`Existing document ${existingDocumentId} not found.`);
    }
    document = existing;
    versionNumber = (document.currentVersionNumber || 1) + 1;
    await db.updateDocumentStatus(document.id, 'processing');
  } else {
    document = await db.createDocument({
      organizationId,
      title,
      category,
      accessScope,
      status: 'uploading',
      currentVersionNumber: 1,
      createdBy: userId,
    });
  }

  // 2. Storage & Versioning Stage
  const storageResult = await storageProvider.uploadFile(
    organizationId,
    document.id,
    versionNumber,
    fileName,
    fileBuffer
  );

  const embeddingProvider = getEmbeddingProvider();

  const docVersion = await db.createDocumentVersion({
    documentId: document.id,
    versionNumber,
    fileName,
    mimeType,
    fileSizeBytes: storageResult.fileSizeBytes,
    storagePath: storageResult.storagePath,
    fileHash: storageResult.fileHash,
    embeddingModel: embeddingProvider.modelName,
    embeddingDimension: embeddingProvider.dimension,
    chunkCount: 0,
    createdBy: userId,
  });

  // Create Ingestion Job Record
  const job = await db.createIngestionJob({
    organizationId,
    documentId: document.id,
    versionId: docVersion.id,
    stage: 'extraction',
    status: 'in_progress',
    retryCount: 0,
  });

  try {
    // 3. Extraction Stage
    await db.updateIngestionJob(job.id, { stage: 'extraction' });
    const extractionResult = await extractDocumentContent(fileBuffer, fileName, mimeType);

    // 4. Normalization & Chunking Stage
    await db.updateIngestionJob(job.id, { stage: 'chunking' });
    const preparedChunks = chunkDocumentSections(extractionResult.sections, {
      maxTokens: 450,
      overlapTokens: 60,
    });

    if (preparedChunks.length === 0) {
      throw new Error('No meaningful text content extracted from document.');
    }

    // 5. Embedding Generation Stage
    await db.updateIngestionJob(job.id, { stage: 'embedding' });
    const chunkTexts = preparedChunks.map(c => c.content);
    const embeddings = await embeddingProvider.generateEmbeddings(chunkTexts);

    // 6. Indexing Stage
    await db.updateIngestionJob(job.id, { stage: 'indexing' });

    // If reindexing an existing document, clear older version chunks
    if (existingDocumentId) {
      await db.deleteDocumentChunks(document.id);
    }

    const chunkEntities = preparedChunks.map((chunk, idx) => ({
      documentId: document.id,
      versionId: docVersion.id,
      organizationId,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      headingPath: chunk.headingPath,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[idx],
      metadata: {
        fileName,
        versionNumber,
        category,
      },
    }));

    await db.insertDocumentChunks(chunkEntities);

    // Update document & job statuses to ready / completed
    await db.updateDocumentStatus(document.id, 'ready');
    await db.updateIngestionJob(job.id, {
      stage: 'completed',
      status: 'completed',
    });

    // Record audit event
    await db.createAuditLog({
      organizationId,
      userId,
      action: existingDocumentId ? 'DOCUMENT_UPDATED' : 'DOCUMENT_INGESTED',
      entityType: 'document',
      entityId: document.id,
      metadata: {
        title: document.title,
        fileName,
        versionNumber,
        chunkCount: chunkEntities.length,
      },
    });

    const updatedDoc = (await db.getDocument(document.id))!;
    return {
      document: updatedDoc,
      job,
      chunkCount: chunkEntities.length,
      versionNumber,
    };
  } catch (error: any) {
    await db.updateDocumentStatus(document.id, 'failed');
    await db.updateIngestionJob(job.id, {
      stage: 'failed',
      status: 'failed',
      errorMessage: error.message || 'Ingestion failed',
    });

    await db.createAuditLog({
      organizationId,
      userId,
      action: 'DOCUMENT_INGESTION_FAILED',
      entityType: 'document',
      entityId: document.id,
      metadata: {
        fileName,
        error: error.message,
      },
    });

    throw error;
  }
}

export async function retireDocument(
  organizationId: string,
  documentId: string,
  userId: string
): Promise<void> {
  const doc = await db.getDocument(documentId, userId);
  if (!doc || doc.organizationId !== organizationId) {
    throw new Error('Document not found or unauthorized.');
  }

  await db.updateDocumentStatus(documentId, 'retired');

  await db.createAuditLog({
    organizationId,
    userId,
    action: 'DOCUMENT_RETIRED',
    entityType: 'document',
    entityId: documentId,
    metadata: { title: doc.title },
  });
}
