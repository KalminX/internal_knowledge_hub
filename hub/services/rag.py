import json
from django.utils import timezone
from hub.models import (
    Conversation, Message, MessageCitation, UnansweredQuestion,
    AuditLog, Profile, Organization, DocumentChunk
)
from hub.services.retrieval import retrieve_authorized_context
from hub.services.llm import generate_grounded_answer
from hub.services.citations import validate_and_extract_citations


def execute_rag_pipeline(
    org_id: str,
    user_id: str,
    conversation_id: str,
    question: str
) -> dict:
    if not question or not question.strip():
        raise ValueError("Question text is required.")

    org = Organization.objects.get(id=org_id)
    user = Profile.objects.get(id=user_id)
    conversation = Conversation.objects.get(id=conversation_id, organization=org, user=user)

    # 1. Persist User Question Message
    user_msg = Message.objects.create(
        conversation=conversation,
        organization=org,
        user=user,
        sender="user",
        content=question.strip(),
    )

    # Update conversation title if first message
    if conversation.title == "New Knowledge Query":
        conversation.title = question.strip()[:45] + ("..." if len(question.strip()) > 45 else "")
        conversation.save()

    # 2. Authorized Vector Retrieval Boundary
    retrieval = retrieve_authorized_context(org_id, user_id, question.strip())

    # 3. LLM Grounded Generation
    generation = generate_grounded_answer(question.strip(), retrieval.results, retrieval.context_text)

    # 4. Citation Validation
    validation = validate_and_extract_citations(generation.answer, retrieval.results)

    # 5. Persist Assistant Response Message
    assistant_msg = Message.objects.create(
        conversation=conversation,
        organization=org,
        user=user,
        sender="assistant",
        content=validation.cleaned_answer,
        insufficient_evidence=generation.insufficient_evidence,
        model_used=generation.model_used,
        prompt_tokens=generation.prompt_tokens,
        completion_tokens=generation.completion_tokens,
    )

    # 6. Persist Citations
    citation_objs = []
    for cit in validation.citations:
        try:
            chunk = DocumentChunk.objects.get(id=cit.chunk_id)
            citation_objs.append(MessageCitation(
                message=assistant_msg,
                chunk=chunk,
                document_title=cit.document_title,
                heading_path=cit.heading_path,
                page_number=cit.page_number,
                excerpt=cit.excerpt,
                similarity_score=cit.similarity_score,
                is_valid=True,
            ))
        except DocumentChunk.DoesNotExist:
            continue

    if citation_objs:
        MessageCitation.objects.bulk_create(citation_objs)

    # 7. Knowledge Gap Automation: If insufficient evidence, queue in unanswered_questions
    if generation.insufficient_evidence:
        UnansweredQuestion.objects.create(
            organization=org,
            conversation=conversation,
            user=user,
            question_text=question.strip(),
            reason="insufficient_evidence",
            status="pending",
        )

    # 8. Audit Logging
    AuditLog.objects.create(
        organization=org,
        user=user,
        action="RAG_QUERY_EXECUTED",
        entity_type="conversation",
        entity_id=str(conversation.id),
        metadata_json=json.dumps({
            "retrieved_chunks_count": len(retrieval.results),
            "insufficient_evidence": generation.insufficient_evidence,
            "citations_count": len(validation.citations),
            "model_used": generation.model_used,
        }),
    )

    return {
        "conversation_id": str(conversation.id),
        "message_id": str(assistant_msg.id),
        "answer": validation.cleaned_answer,
        "insufficient_evidence": generation.insufficient_evidence,
        "citations": [
            {
                "chunk_id": c.chunk_id,
                "document_id": c.document_id,
                "document_title": c.document_title,
                "heading_path": c.heading_path,
                "page_number": c.page_number,
                "excerpt": c.excerpt,
                "similarity_score": c.similarity_score,
            }
            for c in validation.citations
        ],
        "model_used": generation.model_used,
    }


