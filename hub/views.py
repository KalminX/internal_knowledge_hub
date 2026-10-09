import json
from django.shortcuts import render, redirect, get_object_or_404
from django.http import JsonResponse, HttpResponseForbidden
from django.views.decorators.http import require_POST, require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Count, Q

from hub.models import (
    Organization, Profile, OrganizationMembership, OrgRole,
    Document, DocumentVersion, DocumentChunk, DocumentAccessRule,
    DocumentStatus, DocumentAccessScope, IngestionJob,
    Conversation, Message, MessageCitation, AnswerFeedback,
    UnansweredQuestion, AuditLog
)
from hub.services.rbac import (
    can_upload_documents, can_retire_document, can_manage_members,
    can_view_analytics, can_view_audit_logs, can_access_document
)
from hub.services.ingestion import process_document_ingestion, retire_document
from hub.services.rag import execute_rag_pipeline
from hub.services.seed import DEMO_USERS, DEMO_ORG_ID, EXTERNAL_ORG_ID


def get_current_user_and_org(request):
    user_id = request.session.get('auth_user_id', DEMO_USERS['admin']['id'])
    org_id = request.session.get('auth_org_id', DEMO_ORG_ID)

    user = Profile.objects.filter(id=user_id).first()
    org = Organization.objects.filter(id=org_id).first()
    membership = None
    if user and org:
        membership = OrganizationMembership.objects.filter(organization=org, user=user).first()
    role = membership.role if membership else OrgRole.MEMBER

    return user, org, membership, role


def chat_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not user or not org:
        return redirect('switch_user')

    conversations = Conversation.objects.filter(organization=org, user=user).order_by('-updated_at')
    active_conv_id = request.GET.get('conv')

    active_conv = None
    if active_conv_id:
        active_conv = conversations.filter(id=active_conv_id).first()
    elif conversations.exists():
        active_conv = conversations.first()

    messages = []
    if active_conv:
        messages = Message.objects.filter(conversation=active_conv).prefetch_related('citations').order_by('created_at')

    sample_prompts = [
        {"label": "PTO Rollover Rules", "query": "How many days of PTO can I roll over into the new year and what is the deadline?"},
        {"label": "P1 Ticket SLA", "query": "What is the required response time for Priority 1 urgent tickets?"},
        {"label": "Remote Setup Stipend", "query": "What is the home office setup stipend for remote employees?"},
        {"label": "Executive Strategy (Restricted)", "query": "What is the leadership equity vesting schedule and bonus formula?"},
        {"label": "Pet Policy (Missing Doc)", "query": "What is the company policy on bringing pets to the office and pet insurance?"},
    ]

    return render(request, 'hub/chat.html', {
        'conversations': conversations,
        'active_conv': active_conv,
        'messages': messages,
        'sample_prompts': sample_prompts,
        'active_tab': 'chat',
    })


