import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getCurrentSession();

  const conversation = await db.getConversation(id, session.user.id);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found or unauthorized' }, { status: 404 });
  }

  const messages = await db.listMessages(id, session.user.id);
  return NextResponse.json({ conversation, messages });
}
