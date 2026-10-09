-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingestion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Security Helper Functions
CREATE OR REPLACE FUNCTION get_user_org_ids(lookup_user_id UUID)
RETURNS TABLE (org_id UUID) SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT organization_id FROM organization_memberships
    WHERE user_id = lookup_user_id AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_org_role(lookup_org_id UUID, lookup_user_id UUID)
RETURNS org_role SECURITY DEFINER STABLE AS $$
DECLARE
    found_role org_role;
BEGIN
    SELECT role INTO found_role FROM organization_memberships
    WHERE organization_id = lookup_org_id AND user_id = lookup_user_id AND is_active = TRUE;
    RETURN found_role;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION user_can_access_doc(lookup_doc_id UUID, lookup_user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
DECLARE
    v_doc documents%ROWTYPE;
    v_role org_role;
    v_has_rule BOOLEAN;
BEGIN
    SELECT * INTO v_doc FROM documents WHERE id = lookup_doc_id;
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Document must be ready (not uploading/processing/retired/failed for regular reads)
    IF v_doc.status != 'ready' THEN
        -- Check if user is owner/admin/editor who can see non-ready docs
        v_role := get_user_org_role(v_doc.organization_id, lookup_user_id);
        IF v_role IN ('owner', 'admin', 'editor') THEN
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;

    -- If doc has organization-wide scope, all members of that org have read access
    IF v_doc.access_scope = 'organization' THEN
        RETURN EXISTS (
            SELECT 1 FROM organization_memberships
            WHERE organization_id = v_doc.organization_id AND user_id = lookup_user_id AND is_active = TRUE
        );
    END IF;

    -- If doc has restricted/confidential scope, check rules and admin roles
    v_role := get_user_org_role(v_doc.organization_id, lookup_user_id);
    IF v_role IN ('owner', 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Check explicit document_access_rules
    SELECT EXISTS (
        SELECT 1 FROM document_access_rules
        WHERE document_id = lookup_doc_id AND can_view = TRUE AND (
            (target_type = 'user' AND target_value = lookup_user_id::text) OR
            (target_type = 'role' AND target_value = v_role::text)
        )
    ) INTO v_has_rule;

    RETURN v_has_rule;
END;
$$ LANGUAGE plpgsql;

-- Vector Retrieval Stored Procedure enforcing organization boundary & document access
CREATE OR REPLACE FUNCTION match_document_chunks_authorized(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT,
    filter_org_id UUID,
    requesting_user_id UUID
)
RETURNS TABLE (
    chunk_id UUID,
    document_id UUID,
    version_id UUID,
    content TEXT,
    heading_path TEXT,
    page_number INT,
    document_title VARCHAR,
    similarity FLOAT
)
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Verify caller is an active member of the requested organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_memberships
        WHERE organization_id = filter_org_id AND user_id = requesting_user_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Access denied to organization %', filter_org_id;
    END IF;

    RETURN QUERY
    SELECT
        c.id AS chunk_id,
        c.document_id,
        c.version_id,
        c.content,
        c.heading_path,
        c.page_number,
        d.title AS document_title,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM document_chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE c.organization_id = filter_org_id
      AND d.status = 'ready'
      AND user_can_access_doc(d.id, requesting_user_id) = TRUE
      AND (1 - (c.embedding <=> query_embedding)) >= match_threshold
    ORDER BY c.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security Policies
-- Profiles: Users can read profiles in the same org, update their own profile
CREATE POLICY "Users can view profile" ON profiles
    FOR SELECT USING (auth.uid() = id OR id IN (
        SELECT user_id FROM organization_memberships WHERE organization_id IN (SELECT get_user_org_ids(auth.uid()))
    ));

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Organizations: Members can view their orgs
CREATE POLICY "Members can view their orgs" ON organizations
    FOR SELECT USING (id IN (SELECT get_user_org_ids(auth.uid())));

-- Organization Memberships: Org members can view members; Admins/Owners can manage
CREATE POLICY "Members can view org members" ON organization_memberships
    FOR SELECT USING (organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Admins and owners can update memberships" ON organization_memberships
    FOR ALL USING (get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin'));

-- Documents: Members can view authorized docs; Editors/Admins/Owners can insert/update/retire
CREATE POLICY "Authorized members can view documents" ON documents
    FOR SELECT USING (user_can_access_doc(id, auth.uid()));

CREATE POLICY "Editors and admins can manage documents" ON documents
    FOR ALL USING (get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin', 'editor'));

-- Document Chunks: Read allowed only if doc is authorized
CREATE POLICY "View chunks of authorized documents" ON document_chunks
    FOR SELECT USING (user_can_access_doc(document_id, auth.uid()));

-- Ingestion Jobs: Organization managers can view and trigger jobs
CREATE POLICY "Managers can view ingestion jobs" ON ingestion_jobs
    FOR SELECT USING (get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin', 'editor'));

-- Conversations & Messages: Users can view & manage their own conversations in their org
CREATE POLICY "Users manage own conversations" ON conversations
    FOR ALL USING (user_id = auth.uid() AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Users manage own messages" ON messages
    FOR ALL USING (user_id = auth.uid() AND organization_id IN (SELECT get_user_org_ids(auth.uid())));

CREATE POLICY "Users view own message citations" ON message_citations
    FOR SELECT USING (message_id IN (SELECT id FROM messages WHERE user_id = auth.uid()));

-- Feedback: Users can create feedback on their messages; Admins can view all org feedback
CREATE POLICY "Users create feedback and admins view org feedback" ON answer_feedback
    FOR ALL USING (
        user_id = auth.uid() OR
        get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin')
    );

-- Unanswered questions: Org admins can view and update gaps
CREATE POLICY "Admins manage unanswered questions" ON unanswered_questions
    FOR ALL USING (get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin'));

-- Audit logs: Admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
    FOR SELECT USING (get_user_org_role(organization_id, auth.uid()) IN ('owner', 'admin'));
