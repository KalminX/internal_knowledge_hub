import { IDatabaseStore } from './types';
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
import { canAccessDocument } from '../auth/rbac';

const STOP_WORDS = new Set([
  'what', 'is', 'the', 'for', 'and', 'are', 'you', 'can', 'how', 'many', 'about',
  'with', 'from', 'that', 'this', 'into', 'next', 'does', 'have', 'been', 'will',
  'what', 'when', 'where', 'which', 'who', 'why'
]);

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function keywordScore(text: string, query: string): number {
  if (!text || !query) return 0;
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (words.length === 0) return 0;
  const lowerText = text.toLowerCase();
  let matches = 0;
  for (const word of words) {
    const stem = word.length > 4 ? word.slice(0, 4) : word;
    if (lowerText.includes(word) || lowerText.includes(stem)) matches++;
  }
  return Math.min(1.0, matches / Math.min(words.length, 3));
}

export class MemoryDatabaseStore implements IDatabaseStore {
  public organizations: Map<string, Organization> = new Map();
  public profiles: Map<string, UserProfile> = new Map();
  public memberships: Map<string, OrganizationMembership> = new Map();
  public documents: Map<string, DocumentRecord> = new Map();
  public documentRules: Map<string, DocumentAccessRule[]> = new Map();
  public documentVersions: Map<string, DocumentVersion[]> = new Map();
  public documentChunks: DocumentChunk[] = [];
  public ingestionJobs: Map<string, IngestionJob> = new Map();
  public conversations: Map<string, Conversation> = new Map();
  public messages: Map<string, Message> = new Map();
  public citations: Map<string, MessageCitation[]> = new Map();
  public feedback: AnswerFeedback[] = [];
  public unansweredQuestions: Map<string, UnansweredQuestion> = new Map();
  public auditLogs: AuditLog[] = [];

  public reset(): void {
    this.organizations.clear();
    this.profiles.clear();
    this.memberships.clear();
    this.documents.clear();
    this.documentRules.clear();
    this.documentVersions.clear();
    this.documentChunks = [];
    this.ingestionJobs.clear();
    this.conversations.clear();
    this.messages.clear();
    this.citations.clear();
    this.feedback = [];
    this.unansweredQuestions.clear();
    this.auditLogs = [];
  }

  // Organizations & Profiles
  async getOrganization(orgId: string): Promise<Organization | null> {
    return this.organizations.get(orgId) || null;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    for (const org of this.organizations.values()) {
      if (org.slug === slug) return org;
    }
    return null;
  }

  async listOrganizations(): Promise<Organization[]> {
    return Array.from(this.organizations.values());
  }

