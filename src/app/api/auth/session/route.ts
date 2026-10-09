import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { DEMO_USERS, DEMO_ORG_ID, EXTERNAL_ORG_ID } from '@/lib/seed';

export async function GET() {
  const session = await getCurrentSession();
  return NextResponse.json({
    session,
    demoUsers: Object.values(DEMO_USERS).map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      department: u.department,
      organizationId: u.id === DEMO_USERS.unauthorizedUser.id ? EXTERNAL_ORG_ID : DEMO_ORG_ID,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId } = body;

  const matchingDemoUser = Object.values(DEMO_USERS).find(u => u.id === userId);
  if (!matchingDemoUser) {
    return NextResponse.json({ error: 'User not found in demo user list' }, { status: 404 });
  }

  const response = NextResponse.json({ success: true, userId });
  response.cookies.set('auth_user_id', userId, { path: '/', httpOnly: true, sameSite: 'lax' });
  response.cookies.set(
    'auth_org_id',
    userId === DEMO_USERS.unauthorizedUser.id ? EXTERNAL_ORG_ID : DEMO_ORG_ID,
    { path: '/', httpOnly: true, sameSite: 'lax' }
  );

  return response;
}
