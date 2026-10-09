import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canViewAnalytics } from '@/lib/auth/rbac';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!canViewAnalytics(session.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const gaps = await db.listUnansweredQuestions(session.organizationId);
  return NextResponse.json({ gaps });
}

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession();
  if (!canViewAnalytics(session.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { gapId, status, notes } = body;

  if (!gapId || !status) {
    return NextResponse.json({ error: 'gapId and status are required' }, { status: 400 });
  }

  await db.updateUnansweredQuestionStatus(gapId, status, notes, session.user.id);

  await db.createAuditLog({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: 'KNOWLEDGE_GAP_UPDATED',
    entityType: 'unanswered_question',
    entityId: gapId,
    metadata: { status, notes },
  });

  return NextResponse.json({ success: true });
}