  async createOrganization(orgData: Omit<Organization, 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const org: Organization = {
      ...orgData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.organizations.set(org.id, org);
    return org;
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    return this.profiles.get(userId) || null;
  }

  async createOrUpdateProfile(profileData: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const existing = this.profiles.get(profileData.id);
    const profile: UserProfile = {
      ...profileData,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async getMembership(orgId: string, userId: string): Promise<OrganizationMembership | null> {
    const key = `${orgId}:${userId}`;
    const mem = this.memberships.get(key);
    if (!mem) return null;
    const user = this.profiles.get(userId);
    return { ...mem, user };
  }

  async listMemberships(orgId: string): Promise<OrganizationMembership[]> {
    const results: OrganizationMembership[] = [];
    for (const mem of this.memberships.values()) {
      if (mem.organizationId === orgId) {
        const user = this.profiles.get(mem.userId);
        results.push({ ...mem, user });
      }
    }
    return results;
  }

  async setMembershipRole(orgId: string, userId: string, role: OrgRole, department?: string): Promise<OrganizationMembership> {
    const key = `${orgId}:${userId}`;
    const existing = this.memberships.get(key);
    const mem: OrganizationMembership = {
      id: existing?.id || crypto.randomUUID(),
      organizationId: orgId,
      userId,
      role,
      department: department || existing?.department,
      isActive: true,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memberships.set(key, mem);
    return mem;
  }

  // Documents
  async listDocuments(orgId: string, requestingUserId: string): Promise<DocumentRecord[]> {
    const mem = await this.getMembership(orgId, requestingUserId);
    if (!mem) return [];
    
    const docs: DocumentRecord[] = [];
    for (const doc of this.documents.values()) {
      if (doc.organizationId === orgId) {
        const rules = this.documentRules.get(doc.id) || [];
        const enriched = { ...doc, accessRules: rules };
        if (canAccessDocument(mem.role, requestingUserId, mem.department, enriched)) {
          docs.push(enriched);
        }
      }
    }
    return docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getDocument(documentId: string, requestingUserId?: string): Promise<DocumentRecord | null> {
    const doc = this.documents.get(documentId);
    if (!doc) return null;
    const rules = this.documentRules.get(documentId) || [];
    const enriched = { ...doc, accessRules: rules };

    if (requestingUserId) {
      const mem = await this.getMembership(doc.organizationId, requestingUserId);
      if (!mem) return null;
      if (!canAccessDocument(mem.role, requestingUserId, mem.department, enriched)) {
        return null;
      }
    }
    return enriched;
  }

  async createDocument(docData: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<DocumentRecord> {
    const id = docData.id || crypto.randomUUID();
    const doc: DocumentRecord = {
      ...docData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.documents.set(id, doc);
    return doc;
  }

  async updateDocumentStatus(documentId: string, status: DocumentRecord['status']): Promise<void> {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.status = status;
      doc.updatedAt = new Date().toISOString();
      this.documents.set(documentId, doc);
    }
  }

  async updateDocumentAccessScope(documentId: string, scope: DocumentRecord['accessScope']): Promise<void> {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.accessScope = scope;
      doc.updatedAt = new Date().toISOString();
      this.documents.set(documentId, doc);
    }
  }

  async setDocumentAccessRules(documentId: string, rules: Omit<DocumentAccessRule, 'id' | 'documentId' | 'createdAt'>[]): Promise<void> {
    const fullRules: DocumentAccessRule[] = rules.map((r) => ({
      ...r,
      id: crypto.randomUUID(),
      documentId,
      createdAt: new Date().toISOString(),
    }));
    this.documentRules.set(documentId, fullRules);
  }

  async createDocumentVersion(versionData: Omit<DocumentVersion, 'id' | 'createdAt'> & { id?: string }): Promise<DocumentVersion> {
    const version: DocumentVersion = {
      ...versionData,
      id: versionData.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const list = this.documentVersions.get(version.documentId) || [];
    list.push(version);
    this.documentVersions.set(version.documentId, list);

    const doc = this.documents.get(version.documentId);
    if (doc) {
      doc.currentVersionNumber = version.versionNumber;
      this.documents.set(doc.id, doc);
    }
    return version;
  }

  async getLatestDocumentVersion(documentId: string): Promise<DocumentVersion | null> {
    const list = this.documentVersions.get(documentId) || [];
    if (list.length === 0) return null;
    return list.reduce((latest, current) => current.versionNumber > latest.versionNumber ? current : latest);
  }

  // Chunks & Search
  async insertDocumentChunks(chunksData: Omit<DocumentChunk, 'id' | 'createdAt'>[]): Promise<void> {
    const chunks: DocumentChunk[] = chunksData.map((c) => ({
      ...c,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    this.documentChunks.push(...chunks);
  }

  async deleteDocumentChunks(documentId: string, versionId?: string): Promise<void> {
    this.documentChunks = this.documentChunks.filter(c => {
      if (c.documentId !== documentId) return true;
      if (versionId && c.versionId !== versionId) return true;
      return false;
    });
  }

  async searchAuthorizedChunks(
    orgId: string,
    userId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    queryText?: string
  ): Promise<RetrievalResult[]> {
    const mem = await this.getMembership(orgId, userId);
    if (!mem) return [];

    const results: { result: RetrievalResult; score: number }[] = [];

    for (const chunk of this.documentChunks) {
      if (chunk.organizationId !== orgId) continue;

      const doc = this.documents.get(chunk.documentId);
      if (!doc || doc.status !== 'ready') continue;

      const rules = this.documentRules.get(doc.id) || [];
      const enrichedDoc = { ...doc, accessRules: rules };
      if (!canAccessDocument(mem.role, userId, mem.department, enrichedDoc)) {
        continue;
      }

      let sim = 0;
      if (chunk.embedding && queryEmbedding && chunk.embedding.length > 0) {
        sim = cosineSimilarity(queryEmbedding, chunk.embedding);
      }

      if (queryText) {
        const kw = keywordScore(chunk.content, queryText);
        sim = Math.max(sim, kw * 0.70 + sim * 0.30);
      }

      if (sim >= threshold) {
        results.push({
          score: sim,
          result: {
            chunkId: chunk.id,
            documentId: chunk.documentId,
            versionId: chunk.versionId,
            documentTitle: doc.title,
            headingPath: chunk.headingPath,
            pageNumber: chunk.pageNumber,
            content: chunk.content,
            similarity: sim,
            tokenCount: chunk.tokenCount,
          },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.result);
  }

  // Ingestion Jobs
  async createIngestionJob(jobData: Omit<IngestionJob, 'id' | 'createdAt'> & { id?: string }): Promise<IngestionJob> {
    const job: IngestionJob = {
      ...jobData,
      id: jobData.id || crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.ingestionJobs.set(job.id, job);
    return job;
  }

  async updateIngestionJob(jobId: string, updates: Partial<IngestionJob>): Promise<void> {
    const job = this.ingestionJobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      if (updates.status === 'completed' || updates.status === 'failed') {
        job.completedAt = new Date().toISOString();
      }
      this.ingestionJobs.set(jobId, job);
    }
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob | null> {
    return this.ingestionJobs.get(jobId) || null;
  }

  async listIngestionJobs(orgId: string): Promise<IngestionJob[]> {
    const list = Array.from(this.ingestionJobs.values()).filter(j => j.organizationId === orgId);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Conversations & Messages
  async createConversation(orgId: string, userId: string, title = 'New Knowledge Query'): Promise<Conversation> {
    const conversation: Conversation = {
      id: crypto.randomUUID(),
      organizationId: orgId,
      userId,
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return null;
    return conv;
  }

  async listConversations(orgId: string, userId: string): Promise<Conversation[]> {
    const list = Array.from(this.conversations.values())
      .filter(c => c.organizationId === orgId && c.userId === userId);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async createMessage(msgData: Omit<Message, 'id' | 'createdAt'> & { id?: string }): Promise<Message> {
    const msg: Message = {
      ...msgData,
      id: msgData.id || crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.messages.set(msg.id, msg);

    const conv = this.conversations.get(msg.conversationId);
    if (conv) {
      conv.updatedAt = new Date().toISOString();
      if (msg.sender === 'user' && conv.title === 'New Knowledge Query') {
        conv.title = msg.content.slice(0, 45) + (msg.content.length > 45 ? '...' : '');
      }
      this.conversations.set(conv.id, conv);
    }
    return msg;
  }

  async listMessages(conversationId: string, userId: string): Promise<Message[]> {
    const conv = this.conversations.get(conversationId);
    if (!conv || conv.userId !== userId) return [];

    const list = Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId);
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return list.map(m => ({
      ...m,
      citations: this.citations.get(m.id) || [],
    }));
  }

  async addMessageCitations(citationsData: Omit<MessageCitation, 'id' | 'createdAt'>[]): Promise<void> {
    if (citationsData.length === 0) return;
    const messageId = citationsData[0].messageId;
    const list = this.citations.get(messageId) || [];
    const added = citationsData.map(c => ({
      ...c,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }));
    list.push(...added);
    this.citations.set(messageId, list);
  }

  async getMessageCitations(messageId: string): Promise<MessageCitation[]> {
    return this.citations.get(messageId) || [];
  }

  // Feedback & Gaps
  async createFeedback(feedbackData: Omit<AnswerFeedback, 'id' | 'createdAt'>): Promise<AnswerFeedback> {
    const item: AnswerFeedback = {
      ...feedbackData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.feedback.push(item);

    if (item.rating === 'unhelpful' || item.reportedMissingDoc) {
      const msg = this.messages.get(item.messageId);
      if (msg) {
        const convMsgs = await this.listMessages(item.conversationId, item.userId);
        const userMsg = convMsgs.find(m => m.sender === 'user' && new Date(m.createdAt) <= new Date(msg.createdAt));
        if (userMsg) {
          await this.createUnansweredQuestion({
            organizationId: item.organizationId,
            conversationId: item.conversationId,
            userId: item.userId,
            questionText: userMsg.content,
            reason: item.reportedMissingDoc ? 'User reported missing documentation' : 'User marked answer as unhelpful',
            status: 'pending',
            notes: item.explanation || undefined,
          });
        }
      }
    }

    return item;
  }

  async listFeedback(orgId: string): Promise<AnswerFeedback[]> {
    return this.feedback.filter(f => f.organizationId === orgId);
  }

  async createUnansweredQuestion(gapData: Omit<UnansweredQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnansweredQuestion> {
    const gap: UnansweredQuestion = {
      ...gapData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.unansweredQuestions.set(gap.id, gap);
    return gap;
  }

  async listUnansweredQuestions(orgId: string): Promise<UnansweredQuestion[]> {
    return Array.from(this.unansweredQuestions.values())
      .filter(g => g.organizationId === orgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateUnansweredQuestionStatus(
    gapId: string,
    status: UnansweredQuestion['status'],
    notes?: string,
    reviewedBy?: string
  ): Promise<void> {
    const gap = this.unansweredQuestions.get(gapId);
    if (gap) {
      gap.status = status;
      if (notes) gap.notes = notes;
      if (reviewedBy) gap.reviewedBy = reviewedBy;
      gap.updatedAt = new Date().toISOString();
      this.unansweredQuestions.set(gapId, gap);
    }
  }

  // Audit Logs
  async createAuditLog(logData: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const log: AuditLog = {
      ...logData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  async listAuditLogs(orgId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogs
      .filter(l => l.organizationId === orgId)
      .slice(0, limit);
  }

  // Analytics
  async getAnalyticsSummary(orgId: string): Promise<AnalyticsSummary> {
    const orgMessages = Array.from(this.messages.values()).filter(m => m.organizationId === orgId);
    const userQuestions = orgMessages.filter(m => m.sender === 'user');
    const assistantReplies = orgMessages.filter(m => m.sender === 'assistant');
    
    const uniqueUsers = new Set(userQuestions.map(m => m.userId));
    const insufficientCount = assistantReplies.filter(m => m.insufficientEvidence).length;

    const orgFeedback = this.feedback.filter(f => f.organizationId === orgId);
    const positiveFeedbackCount = orgFeedback.filter(f => f.rating === 'helpful').length;
    const negativeFeedbackCount = orgFeedback.filter(f => f.rating === 'unhelpful').length;

    const orgDocs = Array.from(this.documents.values()).filter(d => d.organizationId === orgId);
    const readyDocs = orgDocs.filter(d => d.status === 'ready');

    const orgJobs = Array.from(this.ingestionJobs.values()).filter(j => j.organizationId === orgId);
    const failedJobsCount = orgJobs.filter(j => j.status === 'failed').length;

    const citationCounts: Record<string, { title: string; count: number }> = {};
    for (const citationList of this.citations.values()) {
      for (const cit of citationList) {
        if (!citationCounts[cit.documentId]) {
          citationCounts[cit.documentId] = { title: cit.documentTitle, count: 0 };
        }
        citationCounts[cit.documentId].count++;
      }
    }

    const topCitedDocuments = Object.values(citationCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(c => ({ documentTitle: c.title, citationCount: c.count }));

    const topicCounts: Record<string, number> = {};
    for (const q of userQuestions) {
      const lower = q.content.toLowerCase();
      let matchedTopic = 'General Operations';
      if (lower.includes('leave') || lower.includes('pto') || lower.includes('vacation') || lower.includes('sick')) {
        matchedTopic = 'Leave & Attendance Policies';
      } else if (lower.includes('incident') || lower.includes('escalat') || lower.includes('outage') || lower.includes('sev1') || lower.includes('sev2')) {
        matchedTopic = 'Incident Response & Escalations';
      } else if (lower.includes('security') || lower.includes('password') || lower.includes('mfa') || lower.includes('auth')) {
        matchedTopic = 'Security & Account Policies';
      } else if (lower.includes('onboard') || lower.includes('new hire') || lower.includes('laptop') || lower.includes('setup')) {
        matchedTopic = 'New Hire Onboarding';
      } else if (lower.includes('retention') || lower.includes('delete') || lower.includes('gdpr') || lower.includes('archive')) {
        matchedTopic = 'Document Retention & Compliance';
      } else if (lower.includes('support') || lower.includes('sla') || lower.includes('customer') || lower.includes('ticket')) {
        matchedTopic = 'Support Quality & SLA';
      }
      topicCounts[matchedTopic] = (topicCounts[matchedTopic] || 0) + 1;
    }

    const frequentlyAskedTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count);

    const recentAuditLogs = await this.listAuditLogs(orgId, 10);

    return {
      totalQuestions: userQuestions.length,
      activeUsersCount: uniqueUsers.size,
      insufficientEvidenceCount: insufficientCount,
      positiveFeedbackCount,
      negativeFeedbackCount,
      totalDocumentsCount: orgDocs.length,
      readyDocumentsCount: readyDocs.length,
      failedJobsCount,
      frequentlyAskedTopics,
      topCitedDocuments,
      recentAuditLogs,
    };
  }
}
