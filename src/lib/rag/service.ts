import { db } from '../db';
import { retrieveAuthorizedContext } from '../retrieval';
import { generateGroundedAnswer } from '../llm/claude';
import { validateAndExtractCitations } from '../citations';
import { RagResponse } from '../types';

export interface ExecuteRagOptions {
  organizationId: string;
  userId: string;
  conversationId: string;
  question: string;
}

export async function executeRagPipeline(
  options: ExecuteRagOptions
): Promise<RagResponse> {
  const { organizationId, userId, conversationId, question } = options;

  if (!question || !question.trim()) {
    throw new Error('Question text is required.');
  }

  // 1. Verify conversation ownership & organization
  const conversation = await db.getConversation(conversationId, userId);
  if (!conversation || conversation.organizationId !== organizationId) {
    throw new Error('Conversation not found or unauthorized.');
  }

  // 2. Persist User Question Message
  await db.createMessage({
    conversationId,
    organizationId,
    userId,
    sender: 'user',
    content: question.trim(),
  });

  // 3. Authorized Vector Retrieval Boundary
  const retrieval = await retrieveAuthorizedContext(organizationId, userId, question);

  // 4. Claude Answer Generation
  const generation = await generateGroundedAnswer(
    question,
    retrieval.results,
    retrieval.contextText
  );

  // 5. Citation Validation
  const validation = validateAndExtractCitations(
    generation.answer,
    retrieval.results
  );

  // 6. Persist Assistant Response Message
  const assistantMsg = await db.createMessage({
    conversationId,
    organizationId,
    userId,
    sender: 'assistant',
    content: validation.cleanedAnswer,
    insufficientEvidence: generation.insufficientEvidence,
    modelUsed: generation.modelUsed,
    promptTokens: generation.usage?.promptTokens,
    completionTokens: generation.usage?.completionTokens,
  });

  // 7. Persist Validated Citations
  if (validation.citations.length > 0) {
    const citationRows = validation.citations.map(c => ({
      messageId: assistantMsg.id,
      chunkId: c.chunkId,
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      headingPath: c.headingPath,
      pageNumber: c.pageNumber,
      excerpt: c.excerpt,
      similarityScore: c.similarityScore,
      isValid: true,
    }));
    await db.addMessageCitations(citationRows);
  }

  // 8. Knowledge Gap Automation: If insufficient evidence, record unanswered question for admin review
  if (generation.insufficientEvidence) {
    await db.createUnansweredQuestion({
      organizationId,
      conversationId,
      userId,
      questionText: question.trim(),
      reason: 'insufficient_evidence',
      status: 'pending',
    });
  }

  // 9. Audit Logging
  await db.createAuditLog({
    organizationId,
    userId,
    action: 'RAG_QUERY_EXECUTED',
    entityType: 'conversation',
    entityId: conversationId,
    metadata: {
      retrievedChunksCount: retrieval.results.length,
      insufficientEvidence: generation.insufficientEvidence,
      citationsCount: validation.citations.length,
      modelUsed: generation.modelUsed,
    },
  });

  return {
    answer: validation.cleanedAnswer,
    insufficientEvidence: generation.insufficientEvidence,
    citations: validation.citations,
    modelUsed: generation.modelUsed,
    confidenceScore: retrieval.results.length > 0 ? retrieval.results[0].similarity : 0,
    usage: generation.usage,
  };
}
