import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  const list = await db.listConversations(session.organizationId, session.user.id);
  return NextResponse.json({ conversations: list });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  const body = await req.json().catch(() => ({}));
  const title = body.title || 'New Knowledge Query';

  const conv = await db.createConversation(session.organizationId, session.user.id, title);
  return NextResponse.json({ conversation: conv });
}
