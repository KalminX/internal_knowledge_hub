import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { canUploadDocuments } from '@/lib/auth/rbac';
import { processDocumentIngestion } from '@/lib/ingestion/pipeline';

export async function GET() {
  const session = await getCurrentSession();
  const docs = await db.listDocuments(session.organizationId, session.user.id);
  const jobs = await db.listIngestionJobs(session.organizationId);

  return NextResponse.json({
    documents: docs,
    jobs: jobs.slice(0, 20),
    canUpload: canUploadDocuments(session.role),
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!canUploadDocuments(session.role)) {
      return NextResponse.json({ error: 'Forbidden: insufficient role to upload documents' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || (file?.name.replace(/\.[^/.]+$/, '') || 'Untitled Document');
    const category = (formData.get('category') as string) || 'General';
    const accessScope = (formData.get('accessScope') as any) || 'organization';
    const existingDocumentId = (formData.get('existingDocumentId') as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: 'No file attached' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processDocumentIngestion({
      organizationId: session.organizationId,
      userId: session.user.id,
      title,
      category,
      accessScope,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileBuffer: buffer,
      existingDocumentId,
    });

    return NextResponse.json({
      success: true,
      document: result.document,
      job: result.job,
      chunkCount: result.chunkCount,
      versionNumber: result.versionNumber,
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload processing failed' }, { status: 500 });
  }
}
