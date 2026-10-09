from hub.models import Profile, Organization, OrganizationMembership, OrgRole
from hub.services.seed import DEMO_USERS, DEMO_ORG_ID, EXTERNAL_ORG_ID


def session_context(request):
    active_user_id = request.session.get('auth_user_id', DEMO_USERS['admin']['id'])
    active_org_id = request.session.get('auth_org_id', DEMO_ORG_ID)

    user = Profile.objects.filter(id=active_user_id).first()
    org = Organization.objects.filter(id=active_org_id).first()

    membership = None
    if user and org:
        membership = OrganizationMembership.objects.filter(organization=org, user=user).first()

    role = membership.role if membership else OrgRole.MEMBER
    is_admin = role in [OrgRole.ADMIN, OrgRole.OWNER]
    is_editor = role in [OrgRole.EDITOR, OrgRole.ADMIN, OrgRole.OWNER]

    demo_user_list = [
        {
            "id": u["id"],
            "full_name": u["full_name"],
            "email": u["email"],
            "role": u["role"],
            "department": u["department"],
            "is_external": u["id"] == DEMO_USERS["unauthorizedUser"]["id"],
        }
        for u in DEMO_USERS.values()
    ]

    return {
        "current_user": user,
        "current_org": org,
        "current_role": role,
        "current_department": membership.department if membership else "General",
        "is_admin": is_admin,
        "is_editor": is_editor,
        "demo_users": demo_user_list,
    }
