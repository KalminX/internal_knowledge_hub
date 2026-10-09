import { db } from '../db';
import { processDocumentIngestion } from '../ingestion/pipeline';
import { SEED_DOCUMENTS } from '../../data/seed-docs';
import { executeRagPipeline } from '../rag/service';

export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';
export const EXTERNAL_ORG_ID = '00000000-0000-0000-0000-000000000002';

export const DEMO_USERS = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'sarah.admin@acme.internal',
    fullName: 'Sarah Connor (Admin)',
    role: 'admin' as const,
    department: 'Operations',
  },
  editor: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'david.editor@acme.internal',
    fullName: 'David Miller (Editor)',
    role: 'editor' as const,
    department: 'People Operations',
  },
  engineer: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'alex.engineer@acme.internal',
    fullName: 'Alex Rivera (Engineer)',
    role: 'member' as const,
    department: 'Engineering',
  },
  support: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'emma.support@acme.internal',
    fullName: 'Emma Watson (Support)',
    role: 'member' as const,
    department: 'Customer Support',
  },
  unauthorizedUser: {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'eve.outsider@competitor.com',
    fullName: 'Eve Hacker (External)',
    role: 'member' as const,
    department: 'External',
  },
};

export async function seedDemoDatabase(): Promise<void> {
  // Reset store if supported
  if (typeof (db as any).reset === 'function') {
    (db as any).reset();
  }

  // 1. Create Demo Organization & External Org
  await db.createOrganization({
    id: DEMO_ORG_ID,
    name: 'Acme Global Enterprises',
    slug: 'acme-corp',
    domain: 'acme.internal',
  });

  await db.createOrganization({
    id: EXTERNAL_ORG_ID,
    name: 'Competitor External Org',
    slug: 'competitor-corp',
    domain: 'competitor.com',
  });

  // 2. Provision User Profiles & Memberships
  for (const user of Object.values(DEMO_USERS)) {
    await db.createOrUpdateProfile({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });

    if (user.id === DEMO_USERS.unauthorizedUser.id) {
      await db.setMembershipRole(EXTERNAL_ORG_ID, user.id, 'member', 'External');
    } else {
      await db.setMembershipRole(DEMO_ORG_ID, user.id, user.role, user.department);
    }
  }

  // 3. Ingest Seed Documents
  for (const doc of SEED_DOCUMENTS) {
    const buffer = Buffer.from(doc.content, 'utf-8');
    const result = await processDocumentIngestion({
      organizationId: DEMO_ORG_ID,
      userId: DEMO_USERS.admin.id,
      title: doc.title,
      category: doc.category,
      accessScope: doc.accessScope,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileBuffer: buffer,
    });

    if (doc.accessScope === 'restricted') {
      await db.setDocumentAccessRules(result.document.id, [
        {
          targetType: 'role',
          targetValue: 'admin',
          canView: true,
          canEdit: true,
        },
      ]);
    }
  }

  // 4. Seed Demo Conversations & Queries for Analytics Dashboard
  const conv1 = await db.createConversation(DEMO_ORG_ID, DEMO_USERS.engineer.id, 'PTO Accrual & Rollover Limits');
  await executeRagPipeline({
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USERS.engineer.id,
    conversationId: conv1.id,
    question: 'How many days of PTO can I roll over into the new year and what is the deadline?',
  });

  const messages1 = await db.listMessages(conv1.id, DEMO_USERS.engineer.id);
  const assistantMsg1 = messages1.find(m => m.sender === 'assistant');
  if (assistantMsg1) {
    await db.createFeedback({
      organizationId: DEMO_ORG_ID,
      conversationId: conv1.id,
      messageId: assistantMsg1.id,
      userId: DEMO_USERS.engineer.id,
      rating: 'helpful',
      explanation: 'Clear and directly cited the PTO rollover rules.',
    });
  }

  const conv2 = await db.createConversation(DEMO_ORG_ID, DEMO_USERS.support.id, 'Priority 1 Support SLA');
  await executeRagPipeline({
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USERS.support.id,
    conversationId: conv2.id,
    question: 'What is the required initial response time for Priority 1 urgent tickets?',
  });

  const conv3 = await db.createConversation(DEMO_ORG_ID, DEMO_USERS.engineer.id, 'Company Pet Policy');
  await executeRagPipeline({
    organizationId: DEMO_ORG_ID,
    userId: DEMO_USERS.engineer.id,
    conversationId: conv3.id,
    question: 'What is the company policy on bringing pets to the office and pet insurance?',
  });
}
