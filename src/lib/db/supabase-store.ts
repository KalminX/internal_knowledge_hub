import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

export class SupabaseDatabaseStore implements IDatabaseStore {
  private client: SupabaseClient;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async getOrganization(orgId: string): Promise<Organization | null> {
    const { data } = await this.client.from('organizations').select('*').eq('id', orgId).single();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { data } = await this.client.from('organizations').select('*').eq('slug', slug).single();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listOrganizations(): Promise<Organization[]> {
    const { data } = await this.client.from('organizations').select('*');
    return (data || []).map(d => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      domain: d.domain,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async createOrganization(org: Omit<Organization, 'createdAt' | 'updatedAt'>): Promise<Organization> {
    const { data, error } = await this.client.from('organizations').insert({
      id: org.id,
      name: org.name,
      slug: org.slug,
      domain: org.domain,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      domain: data.domain,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const { data } = await this.client.from('profiles').select('*').eq('id', userId).single();
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createOrUpdateProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const { data, error } = await this.client.from('profiles').upsert({
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      avatar_url: profile.avatarUrl,
      updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      avatarUrl: data.avatar_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getMembership(orgId: string, userId: string): Promise<OrganizationMembership | null> {
    const { data } = await this.client.from('organization_memberships')
      .select('*, profiles(*)')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .single();
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      role: data.role,
      department: data.department,
      isActive: data.is_active,
      user: data.profiles ? {
        id: data.profiles.id,
        email: data.profiles.email,
        fullName: data.profiles.full_name,
        avatarUrl: data.profiles.avatar_url,
        createdAt: data.profiles.created_at,
        updatedAt: data.profiles.updated_at,
      } : undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listMemberships(orgId: string): Promise<OrganizationMembership[]> {
    const { data } = await this.client.from('organization_memberships')
      .select('*, profiles(*)')
      .eq('organization_id', orgId);
    return (data || []).map(d => ({
      id: d.id,
      organizationId: d.organization_id,
      userId: d.user_id,
      role: d.role,
      department: d.department,
      isActive: d.is_active,
      user: d.profiles ? {
        id: d.profiles.id,
        email: d.profiles.email,
        fullName: d.profiles.full_name,
        avatarUrl: d.profiles.avatar_url,
        createdAt: d.profiles.created_at,
        updatedAt: d.profiles.updated_at,
      } : undefined,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async setMembershipRole(orgId: string, userId: string, role: OrgRole, department?: string): Promise<OrganizationMembership> {
    const { data, error } = await this.client.from('organization_memberships').upsert({
      organization_id: orgId,
      user_id: userId,
      role,
      department,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'organization_id,user_id' }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      role: data.role,
      department: data.department,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listDocuments(orgId: string, requestingUserId: string): Promise<DocumentRecord[]> {
    const { data } = await this.client.from('documents')
      .select('*, document_access_rules(*)')
      .eq('organization_id', orgId);
    return (data || []).map(d => ({
      id: d.id,
      organizationId: d.organization_id,
      title: d.title,
      description: d.description,
      category: d.category,
      status: d.status,
      accessScope: d.access_scope,
      currentVersionNumber: d.current_version_number,
      createdBy: d.created_by,
      accessRules: (d.document_access_rules || []).map((r: any) => ({
        id: r.id,
        documentId: r.document_id,
        targetType: r.target_type,
        targetValue: r.target_value,
        canView: r.can_view,
        canEdit: r.can_edit,
        createdAt: r.created_at,
      })),
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async getDocument(documentId: string, requestingUserId?: string): Promise<DocumentRecord | null> {
    const { data } = await this.client.from('documents')
      .select('*, document_access_rules(*)')
      .eq('id', documentId)
      .single();
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      title: data.title,
      description: data.description,
      category: data.category,
      status: data.status,
      accessScope: data.access_scope,
      currentVersionNumber: data.current_version_number,
      createdBy: data.created_by,
      accessRules: (data.document_access_rules || []).map((r: any) => ({
        id: r.id,
        documentId: r.document_id,
        targetType: r.target_type,
        targetValue: r.target_value,
        canView: r.can_view,
        canEdit: r.can_edit,
        createdAt: r.created_at,
      })),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createDocument(doc: Omit<DocumentRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<DocumentRecord> {
    const { data, error } = await this.client.from('documents').insert({
      id: doc.id,
      organization_id: doc.organizationId,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      status: doc.status,
      access_scope: doc.accessScope,
      current_version_number: doc.currentVersionNumber,
      created_by: doc.createdBy,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      title: data.title,
      description: data.description,
      category: data.category,
      status: data.status,
      accessScope: data.access_scope,
      currentVersionNumber: data.current_version_number,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateDocumentStatus(documentId: string, status: DocumentRecord['status']): Promise<void> {
    await this.client.from('documents').update({ status, updated_at: new Date().toISOString() }).eq('id', documentId);
  }

  async updateDocumentAccessScope(documentId: string, scope: DocumentRecord['accessScope']): Promise<void> {
    await this.client.from('documents').update({ access_scope: scope, updated_at: new Date().toISOString() }).eq('id', documentId);
  }

  async setDocumentAccessRules(documentId: string, rules: Omit<DocumentAccessRule, 'id' | 'documentId' | 'createdAt'>[]): Promise<void> {
    await this.client.from('document_access_rules').delete().eq('document_id', documentId);
    if (rules.length > 0) {
      await this.client.from('document_access_rules').insert(
        rules.map(r => ({
          document_id: documentId,
          target_type: r.targetType,
          target_value: r.targetValue,
          can_view: r.canView,
          can_edit: r.canEdit,
        }))
      );
    }
  }

  async createDocumentVersion(version: Omit<DocumentVersion, 'id' | 'createdAt'> & { id?: string }): Promise<DocumentVersion> {
    const { data, error } = await this.client.from('document_versions').insert({
      id: version.id,
      document_id: version.documentId,
      version_number: version.versionNumber,
      file_name: version.fileName,
      mime_type: version.mimeType,
      file_size_bytes: version.fileSizeBytes,
      storage_path: version.storagePath,
      file_hash: version.fileHash,
      embedding_model: version.embeddingModel,
      embedding_dimension: version.embeddingDimension,
      chunk_count: version.chunkCount,
      created_by: version.createdBy,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      documentId: data.document_id,
      versionNumber: data.version_number,
      fileName: data.file_name,
      mimeType: data.mime_type,
      fileSizeBytes: data.file_size_bytes,
      storagePath: data.storage_path,
      fileHash: data.file_hash,
      embeddingModel: data.embedding_model,
      embeddingDimension: data.embedding_dimension,
      chunkCount: data.chunk_count,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  async getLatestDocumentVersion(documentId: string): Promise<DocumentVersion | null> {
    const { data } = await this.client.from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    if (!data) return null;
    return {
      id: data.id,
      documentId: data.document_id,
      versionNumber: data.version_number,
      fileName: data.file_name,
      mimeType: data.mime_type,
      fileSizeBytes: data.file_size_bytes,
      storagePath: data.storage_path,
      fileHash: data.file_hash,
      embeddingModel: data.embedding_model,
      embeddingDimension: data.embedding_dimension,
      chunkCount: data.chunk_count,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  async insertDocumentChunks(chunks: Omit<DocumentChunk, 'id' | 'createdAt'>[]): Promise<void> {
    const rows = chunks.map(c => ({
      document_id: c.documentId,
      version_id: c.versionId,
      organization_id: c.organizationId,
      chunk_index: c.chunkIndex,
      content: c.content,
      token_count: c.tokenCount,
      heading_path: c.headingPath,
      page_number: c.pageNumber,
      embedding: c.embedding,
      metadata: c.metadata || {},
    }));
    const { error } = await this.client.from('document_chunks').insert(rows);
    if (error) throw error;
  }

  async deleteDocumentChunks(documentId: string, versionId?: string): Promise<void> {
    let query = this.client.from('document_chunks').delete().eq('document_id', documentId);
    if (versionId) query = query.eq('version_id', versionId);
    await query;
  }

  async searchAuthorizedChunks(
    orgId: string,
    userId: string,
    queryEmbedding: number[],
    threshold: number,
    limit: number,
    queryText?: string
  ): Promise<RetrievalResult[]> {
    const { data, error } = await this.client.rpc('match_document_chunks_authorized', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      filter_org_id: orgId,
      requesting_user_id: userId,
    });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      chunkId: r.chunk_id,
      documentId: r.document_id,
      versionId: r.version_id,
      documentTitle: r.document_title,
      headingPath: r.heading_path,
      pageNumber: r.page_number,
      content: r.content,
      similarity: r.similarity,
      tokenCount: Math.ceil(r.content.length / 4),
    }));
  }

  async createIngestionJob(job: Omit<IngestionJob, 'id' | 'createdAt'> & { id?: string }): Promise<IngestionJob> {
    const { data, error } = await this.client.from('ingestion_jobs').insert({
      id: job.id,
      organization_id: job.organizationId,
      document_id: job.documentId,
      version_id: job.versionId,
      stage: job.stage,
      status: job.status,
      error_message: job.errorMessage,
      retry_count: job.retryCount,
      started_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      documentId: data.document_id,
      versionId: data.version_id,
      stage: data.stage,
      status: data.status,
      errorMessage: data.error_message,
      retryCount: data.retry_count,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  }

  async updateIngestionJob(jobId: string, updates: Partial<IngestionJob>): Promise<void> {
    await this.client.from('ingestion_jobs').update({
      stage: updates.stage,
      status: updates.status,
      error_message: updates.errorMessage,
      retry_count: updates.retryCount,
      completed_at: updates.status === 'completed' || updates.status === 'failed' ? new Date().toISOString() : undefined,
    }).eq('id', jobId);
  }

  async getIngestionJob(jobId: string): Promise<IngestionJob | null> {
    const { data } = await this.client.from('ingestion_jobs').select('*').eq('id', jobId).single();
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      documentId: data.document_id,
      versionId: data.version_id,
      stage: data.stage,
      status: data.status,
      errorMessage: data.error_message,
      retryCount: data.retry_count,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  }

  async listIngestionJobs(orgId: string): Promise<IngestionJob[]> {
    const { data } = await this.client.from('ingestion_jobs')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return (data || []).map(d => ({
      id: d.id,
      organizationId: d.organization_id,
      documentId: d.document_id,
      versionId: d.version_id,
      stage: d.stage,
      status: d.status,
      errorMessage: d.error_message,
      retryCount: d.retry_count,
      startedAt: d.started_at,
      completedAt: d.completed_at,
      createdAt: d.created_at,
    }));
  }

  async createConversation(orgId: string, userId: string, title = 'New Knowledge Query'): Promise<Conversation> {
    const { data, error } = await this.client.from('conversations').insert({
      organization_id: orgId,
      user_id: userId,
      title,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getConversation(conversationId: string, userId: string): Promise<Conversation | null> {
    const { data } = await this.client.from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listConversations(orgId: string, userId: string): Promise<Conversation[]> {
    const { data } = await this.client.from('conversations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    return (data || []).map(d => ({
      id: d.id,
      organizationId: d.organization_id,
      userId: d.user_id,
      title: d.title,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));
  }

  async createMessage(msg: Omit<Message, 'id' | 'createdAt'> & { id?: string }): Promise<Message> {
    const { data, error } = await this.client.from('messages').insert({
      id: msg.id,
      conversation_id: msg.conversationId,
      organization_id: msg.organizationId,
      user_id: msg.userId,
      sender: msg.sender,
      content: msg.content,
      insufficient_evidence: msg.insufficientEvidence || false,
      model_used: msg.modelUsed,
      prompt_tokens: msg.promptTokens,
      completion_tokens: msg.completionTokens,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      conversationId: data.conversation_id,
      organizationId: data.organization_id,
      userId: data.user_id,
      sender: data.sender,
      content: data.content,
      insufficientEvidence: data.insufficient_evidence,
      modelUsed: data.model_used,
      promptTokens: data.prompt_tokens,
      completionTokens: data.completion_tokens,
      createdAt: data.created_at,
    };
  }

  async listMessages(conversationId: string, userId: string): Promise<Message[]> {
    const { data: messages } = await this.client.from('messages')
      .select('*, message_citations(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    return (messages || []).map(m => ({
      id: m.id,
      conversationId: m.conversation_id,
      organizationId: m.organization_id,
      userId: m.user_id,
      sender: m.sender,
      content: m.content,
      insufficientEvidence: m.insufficient_evidence,
      modelUsed: m.model_used,
      promptTokens: m.prompt_tokens,
      completionTokens: m.completion_tokens,
      citations: (m.message_citations || []).map((c: any) => ({
        id: c.id,
        messageId: c.message_id,
        chunkId: c.chunk_id,
        documentId: c.document_id,
        documentTitle: c.document_title,
        headingPath: c.heading_path,
        pageNumber: c.page_number,
        excerpt: c.excerpt,
        similarityScore: c.similarity_score,
        isValid: c.is_valid,
        createdAt: c.created_at,
      })),
      createdAt: m.created_at,
    }));
  }

  async addMessageCitations(citations: Omit<MessageCitation, 'id' | 'createdAt'>[]): Promise<void> {
    const rows = citations.map(c => ({
      message_id: c.messageId,
      chunk_id: c.chunkId,
      document_id: c.documentId,
      document_title: c.documentTitle,
      heading_path: c.headingPath,
      page_number: c.pageNumber,
      excerpt: c.excerpt,
      similarity_score: c.similarityScore,
      is_valid: c.isValid,
    }));
    await this.client.from('message_citations').insert(rows);
  }

  async getMessageCitations(messageId: string): Promise<MessageCitation[]> {
    const { data } = await this.client.from('message_citations').select('*').eq('message_id', messageId);
    return (data || []).map(c => ({
      id: c.id,
      messageId: c.message_id,
      chunkId: c.chunk_id,
      documentId: c.document_id,
      documentTitle: c.document_title,
      headingPath: c.heading_path,
      pageNumber: c.page_number,
      excerpt: c.excerpt,
      similarityScore: c.similarity_score,
      isValid: c.is_valid,
      createdAt: c.created_at,
    }));
  }

  async createFeedback(feedback: Omit<AnswerFeedback, 'id' | 'createdAt'>): Promise<AnswerFeedback> {
    const { data, error } = await this.client.from('answer_feedback').insert({
      organization_id: feedback.organizationId,
      conversation_id: feedback.conversationId,
      message_id: feedback.messageId,
      user_id: feedback.userId,
      rating: feedback.rating,
      explanation: feedback.explanation,
      reported_missing_doc: feedback.reportedMissingDoc,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      conversationId: data.conversation_id,
      messageId: data.message_id,
      userId: data.user_id,
      rating: data.rating,
      explanation: data.explanation,
      reportedMissingDoc: data.reported_missing_doc,
      createdAt: data.created_at,
    };
  }

  async listFeedback(orgId: string): Promise<AnswerFeedback[]> {
    const { data } = await this.client.from('answer_feedback').select('*').eq('organization_id', orgId);
    return (data || []).map(f => ({
      id: f.id,
      organizationId: f.organization_id,
      conversationId: f.conversation_id,
      messageId: f.message_id,
      userId: f.user_id,
      rating: f.rating,
      explanation: f.explanation,
      reportedMissingDoc: f.reported_missing_doc,
      createdAt: f.created_at,
    }));
  }

  async createUnansweredQuestion(gap: Omit<UnansweredQuestion, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnansweredQuestion> {
    const { data, error } = await this.client.from('unanswered_questions').insert({
      organization_id: gap.organizationId,
      conversation_id: gap.conversationId,
      user_id: gap.userId,
      question_text: gap.questionText,
      reason: gap.reason,
      status: gap.status,
      notes: gap.notes,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      conversationId: data.conversation_id,
      userId: data.user_id,
      questionText: data.question_text,
      reason: data.reason,
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async listUnansweredQuestions(orgId: string): Promise<UnansweredQuestion[]> {
    const { data } = await this.client.from('unanswered_questions')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    return (data || []).map(g => ({
      id: g.id,
      organizationId: g.organization_id,
      conversationId: g.conversation_id,
      userId: g.user_id,
      questionText: g.question_text,
      reason: g.reason,
      status: g.status,
      notes: g.notes,
      reviewedBy: g.reviewed_by,
      createdAt: g.created_at,
      updatedAt: g.updated_at,
    }));
  }

  async updateUnansweredQuestionStatus(gapId: string, status: UnansweredQuestion['status'], notes?: string, reviewedBy?: string): Promise<void> {
    await this.client.from('unanswered_questions').update({
      status,
      notes,
      reviewed_by: reviewedBy,
      updated_at: new Date().toISOString(),
    }).eq('id', gapId);
  }

  async createAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const { data, error } = await this.client.from('audit_logs').insert({
      organization_id: log.organizationId,
      user_id: log.userId,
      action: log.action,
      entity_type: log.entityType,
      entity_id: log.entityId,
      metadata: log.metadata,
      ip_address: log.ipAddress,
    }).select().single();
    if (error) throw error;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      action: data.action,
      entityType: data.entity_type,
      entityId: data.entity_id,
      metadata: data.metadata,
      ipAddress: data.ip_address,
      createdAt: data.created_at,
    };
  }

  async listAuditLogs(orgId: string, limit = 50): Promise<AuditLog[]> {
    const { data } = await this.client.from('audit_logs')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map(l => ({
      id: l.id,
      organizationId: l.organization_id,
      userId: l.user_id,
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id,
      metadata: l.metadata,
      ipAddress: l.ip_address,
      createdAt: l.created_at,
    }));
  }

  async getAnalyticsSummary(orgId: string): Promise<AnalyticsSummary> {
    // Queries counts from PostgreSQL
    const { count: totalQuestions } = await this.client.from('messages').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('sender', 'user');
    const { count: insufficientCount } = await this.client.from('messages').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('sender', 'assistant').eq('insufficient_evidence', true);
    const { count: positiveFeedback } = await this.client.from('answer_feedback').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('rating', 'helpful');
    const { count: negativeFeedback } = await this.client.from('answer_feedback').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('rating', 'unhelpful');
    const { count: totalDocs } = await this.client.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId);
    const { count: readyDocs } = await this.client.from('documents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'ready');
    const { count: failedJobs } = await this.client.from('ingestion_jobs').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).eq('status', 'failed');
    
    const recentAuditLogs = await this.listAuditLogs(orgId, 10);

    return {
      totalQuestions: totalQuestions || 0,
      activeUsersCount: 1,
      insufficientEvidenceCount: insufficientCount || 0,
      positiveFeedbackCount: positiveFeedback || 0,
      negativeFeedbackCount: negativeFeedback || 0,
      totalDocumentsCount: totalDocs || 0,
      readyDocumentsCount: readyDocs || 0,
      failedJobsCount: failedJobs || 0,
      frequentlyAskedTopics: [],
      topCitedDocuments: [],
      recentAuditLogs,
    };
  }
}
