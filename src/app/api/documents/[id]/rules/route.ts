import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canManageMembers } from '@/lib/auth/rbac';
import { db } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getCurrentSession();

  if (!canManageMembers(session.role)) {
    return NextResponse.json({ error: 'Forbidden: only admins can manage document access rules' }, { status: 403 });
  }

  const body = await req.json();
  const { accessScope, accessRules } = body;

  const doc = await db.getDocument(id, session.user.id);
  if (!doc || doc.organizationId !== session.organizationId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  if (accessScope) {
    await db.updateDocumentAccessScope(id, accessScope);
  }

  if (Array.isArray(accessRules)) {
    await db.setDocumentAccessRules(id, accessRules);
  }

  await db.createAuditLog({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: 'DOCUMENT_PERMISSIONS_UPDATED',
    entityType: 'document',
    entityId: id,
    metadata: { accessScope, accessRulesCount: accessRules?.length },
  });

  const updated = await db.getDocument(id, session.user.id);
  return NextResponse.json({ success: true, document: updated });
}
