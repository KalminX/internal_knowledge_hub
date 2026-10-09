import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canRetireDocument } from '@/lib/auth/rbac';
import { retireDocument } from '@/lib/ingestion/pipeline';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getCurrentSession();

  if (!canRetireDocument(session.role)) {
    return NextResponse.json({ error: 'Forbidden: only admins/owners can retire documents' }, { status: 403 });
  }

  const doc = await db.getDocument(id, session.user.id);
  if (!doc || doc.organizationId !== session.organizationId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const newStatus = doc.status === 'retired' ? 'ready' : 'retired';
  if (newStatus === 'retired') {
    await retireDocument(session.organizationId, id, session.user.id);
  } else {
    await db.updateDocumentStatus(id, 'ready');
  }

  return NextResponse.json({ success: true, status: newStatus });
}
