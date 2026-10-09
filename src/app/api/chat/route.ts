import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { executeRagPipeline } from '@/lib/rag/service';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    const body = await req.json();
    let { conversationId } = body;
    const { question } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json({ error: 'Valid question text is required' }, { status: 400 });
    }

    // Auto-create conversation if missing
    if (!conversationId) {
      const newConv = await db.createConversation(
        session.organizationId,
        session.user.id,
        question.slice(0, 45) + (question.length > 45 ? '...' : '')
      );
      conversationId = newConv.id;
    }

    const result = await executeRagPipeline({
      organizationId: session.organizationId,
      userId: session.user.id,
      conversationId,
      question: question.trim(),
    });

    const messages = await db.listMessages(conversationId, session.user.id);

    return NextResponse.json({
      conversationId,
      answer: result.answer,
      insufficientEvidence: result.insufficientEvidence,
      citations: result.citations,
      modelUsed: result.modelUsed,
      confidenceScore: result.confidenceScore,
      messages,
    });
  } catch (err: any) {
    console.error('Chat API pipeline error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
