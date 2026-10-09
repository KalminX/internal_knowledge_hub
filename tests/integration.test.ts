import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db';
import { seedDemoDatabase, DEMO_ORG_ID, DEMO_USERS } from '../src/lib/seed';
import { processDocumentIngestion, retireDocument } from '../src/lib/ingestion/pipeline';
import { executeRagPipeline } from '../src/lib/rag/service';

describe('Integration Test: End-to-End Ingestion, Retrieval, Lifecycle & Feedback', () => {
  beforeEach(async () => {
    await seedDemoDatabase();
  });

  it('completes the full vertical lifecycle from upload to citation, feedback, and audit', async () => {
    // 1. Admin uploads a new operational procedure
    const newDocContent = `# Emergency Payroll Advance Policy\n\n## 1. Eligibility\nFull-time employees experiencing severe financial emergencies may request up to $2,500 advance against earned wages.\n\n## 2. Repayment Schedule\nAdvances are automatically deducted in equal installments over the next 3 consecutive payroll cycles.`;

    const ingestionResult = await processDocumentIngestion({
      organizationId: DEMO_ORG_ID,
      userId: DEMO_USERS.admin.id,
      title: 'Emergency Payroll Advance Policy',
      category: 'Finance',
      accessScope: 'organization',
      fileName: 'emergency_payroll_advance.md',
      mimeType: 'text/markdown',
      fileBuffer: Buffer.from(newDocContent, 'utf-8'),
    });

    expect(ingestionResult.document.status).toBe('ready');
    expect(ingestionResult.chunkCount).toBeGreaterThan(0);
    expect(ingestionResult.job.status).toBe('completed');

    // 2. Engineer queries the new procedure
    const conv = await db.createConversation(
      DEMO_ORG_ID,
      DEMO_USERS.engineer.id,
      'Payroll Advance Query'
    );

    const ragResult = await executeRagPipeline({
      organizationId: DEMO_ORG_ID,
      userId: DEMO_USERS.engineer.id,
      conversationId: conv.id,
      question: 'What is the maximum emergency payroll advance amount and repayment schedule?',
    });

    expect(ragResult.insufficientEvidence).toBe(false);
    expect(ragResult.citations.length).toBeGreaterThan(0);
    expect(ragResult.citations[0].documentTitle).toBe('Emergency Payroll Advance Policy');
    expect(ragResult.answer).toContain('2,500');

    // 3. User submits feedback
    const messages = await db.listMessages(conv.id, DEMO_USERS.engineer.id);
    const assistantMsg = messages.find(m => m.sender === 'assistant');
    expect(assistantMsg).toBeDefined();

    const feedback = await db.createFeedback({
      organizationId: DEMO_ORG_ID,
      conversationId: conv.id,
      messageId: assistantMsg!.id,
      userId: DEMO_USERS.engineer.id,
      rating: 'helpful',
      explanation: 'Accurate policy details with repayment timeline.',
    });

    expect(feedback.rating).toBe('helpful');

    // 4. Admin analytics updates accurately
    const analytics = await db.getAnalyticsSummary(DEMO_ORG_ID);
    expect(analytics.totalQuestions).toBeGreaterThan(0);
    expect(analytics.readyDocumentsCount).toBeGreaterThan(5);
    expect(analytics.recentAuditLogs.length).toBeGreaterThan(0);

    // 5. Admin updates and then retires the document
    await retireDocument(DEMO_ORG_ID, ingestionResult.document.id, DEMO_USERS.admin.id);
    const retiredDoc = await db.getDocument(ingestionResult.document.id);
    expect(retiredDoc?.status).toBe('retired');
  });
});
