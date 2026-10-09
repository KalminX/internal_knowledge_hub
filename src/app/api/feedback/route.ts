import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const body = await req.json();
    const { conversationId, messageId, rating, explanation, reportedMissingDoc } = body;

    if (!conversationId || !messageId || !rating) {
      return NextResponse.json({ error: 'Missing required feedback fields' }, { status: 400 });
    }

    const item = await db.createFeedback({
      organizationId: session.organizationId,
      conversationId,
      messageId,
      userId: session.user.id,
      rating,
      explanation,
      reportedMissingDoc: !!reportedMissingDoc,
    });

    return NextResponse.json({ success: true, feedback: item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
