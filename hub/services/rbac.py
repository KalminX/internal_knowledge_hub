from hub.models import OrgRole, DocumentAccessScope

ROLE_HIERARCHY = {
    OrgRole.OWNER: 40,
    OrgRole.ADMIN: 30,
    OrgRole.EDITOR: 20,
    OrgRole.MEMBER: 10,
}


def has_minimum_role(user_role: str, required_role: str) -> bool:
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)


def can_manage_organization(user_role: str) -> bool:
    return user_role == OrgRole.OWNER


def can_manage_members(user_role: str) -> bool:
    return has_minimum_role(user_role, OrgRole.ADMIN)


def can_upload_documents(user_role: str) -> bool:
    return has_minimum_role(user_role, OrgRole.EDITOR)


def can_retire_document(user_role: str) -> bool:
    return has_minimum_role(user_role, OrgRole.ADMIN)


def can_view_analytics(user_role: str) -> bool:
    return has_minimum_role(user_role, OrgRole.ADMIN)


def can_view_audit_logs(user_role: str) -> bool:
    return has_minimum_role(user_role, OrgRole.ADMIN)


def can_access_document(user_role: str, user_id: str, user_dept: str | None, document) -> bool:
    """
    Enforces document status and access scope boundary:
    - Non-ready documents are visible only to editors/admins/owners.
    - Admins and owners have access to all documents in the organization.
    - Organization-scoped documents are visible to all active members.
    - Restricted/Confidential documents require matching explicit rules or admin authority.
    """
    if document.status != 'ready':
        return has_minimum_role(user_role, OrgRole.EDITOR)

    if has_minimum_role(user_role, OrgRole.ADMIN):
        return True

    if document.access_scope == DocumentAccessScope.ORGANIZATION:
        return True

    # Check explicit document_access_rules
    rules = document.access_rules.filter(can_view=True)
    for rule in rules:
        if rule.target_type == 'user' and str(rule.target_value) == str(user_id):
            return True
        if rule.target_type == 'role' and rule.target_value == user_role:
            return True
        if rule.target_type == 'department' and user_dept and rule.target_value.lower() == user_dept.lower():
            return True

    return False
