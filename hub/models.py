import uuid
import json
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    domain = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    avatar_url = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.full_name} ({self.email})"


class OrgRole(models.TextChoices):
    OWNER = 'owner', 'Owner'
    ADMIN = 'admin', 'Admin'
    EDITOR = 'editor', 'Editor'
    MEMBER = 'member', 'Member'


class OrganizationMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='memberships')
    role = models.CharField(max_length=20, choices=OrgRole.choices, default=OrgRole.MEMBER)
    department = models.CharField(max_length=100, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('organization', 'user')

    def __str__(self):
        return f"{self.user.full_name} - {self.role} in {self.organization.name}"


class DocumentStatus(models.TextChoices):
    UPLOADING = 'uploading', 'Uploading'
    PROCESSING = 'processing', 'Processing'
    READY = 'ready', 'Ready'
    FAILED = 'failed', 'Failed'
    RETIRED = 'retired', 'Retired'


class DocumentAccessScope(models.TextChoices):
    ORGANIZATION = 'organization', 'Organization'
    RESTRICTED = 'restricted', 'Restricted'
    CONFIDENTIAL = 'confidential', 'Confidential'


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, null=True)
    category = models.CharField(max_length=100, default='General')
    status = models.CharField(max_length=20, choices=DocumentStatus.choices, default=DocumentStatus.UPLOADING)
    access_scope = models.CharField(max_length=20, choices=DocumentAccessScope.choices, default=DocumentAccessScope.ORGANIZATION)
    current_version_number = models.IntegerField(default=1)
    created_by = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class DocumentAccessRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='access_rules')
    target_type = models.CharField(max_length=50)  # 'role', 'user', 'department'
    target_value = models.CharField(max_length=255)
    can_view = models.BooleanField(default=True)
    can_edit = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    file_name = models.CharField(max_length=500)
    mime_type = models.CharField(max_length=100)
    file_size_bytes = models.BigIntegerField()
    storage_path = models.TextField()
    file_hash = models.CharField(max_length=128)
    embedding_model = models.CharField(max_length=100, default='mock-deterministic-v1')
    embedding_dimension = models.IntegerField(default=1536)
    chunk_count = models.IntegerField(default=0)
    created_by = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('document', 'version_number')


class DocumentChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks')
    version = models.ForeignKey(DocumentVersion, on_delete=models.CASCADE, related_name='chunks')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='chunks')
    chunk_index = models.IntegerField()
    content = models.TextField()
    token_count = models.IntegerField()
    heading_path = models.CharField(max_length=500, blank=True, null=True)
    page_number = models.IntegerField(default=1)
    embedding_json = models.TextField(blank=True, null=True)  # JSON-encoded float list for portable vector search
    metadata_json = models.TextField(default='{}')
    created_at = models.DateTimeField(auto_now_add=True)

    def set_embedding(self, vector):
        self.embedding_json = json.dumps(vector)

    def get_embedding(self):
        if not self.embedding_json:
            return []
        return json.loads(self.embedding_json)


class IngestionStage(models.TextChoices):
    VALIDATION = 'validation', 'Validation'
    EXTRACTION = 'extraction', 'Extraction'
    NORMALIZATION = 'normalization', 'Normalization'
    CHUNKING = 'chunking', 'Chunking'
    EMBEDDING = 'embedding', 'Embedding'
    INDEXING = 'indexing', 'Indexing'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'


class IngestionJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='ingestion_jobs')
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='ingestion_jobs')
    version = models.ForeignKey(DocumentVersion, on_delete=models.CASCADE, related_name='ingestion_jobs')
    stage = models.CharField(max_length=30, choices=IngestionStage.choices, default=IngestionStage.VALIDATION)
    status = models.CharField(max_length=50, default='pending')  # 'pending', 'in_progress', 'completed', 'failed'
    error_message = models.TextField(blank=True, null=True)
    retry_count = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='conversations')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='conversations')
    title = models.CharField(max_length=255, default='New Knowledge Query')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='messages')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='messages')
    sender = models.CharField(max_length=20)  # 'user' | 'assistant'
    content = models.TextField()
    insufficient_evidence = models.BooleanField(default=False)
    model_used = models.CharField(max_length=100, blank=True, null=True)
    prompt_tokens = models.IntegerField(blank=True, null=True)
    completion_tokens = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


class MessageCitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='citations')
    chunk = models.ForeignKey(DocumentChunk, on_delete=models.CASCADE, related_name='citations')
    document_title = models.CharField(max_length=500)
    heading_path = models.CharField(max_length=500, blank=True, null=True)
    page_number = models.IntegerField(default=1)
    excerpt = models.TextField()
    similarity_score = models.FloatField(default=0.0)
    is_valid = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class FeedbackRating(models.TextChoices):
    HELPFUL = 'helpful', 'Helpful'
    UNHELPFUL = 'unhelpful', 'Unhelpful'


class AnswerFeedback(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='feedback')
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='feedback')
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='feedback')
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='feedback')
    rating = models.CharField(max_length=20, choices=FeedbackRating.choices)
    explanation = models.TextField(blank=True, null=True)
    reported_missing_doc = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class GapStatus(models.TextChoices):
    PENDING = 'pending', 'Pending'
    REVIEWED = 'reviewed', 'Reviewed'
    ADDRESSED = 'addressed', 'Addressed'
    DISMISSED = 'dismissed', 'Dismissed'


class UnansweredQuestion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='unanswered_questions')
    conversation = models.ForeignKey(Conversation, on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    question_text = models.TextField()
    reason = models.TextField()  # 'insufficient_evidence', 'user_unhelpful_feedback'
    status = models.CharField(max_length=20, choices=GapStatus.choices, default=GapStatus.PENDING)
    notes = models.TextField(blank=True, null=True)
    reviewed_by = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_gaps')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey(Profile, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=255, blank=True, null=True)
    metadata_json = models.TextField(default='{}')
    ip_address = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
