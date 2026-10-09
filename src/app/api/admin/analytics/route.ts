import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canViewAnalytics } from '@/lib/auth/rbac';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!canViewAnalytics(session.role)) {
    return NextResponse.json({ error: 'Forbidden: admin access required' }, { status: 403 });
  }

  const summary = await db.getAnalyticsSummary(session.organizationId);
  return NextResponse.json({ summary });
}