def stream_rag_pipeline(
    org_id: str,
    user_id: str,
    conversation_id: str,
    question: str
):
    import re
    import time

    if not question or not question.strip():
        yield f"data: {json.dumps({'type': 'error', 'error': 'Question text is required.'})}\n\n"
        return

    org = Organization.objects.get(id=org_id)
    user = Profile.objects.get(id=user_id)
    conversation = Conversation.objects.get(id=conversation_id, organization=org, user=user)

    # 1. Persist User Question Message
    user_msg = Message.objects.create(
        conversation=conversation,
        organization=org,
        user=user,
        sender="user",
        content=question.strip(),
    )

    if conversation.title == "New Knowledge Query":
        conversation.title = question.strip()[:45] + ("..." if len(question.strip()) > 45 else "")
        conversation.save()

    # 2. Authorized Vector Retrieval Boundary
    retrieval = retrieve_authorized_context(org_id, user_id, question.strip())

    # 3. LLM Grounded Generation
    generation = generate_grounded_answer(question.strip(), retrieval.results, retrieval.context_text)

    # 4. Citation Validation
    validation = validate_and_extract_citations(generation.answer, retrieval.results)

    # Stream tokens smoothly with high-cadence natural delivery
    tokens = re.split(r'(\s+)', validation.cleaned_answer)
    for token in tokens:
        if token:
            yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
            time.sleep(0.015)

    # 5. Persist Assistant Response Message
    assistant_msg = Message.objects.create(
        conversation=conversation,
        organization=org,
        user=user,
        sender="assistant",
        content=validation.cleaned_answer,
        insufficient_evidence=generation.insufficient_evidence,
        model_used=generation.model_used,
        prompt_tokens=generation.prompt_tokens,
        completion_tokens=generation.completion_tokens,
    )

    # 6. Persist Citations
    citation_objs = []
    citation_dicts = []
    for cit in validation.citations:
        try:
            chunk = DocumentChunk.objects.get(id=cit.chunk_id)
            citation_objs.append(MessageCitation(
                message=assistant_msg,
                chunk=chunk,
                document_title=cit.document_title,
                heading_path=cit.heading_path,
                page_number=cit.page_number,
                excerpt=cit.excerpt,
                similarity_score=cit.similarity_score,
                is_valid=True,
            ))
            citation_dicts.append({
                "chunk_id": cit.chunk_id,
                "document_id": cit.document_id,
                "document_title": cit.document_title,
                "heading_path": cit.heading_path,
                "page_number": cit.page_number,
                "excerpt": cit.excerpt,
                "similarity_score": cit.similarity_score,
            })
        except DocumentChunk.DoesNotExist:
            continue

    if citation_objs:
        MessageCitation.objects.bulk_create(citation_objs)

    # 7. Knowledge Gap Automation
    if generation.insufficient_evidence:
        UnansweredQuestion.objects.create(
            organization=org,
            conversation=conversation,
            user=user,
            question_text=question.strip(),
            reason="insufficient_evidence",
            status="pending",
        )

    # 8. Audit Logging
    AuditLog.objects.create(
        organization=org,
        user=user,
        action="RAG_QUERY_EXECUTED",
        entity_type="conversation",
        entity_id=str(conversation.id),
        metadata_json=json.dumps({
            "retrieved_chunks_count": len(retrieval.results),
            "insufficient_evidence": generation.insufficient_evidence,
            "citations_count": len(validation.citations),
            "model_used": generation.model_used,
        }),
    )

    # Yield citations packet
    yield f"data: {json.dumps({'type': 'citations', 'citations': citation_dicts})}\n\n"

    # Yield completion packet
    yield f"data: {json.dumps({'type': 'done', 'conversation_id': str(conversation.id), 'message_id': str(assistant_msg.id), 'insufficient_evidence': generation.insufficient_evidence, 'model_used': generation.model_used})}\n\n"

