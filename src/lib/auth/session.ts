import { cookies } from 'next/headers';
import { db } from '../db';
import { DEMO_USERS, DEMO_ORG_ID, EXTERNAL_ORG_ID } from '../seed';
import { OrgRole, UserProfile } from '../types';

export interface ActiveSession {
  user: UserProfile;
  organizationId: string;
  role: OrgRole;
  department?: string;
}

export async function getCurrentSession(): Promise<ActiveSession> {
  const cookieStore = await cookies();
  const activeUserId = cookieStore.get('auth_user_id')?.value || DEMO_USERS.admin.id;
  const activeOrgId = cookieStore.get('auth_org_id')?.value || DEMO_ORG_ID;

  // Check if demo user
  const matchingDemoUser = Object.values(DEMO_USERS).find(u => u.id === activeUserId);
  const targetOrgId = matchingDemoUser?.id === DEMO_USERS.unauthorizedUser.id ? EXTERNAL_ORG_ID : activeOrgId;

  let profile = await db.getProfile(activeUserId);
  if (!profile) {
    profile = {
      id: activeUserId,
      email: matchingDemoUser?.email || 'user@company.internal',
      fullName: matchingDemoUser?.fullName || 'Active User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await db.createOrUpdateProfile(profile);
  }

  let membership = await db.getMembership(targetOrgId, activeUserId);
  if (!membership) {
    const role = matchingDemoUser?.role || 'member';
    const dept = matchingDemoUser?.department || 'General';
    membership = await db.setMembershipRole(targetOrgId, activeUserId, role, dept);
  }

  return {
    user: profile,
    organizationId: targetOrgId,
    role: membership.role,
    department: membership.department,
  };
}
