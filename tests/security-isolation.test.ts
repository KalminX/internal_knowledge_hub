import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/lib/db';
import { seedDemoDatabase, DEMO_ORG_ID, EXTERNAL_ORG_ID, DEMO_USERS } from '../src/lib/seed';
import { retrieveAuthorizedContext } from '../src/lib/retrieval';
import { retireDocument } from '../src/lib/ingestion/pipeline';
import { executeRagPipeline } from '../src/lib/rag/service';

describe('Security & Multi-Tenant Isolation Test Suite', () => {
  beforeEach(async () => {
    await seedDemoDatabase();
  });

  describe('Tenant & Organization Isolation Boundary', () => {
    it('prevents external organization users from retrieving internal organization chunks', async () => {
      // Eve is in EXTERNAL_ORG_ID
      const retrievalExternal = await retrieveAuthorizedContext(
        EXTERNAL_ORG_ID,
        DEMO_USERS.unauthorizedUser.id,
        'How many days of PTO can I roll over?'
      );

      // External org has no Acme documents
      expect(retrievalExternal.results.length).toBe(0);

      // Attempting to query Acme Org with Eve's userId must produce 0 chunks (unauthorized org membership)
      const unauthorizedAcmeQuery = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.unauthorizedUser.id,
        'How many days of PTO can I roll over?'
      );
      expect(unauthorizedAcmeQuery.results.length).toBe(0);
    });

    it('allows valid Acme employee to retrieve authorized Acme documents', async () => {
      const retrievalInternal = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.engineer.id,
        'How many days of PTO can I roll over?'
      );

      expect(retrievalInternal.results.length).toBeGreaterThan(0);
      expect(retrievalInternal.results[0].documentTitle).toBe('Leave and Paid Time Off (PTO) Policy');
    });
  });

  describe('Document-Level Access Scope Enforcement', () => {
    it('blocks regular member from retrieving restricted executive documents', async () => {
      // Alex Rivera is a regular member (Engineering)
      const memberRetrieval = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.engineer.id,
        'What is the leadership equity vesting schedule and executive bonus formula?'
      );

      // Should NOT retrieve Executive Compensation (scope: restricted)
      const hasRestricted = memberRetrieval.results.some(
        r => r.documentTitle.includes('Executive Compensation')
      );
      expect(hasRestricted).toBe(false);
    });

    it('allows organization admin to retrieve restricted executive documents', async () => {
      // Sarah Connor is an admin
      const adminRetrieval = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.admin.id,
        'What is the leadership equity vesting schedule and executive bonus formula?'
      );

      const hasRestricted = adminRetrieval.results.some(
        r => r.documentTitle.includes('Executive Compensation')
      );
      expect(hasRestricted).toBe(true);
    });
  });

  describe('Document Lifecycle & Retirement Isolation', () => {
    it('immediately prevents retired documents from appearing in search results', async () => {
      // 1. Locate PTO policy document
      const docs = await db.listDocuments(DEMO_ORG_ID, DEMO_USERS.admin.id);
      const ptoDoc = docs.find(d => d.title.includes('Leave and Paid Time Off'));
      expect(ptoDoc).toBeDefined();

      // 2. Query before retirement: succeeds
      const beforeRetire = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.engineer.id,
        'PTO rollover limits'
      );
      expect(beforeRetire.results.length).toBeGreaterThan(0);

      // 3. Retire the document
      await retireDocument(DEMO_ORG_ID, ptoDoc!.id, DEMO_USERS.admin.id);

      // 4. Query after retirement: must immediately return 0 chunks
      const afterRetire = await retrieveAuthorizedContext(
        DEMO_ORG_ID,
        DEMO_USERS.engineer.id,
        'PTO rollover limits'
      );
      const hasRetiredDoc = afterRetire.results.some(r => r.documentId === ptoDoc!.id);
      expect(hasRetiredDoc).toBe(false);
    });
  });

  describe('Conversation Privacy Boundary', () => {
    it('prevents user A from viewing user B conversations or messages', async () => {
      // Create private conversation for Alex (Engineer)
      const conv = await db.createConversation(DEMO_ORG_ID, DEMO_USERS.engineer.id, 'Confidential Career Query');
      await db.createMessage({
        conversationId: conv.id,
        organizationId: DEMO_ORG_ID,
        userId: DEMO_USERS.engineer.id,
        sender: 'user',
        content: 'I have a private question about team restructuring.',
      });

      // Emma (Support) attempts to fetch Alex's conversation
      const emmaView = await db.getConversation(conv.id, DEMO_USERS.support.id);
      expect(emmaView).toBeNull();

      const emmaMessages = await db.listMessages(conv.id, DEMO_USERS.support.id);
      expect(emmaMessages.length).toBe(0);
    });
  });
});
