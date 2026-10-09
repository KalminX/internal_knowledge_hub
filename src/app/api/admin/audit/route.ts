import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canViewAuditLogs } from '@/lib/auth/rbac';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!canViewAuditLogs(session.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const logs = await db.listAuditLogs(session.organizationId, 50);
  return NextResponse.json({ logs });
}
