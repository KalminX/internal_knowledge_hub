export type OrgRole = 'owner' | 'admin' | 'editor' | 'member';

export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'failed' | 'retired';

export type DocumentAccessScope = 'organization' | 'restricted' | 'confidential';

export type IngestionStage = 
  | 'validation' 
  | 'extraction' 
  | 'normalization' 
  | 'chunking' 
  | 'embedding' 
  | 'indexing' 
  | 'completed' 
  | 'failed';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  department?: string;
  isActive: boolean;
  user?: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAccessRule {
  id: string;
  documentId: string;
  targetType: 'role' | 'user' | 'department';
  targetValue: string;
  canView: boolean;
  canEdit: boolean;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  category: string;
  status: DocumentStatus;
  accessScope: DocumentAccessScope;
  currentVersionNumber: number;
  createdBy?: string;
  accessRules?: DocumentAccessRule[];
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  storagePath: string;
  fileHash: string;
  embeddingModel: string;
  embeddingDimension: number;
  chunkCount: number;
  createdBy?: string;
  createdAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  versionId: string;
  organizationId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  headingPath?: string;
  pageNumber?: number;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface IngestionJob {
  id: string;
  organizationId: string;
  documentId: string;
  versionId: string;
  stage: IngestionStage;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  errorMessage?: string;
  retryCount: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageCitation {
  id: string;
  messageId: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  headingPath?: string;
  pageNumber?: number;
  excerpt: string;
  similarityScore: number;
  isValid: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  organizationId: string;
  userId: string;
  sender: 'user' | 'assistant';
  content: string;
  insufficientEvidence?: boolean;
  modelUsed?: string;
  promptTokens?: number;
  completionTokens?: number;
  citations?: MessageCitation[];
  createdAt: string;
}

export interface AnswerFeedback {
  id: string;
  organizationId: string;
  conversationId: string;
  messageId: string;
  userId: string;
  rating: 'helpful' | 'unhelpful';
  explanation?: string;
  reportedMissingDoc?: boolean;
  createdAt: string;
}

export interface UnansweredQuestion {
  id: string;
  organizationId: string;
  conversationId?: string;
  userId?: string;
  questionText: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'addressed' | 'dismissed';
  notes?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

export interface RetrievalResult {
  chunkId: string;
  documentId: string;
  versionId: string;
  documentTitle: string;
  headingPath?: string;
  pageNumber?: number;
  content: string;
  similarity: number;
  tokenCount: number;
}

export interface RagResponse {
  answer: string;
  insufficientEvidence: boolean;
  citations: {
    chunkId: string;
    documentId: string;
    documentTitle: string;
    headingPath?: string;
    pageNumber?: number;
    excerpt: string;
    similarityScore: number;
  }[];
  modelUsed: string;
  confidenceScore: number;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface AnalyticsSummary {
  totalQuestions: number;
  activeUsersCount: number;
  insufficientEvidenceCount: number;
  negativeFeedbackCount: number;
  positiveFeedbackCount: number;
  totalDocumentsCount: number;
  readyDocumentsCount: number;
  failedJobsCount: number;
  frequentlyAskedTopics: { topic: string; count: number }[];
  topCitedDocuments: { documentTitle: string; citationCount: number }[];
  recentAuditLogs: AuditLog[];
}
