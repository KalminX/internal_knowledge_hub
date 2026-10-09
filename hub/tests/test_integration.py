import pytest
from hub.models import Document, Conversation, Message, AnswerFeedback, AuditLog
from hub.services.seed import seed_demo_database, DEMO_ORG_ID, DEMO_USERS
from hub.services.ingestion import process_document_ingestion, retire_document
from hub.services.rag import execute_rag_pipeline


@pytest.fixture(autouse=True)
def setup_db(db):
    seed_demo_database()


def test_full_vertical_lifecycle(db):
    # 1. Admin uploads emergency policy
    new_doc_content = "# Emergency Payroll Advance Policy\n\n## 1. Rules\nEmployees may request up to $2,500 advance against earned wages in emergencies."
    ingest = process_document_ingestion(
        org_id=DEMO_ORG_ID,
        user_id=DEMO_USERS["admin"]["id"],
        title="Emergency Payroll Advance Policy",
        file_name="payroll_advance.md",
        mime_type="text/markdown",
        file_bytes=new_doc_content.encode('utf-8'),
    )
    assert ingest["document"].status == "ready"
    assert ingest["chunk_count"] > 0

    # 2. Engineer queries procedure
    conv = Conversation.objects.create(
        organization_id=DEMO_ORG_ID,
        user_id=DEMO_USERS["engineer"]["id"],
        title="Advance Query"
    )
    rag = execute_rag_pipeline(
        org_id=DEMO_ORG_ID,
        user_id=DEMO_USERS["engineer"]["id"],
        conversation_id=str(conv.id),
        question="What is the maximum emergency payroll advance amount?",
    )
    assert rag["insufficient_evidence"] is False
    assert len(rag["citations"]) > 0
    assert "2,500" in rag["answer"]

    # 3. User feedback
    asst_msg = Message.objects.get(id=rag["message_id"])
    fb = AnswerFeedback.objects.create(
        organization_id=DEMO_ORG_ID,
        conversation=conv,
        message=asst_msg,
        user_id=DEMO_USERS["engineer"]["id"],
        rating="helpful",
        explanation="Direct and accurate.",
    )
    assert fb.rating == "helpful"

    # 4. Audit logging
    assert AuditLog.objects.filter(organization_id=DEMO_ORG_ID).count() > 0

    # 5. Retire document
    retire_document(DEMO_ORG_ID, str(ingest["document"].id), DEMO_USERS["admin"]["id"])
    doc = Document.objects.get(id=ingest["document"].id)
    assert doc.status == "retired"
