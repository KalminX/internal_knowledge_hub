import {
  Organization,
  UserProfile,
  OrganizationMembership,
  DocumentRecord,
  DocumentAccessRule,
  DocumentVersion,
  DocumentChunk,
  IngestionJob,
  Conversation,
  Message,
  MessageCitation,
  AnswerFeedback,
  UnansweredQuestion,
  AuditLog,
  RetrievalResult,
  AnalyticsSummary,
  OrgRole
} from '../types';

export interface IDatabaseStore {
  // Organizations & Memberships
  getOrganization(orgId: string): Promise<Organization | null>;
  getOrganizationBySlug(slug: string): Promise<Organization | null>;
  listOrganizations(): Promise<Organization[]>;
  createOrganization(org: Omit<Organization, 'createdAt' | 'updatedAt'>): Promise<Organization>;
  
  getProfile(userId: string): Promise<UserProfile | null>;
  createOrUpdateProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile>;
  
  getMembership(orgId: string, userId: string): Promise<OrganizationMembership | null>;
  listMemberships(orgId: string): Promise<OrganizationMembership[]>;
  setMembershipRole(orgId: string, userId: string, role: OrgRole, department?: string): Promise<OrganizationMembership>;
  
  // Documents & Versions
  listDocuments(orgId: string, requestingUserId: string): Promise<DocumentRecord[]>;
  getDocument(documentId: string, requestingUserId?: string): Promise<DocumentRecord | null>;
  createDocument(doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<DocumentRecord>;
  updateDocumentStatus(documentId: string, status: DocumentRecord['status']): Promise<void>;
  updateDocumentAccessScope(documentId: string, scope: DocumentRecord['accessScope']): Promise<void>;
  setDocumentAccessRules(documentId: string, rules: Omit<DocumentAccessRule, 'id' | 'documentId' | 'createdAt'>[]): Promise<void>;
  
  createDocumentVersion(version: Omit<DocumentVersion, 'id' | 'createdAt'> & { id?: string }): Promise<DocumentVersion>;
  getLatestDocumentVersion(documentId: string): Promise<DocumentVersion | null>;
  
  // Chunks & Vector Search
  insertDocumentChunks(chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[]): Promise<void>;
  deleteDocumentChunks(documentId: string, versionId?: string): Promise<void>;
  searchAuthorizedChunks(
    orgId: string,
    userId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    queryText?: string
  ): Promise<RetrievalResult[]>;
  
  // Ingestion Jobs
  createIngestionJob(job: Omit<IngestionJob, 'id' | 'createdAt'> & { id?: string }): Promise<IngestionJob>;
  updateIngestionJob(jobId: string, updates: Partial<IngestionJob>): Promise<void>;
  getIngestionJob(jobId: string): Promise<IngestionJob | null>;
  listIngestionJobs(orgId: string): Promise<IngestionJob[]>;
  
  // Conversations & Messages
  createConversation(orgId: string, userId: string, title?: string): Promise<Conversation>;
  getConversation(conversationId: string, userId: string): Promise<Conversation | null>;
  listConversations(orgId: string, userId: string): Promise<Conversation[]>;
  
  createMessage(msg: Omit<Message, 'id' | 'createdAt'> & { id?: string }): Promise<Message>;
  listMessages(conversationId: string, userId: string): Promise<Message[]>;
  addMessageCitations(citations: Omit<MessageCitation, 'id' | 'createdAt'>[]): Promise<void>;
  getMessageCitations(messageId: string): Promise<MessageCitation[]>;
  
  // Feedback & Knowledge Gaps
  createFeedback(feedback: Omit<AnswerFeedback, 'id' | 'createdAt'>): Promise<AnswerFeedback>;
  listFeedback(orgId: string): Promise<AnswerFeedback[]>;
  
  createUnansweredQuestion(gap: Omit<UnansweredQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnansweredQuestion>;
  listUnansweredQuestions(orgId: string): Promise<UnansweredQuestion[]>;
  updateUnansweredQuestionStatus(gapId: string, status: UnansweredQuestion['status'], notes?: string, reviewedBy?: string): Promise<void>;
  
  // Audit Logs
  createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog>;
  listAuditLogs(orgId: string, limit?: number): Promise<AuditLog[]>;
  
  // Analytics Aggregation
  getAnalyticsSummary(orgId: string): Promise<AnalyticsSummary>;
}