@require_POST
def send_message_api(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not user or not org:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = json.loads(request.body.decode('utf-8'))
    question = data.get('question', '').strip()
    conv_id = data.get('conversation_id')

    if not question:
        return JsonResponse({'error': 'Question is required'}, status=400)

    if not conv_id:
        new_conv = Conversation.objects.create(
            organization=org,
            user=user,
            title=question[:45] + ("..." if len(question) > 45 else "")
        )
        conv_id = str(new_conv.id)

    try:
        result = execute_rag_pipeline(
            org_id=str(org.id),
            user_id=str(user.id),
            conversation_id=conv_id,
            question=question
        )
        return JsonResponse(result)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


@require_POST
def send_message_stream_api(request):
    from django.http import StreamingHttpResponse
    from hub.services.rag import stream_rag_pipeline

    user, org, membership, role = get_current_user_and_org(request)
    if not user or not org:
        return JsonResponse({'error': 'Unauthorized'}, status=401)

    data = json.loads(request.body.decode('utf-8'))
    question = data.get('question', '').strip()
    conv_id = data.get('conversation_id')

    if not question:
        return JsonResponse({'error': 'Question is required'}, status=400)

    if not conv_id:
        new_conv = Conversation.objects.create(
            organization=org,
            user=user,
            title=question[:45] + ("..." if len(question) > 45 else "")
        )
        conv_id = str(new_conv.id)

    response = StreamingHttpResponse(
        stream_rag_pipeline(
            org_id=str(org.id),
            user_id=str(user.id),
            conversation_id=conv_id,
            question=question
        ),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


def new_chat_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if user and org:
        conv = Conversation.objects.create(
            organization=org,
            user=user,
            title="New Knowledge Query"
        )
        return redirect(f"/chat/?conv={conv.id}")
    return redirect('chat')


def documents_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not user or not org:
        return redirect('chat')

    search_query = request.GET.get('q', '').strip()
    category_filter = request.GET.get('category', 'all')
    status_filter = request.GET.get('status', 'all')

    docs_qs = Document.objects.filter(organization=org).prefetch_related('access_rules').order_by('-created_at')

    # Filter by user authorization
    authorized_docs = []
    for d in docs_qs:
        if can_access_document(role, str(user.id), membership.department if membership else None, d):
            authorized_docs.append(d)

    # Apply UI filters
    filtered_docs = authorized_docs
    if search_query:
        filtered_docs = [d for d in filtered_docs if search_query.lower() in d.title.lower() or search_query.lower() in d.category.lower()]
    if category_filter != 'all':
        filtered_docs = [d for d in filtered_docs if d.category == category_filter]
    if status_filter != 'all':
        filtered_docs = [d for d in filtered_docs if d.status == status_filter]

    categories = list(set(d.category for d in authorized_docs))

    return render(request, 'hub/documents.html', {
        'documents': filtered_docs,
        'categories': categories,
        'search_query': search_query,
        'selected_category': category_filter,
        'selected_status': status_filter,
        'can_upload': can_upload_documents(role),
        'active_tab': 'documents',
    })


@require_POST
def document_upload_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_upload_documents(role):
        return HttpResponseForbidden("Forbidden: insufficient permissions to upload documents.")

    file = request.FILES.get('file')
    if not file:
        return JsonResponse({'error': 'No file uploaded'}, status=400)

    title = request.POST.get('title') or file.name.rsplit('.', 1)[0]
    category = request.POST.get('category') or 'General'
    access_scope = request.POST.get('access_scope') or 'organization'

    try:
        result = process_document_ingestion(
            org_id=str(org.id),
            user_id=str(user.id),
            title=title,
            file_name=file.name,
            mime_type=file.content_type or 'application/octet-stream',
            file_bytes=file.read(),
            category=category,
            access_scope=access_scope,
        )
        return redirect('documents')
    except Exception as e:
        return render(request, 'hub/documents.html', {'error': str(e), 'active_tab': 'documents'})


@require_POST
def document_retire_view(request, doc_id):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_retire_document(role):
        return HttpResponseForbidden("Forbidden: only admins can retire documents.")

    doc = get_object_or_404(Document, id=doc_id, organization=org)
    if doc.status == DocumentStatus.RETIRED:
        doc.status = DocumentStatus.READY
        doc.save()
    else:
        retire_document(str(org.id), str(doc.id), str(user.id))

    return redirect('documents')


@require_POST
def document_rules_view(request, doc_id):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_manage_members(role):
        return HttpResponseForbidden("Forbidden: only admins can manage document rules.")

    doc = get_object_or_404(Document, id=doc_id, organization=org)
    scope = request.POST.get('access_scope', 'organization')
    doc.access_scope = scope
    doc.save()

    doc.access_rules.all().delete()
    if scope == 'restricted':
        DocumentAccessRule.objects.create(
            document=doc,
            target_type='role',
            target_value='admin',
            can_view=True,
            can_edit=True,
        )

    AuditLog.objects.create(
        organization=org,
        user=user,
        action="DOCUMENT_PERMISSIONS_UPDATED",
        entity_type="document",
        entity_id=str(doc.id),
        metadata_json=json.dumps({"new_scope": scope}),
    )

    return redirect('documents')


def members_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_manage_members(role):
        return HttpResponseForbidden("Forbidden: admin access required.")

    members = OrganizationMembership.objects.filter(organization=org).select_related('user').order_by('user__full_name')

    if request.method == 'POST':
        target_user_id = request.POST.get('user_id')
        new_role = request.POST.get('role')
        target_mem = OrganizationMembership.objects.filter(organization=org, user_id=target_user_id).first()
        if target_mem and new_role:
            target_mem.role = new_role
            target_mem.save()
            AuditLog.objects.create(
                organization=org,
                user=user,
                action="MEMBER_ROLE_UPDATED",
                entity_type="membership",
                entity_id=str(target_user_id),
                metadata_json=json.dumps({"new_role": new_role}),
            )
            return redirect('members')

    return render(request, 'hub/members.html', {
        'members': members,
        'active_tab': 'members',
    })


def analytics_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_view_analytics(role):
        return HttpResponseForbidden("Forbidden: admin access required.")

    total_questions = Message.objects.filter(organization=org, sender='user').count()
    insufficient_count = Message.objects.filter(organization=org, sender='assistant', insufficient_evidence=True).count()

    positive_feedback = AnswerFeedback.objects.filter(organization=org, rating='helpful').count()
    negative_feedback = AnswerFeedback.objects.filter(organization=org, rating='unhelpful').count()
    total_feedback = positive_feedback + negative_feedback
    satisfaction_rate = round((positive_feedback / total_feedback) * 100) if total_feedback > 0 else 100
    abstention_rate = round((insufficient_count / total_questions) * 100) if total_questions > 0 else 0

    total_docs = Document.objects.filter(organization=org).count()
    ready_docs = Document.objects.filter(organization=org, status='ready').count()
    failed_jobs = IngestionJob.objects.filter(organization=org, status='failed').count()

    # Top cited docs
    top_citations = (
        MessageCitation.objects.filter(message__organization=org)
        .values('document_title')
        .annotate(count=Count('id'))
        .order_by('-count')[:5]
    )

    # Topics breakdown
    user_questions = Message.objects.filter(organization=org, sender='user').values_list('content', flat=True)
    topics = {}
    for q in user_questions:
        ql = q.lower()
        topic = "General Operations"
        if any(w in ql for w in ['leave', 'pto', 'vacation', 'sick']):
            topic = "Leave & Attendance Policies"
        elif any(w in ql for w in ['incident', 'escalat', 'outage', 'sev1', 'sev2']):
            topic = "Incident Response & Escalations"
        elif any(w in ql for w in ['security', 'password', 'mfa', 'auth']):
            topic = "Security & Account Policies"
        elif any(w in ql for w in ['onboard', 'laptop', 'equipment', 'stipend']):
            topic = "New Hire Onboarding & Hardware"
        elif any(w in ql for w in ['retention', 'shred', 'compliance']):
            topic = "Document Retention & Compliance"
        topics[topic] = topics.get(topic, 0) + 1

    topic_bars = [
        {"topic": t, "count": c, "pct": round((c / total_questions) * 100) if total_questions > 0 else 0}
        for t, c in sorted(topics.items(), key=lambda x: x[1], reverse=True)
    ]

    return render(request, 'hub/analytics.html', {
        'total_questions': total_questions,
        'satisfaction_rate': satisfaction_rate,
        'abstention_rate': abstention_rate,
        'insufficient_count': insufficient_count,
        'positive_feedback': positive_feedback,
        'negative_feedback': negative_feedback,
        'total_docs': total_docs,
        'ready_docs': ready_docs,
        'failed_jobs': failed_jobs,
        'top_citations': top_citations,
        'topic_bars': topic_bars,
        'active_tab': 'analytics',
    })


def gaps_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_view_analytics(role):
        return HttpResponseForbidden("Forbidden: admin access required.")

    gaps = UnansweredQuestion.objects.filter(organization=org).order_by('-created_at')

    if request.method == 'POST':
        gap_id = request.POST.get('gap_id')
        new_status = request.POST.get('status')
        gap = UnansweredQuestion.objects.filter(organization=org, id=gap_id).first()
        if gap and new_status:
            gap.status = new_status
            gap.reviewed_by = user
            gap.save()
            return redirect('gaps')

    return render(request, 'hub/gaps.html', {
        'gaps': gaps,
        'active_tab': 'gaps',
    })


def audit_view(request):
    user, org, membership, role = get_current_user_and_org(request)
    if not can_view_audit_logs(role):
        return HttpResponseForbidden("Forbidden: admin access required.")

    logs = AuditLog.objects.filter(organization=org).order_by('-created_at')[:50]

    return render(request, 'hub/audit.html', {
        'logs': logs,
        'active_tab': 'audit',
    })


def integrations_view(request):
    return render(request, 'hub/integrations.html', {
        'active_tab': 'integrations',
    })


@require_POST
def switch_user_view(request):
    user_id = request.POST.get('user_id')
    matching_user = next((u for u in DEMO_USERS.values() if u['id'] == user_id), None)
    if matching_user:
        request.session['auth_user_id'] = user_id
        request.session['auth_org_id'] = EXTERNAL_ORG_ID if user_id == DEMO_USERS['unauthorizedUser']['id'] else DEMO_ORG_ID

    referer = request.META.get('HTTP_REFERER', '/chat/')
    return redirect(referer)


@require_POST
def feedback_api(request):
    user, org, membership, role = get_current_user_and_org(request)
    data = json.loads(request.body.decode('utf-8'))

    conv_id = data.get('conversation_id')
    msg_id = data.get('message_id')
    rating = data.get('rating')
    explanation = data.get('explanation')
    missing_doc = data.get('reported_missing_doc', False)

    try:
        conv = Conversation.objects.get(id=conv_id, organization=org)
        msg = Message.objects.get(id=msg_id, conversation=conv)

        fb = AnswerFeedback.objects.create(
            organization=org,
            conversation=conv,
            message=msg,
            user=user,
            rating=rating,
            explanation=explanation,
            reported_missing_doc=missing_doc,
        )

        if rating == 'unhelpful' or missing_doc:
            prior_user_msg = Message.objects.filter(conversation=conv, sender='user', created_at__lte=msg.created_at).last()
            if prior_user_msg:
                UnansweredQuestion.objects.create(
                    organization=org,
                    conversation=conv,
                    user=user,
                    question_text=prior_user_msg.content,
                    reason="User reported missing documentation" if missing_doc else "User marked answer unhelpful",
                    status="pending",
                    notes=explanation,
                )

        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
