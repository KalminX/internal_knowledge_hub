import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { canManageMembers } from '@/lib/auth/rbac';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  const members = await db.listMemberships(session.organizationId);
  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!canManageMembers(session.role)) {
    return NextResponse.json({ error: 'Forbidden: only admins can update member roles' }, { status: 403 });
  }

  const body = await req.json();
  const { targetUserId, role, department } = body;

  if (!targetUserId || !role) {
    return NextResponse.json({ error: 'targetUserId and role are required' }, { status: 400 });
  }

  // Prevent granting owner role unless caller is owner
  if (role === 'owner' && session.role !== 'owner') {
    return NextResponse.json({ error: 'Only owners can transfer or grant owner role' }, { status: 403 });
  }

  const updated = await db.setMembershipRole(session.organizationId, targetUserId, role, department);

  await db.createAuditLog({
    organizationId: session.organizationId,
    userId: session.user.id,
    action: 'MEMBER_ROLE_UPDATED',
    entityType: 'membership',
    entityId: targetUserId,
    metadata: { newRole: role, department },
  });

  return NextResponse.json({ success: true, member: updated });
}
