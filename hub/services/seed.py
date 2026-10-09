import uuid
from hub.models import (
    Organization, Profile, OrganizationMembership, OrgRole,
    Document, DocumentAccessRule, DocumentAccessScope,
    Conversation, Message, AnswerFeedback, UnansweredQuestion, AuditLog
)
from hub.services.ingestion import process_document_ingestion
from hub.services.rag import execute_rag_pipeline

DEMO_ORG_ID = "00000000-0000-0000-0000-000000000001"
EXTERNAL_ORG_ID = "00000000-0000-0000-0000-000000000002"

DEMO_USERS = {
    "admin": {
        "id": "11111111-1111-1111-1111-111111111111",
        "email": "sarah.admin@acme.internal",
        "full_name": "Sarah Connor (Admin)",
        "role": OrgRole.ADMIN,
        "department": "Operations",
    },
    "editor": {
        "id": "22222222-2222-2222-2222-222222222222",
        "email": "david.editor@acme.internal",
        "full_name": "David Miller (Editor)",
        "role": OrgRole.EDITOR,
        "department": "People Operations",
    },
    "engineer": {
        "id": "33333333-3333-3333-3333-333333333333",
        "email": "alex.engineer@acme.internal",
        "full_name": "Alex Rivera (Engineer)",
        "role": OrgRole.MEMBER,
        "department": "Engineering",
    },
    "support": {
        "id": "44444444-4444-4444-4444-444444444444",
        "email": "emma.support@acme.internal",
        "full_name": "Emma Watson (Support)",
        "role": OrgRole.MEMBER,
        "department": "Customer Support",
    },
    "unauthorizedUser": {
        "id": "99999999-9999-9999-9999-999999999999",
        "email": "eve.outsider@competitor.com",
        "full_name": "Eve Hacker (External)",
        "role": OrgRole.MEMBER,
        "department": "External",
    },
}

SEED_DOCUMENTS = [
    {
        "title": "Employee Onboarding & Equipment Handbook",
        "category": "Human Resources",
        "access_scope": "organization",
        "file_name": "employee_onboarding_handbook.md",
        "mime_type": "text/markdown",
        "content": """# Employee Onboarding & Equipment Handbook

## 1. Welcome and First Week Logistics
Welcome to the company! During your first three days, you must complete your security training module in the internal portal and verify your multi-factor authentication setup. Your manager will schedule an introductory 1-on-1 on Day 1.

## 2. Hardware and Equipment Provisioning
All full-time engineering and product staff are eligible for a standard Apple MacBook Pro 16" (M-series, 32GB RAM) or Dell XPS 15. Accessories include one 4K external monitor, an ergonomic keyboard, and a mouse. 
Hardware refresh cycles occur every 36 months. For hardware replacement or lost equipment, immediately submit an IT ticket with category "Hardware Refresh" or "Lost Device Incident".

## 3. Home Office Stipend
Eligible remote employees receive a one-time remote setup stipend of $1,000 within their first 60 days. In addition, an ongoing monthly wellness and connectivity reimbursement of $75 is distributed via the regular payroll cycle. Receipts for the initial $1,000 stipend must be submitted through the expense portal within 30 days of purchase.

## 4. Key Company Tools & Access
- Primary Chat: Slack (Workspace: internal-team.slack.com)
- Project Tracking: Jira & GitHub Enterprise
- Knowledge Base & SOPs: Secure Knowledge Hub
- Payroll & Benefits: Gusto / Workday
"""
    },
    {
        "title": "Leave and Paid Time Off (PTO) Policy",
        "category": "Human Resources",
        "access_scope": "organization",
        "file_name": "leave_and_pto_policy.md",
        "mime_type": "text/markdown",
        "content": """# Leave and Paid Time Off (PTO) Policy

## 1. Annual PTO Entitlement
All regular full-time employees accrue 20 business days (160 hours) of Paid Time Off per calendar year. Accrual begins on your first day of employment at a rate of 1.66 days per completed calendar month. 

## 2. Request and Approval Procedure
- PTO requests of 3 consecutive days or fewer require at least 48 hours advance notice to your direct supervisor in the HR portal.
- PTO requests exceeding 4 consecutive days require at least 2 weeks (10 business days) advance notice.
- Supervisors must approve or request adjustments to PTO submissions within 3 business days.

## 3. Rollover and Forfeiture Limits
A maximum of 5 unused PTO days (40 hours) may be rolled over into the subsequent calendar year. All rolled-over PTO must be utilized before March 31st of the new year, or it will be automatically forfeited. Unused PTO is not paid out in cash during active employment, except where explicitly mandated by local statutory law upon termination.

## 4. Sick Leave and Medical Absence
Employees receive 10 dedicated sick leave days per year, separate from vacation PTO. If a medical absence extends beyond 3 consecutive working days, an official medical practitioner certificate must be provided to People Ops (people-ops@company.internal).

## 5. Parental and Bereavement Leave
Primary caregivers are eligible for 16 weeks of fully paid parental leave following childbirth, adoption, or foster placement. Secondary caregivers receive 8 weeks of paid leave. Bereavement leave provides up to 5 consecutive paid days for immediate family members.
"""
    },
    {
        "title": "Customer Support Escalation & SLA Protocol",
        "category": "Customer Support",
        "access_scope": "organization",
        "file_name": "customer_support_escalations.md",
        "mime_type": "text/markdown",
        "content": """# Customer Support Escalation & SLA Protocol

## 1. Ticket Priority Tiers and Response SLAs
Customer tickets are categorized into four standard priority tiers:
- Priority 1 (Urgent / Outage): Initial response within 15 minutes. 24/7 coverage.
- Priority 2 (High / Degraded Core Feature): Initial response within 1 hour. Business hours + on-call.
- Priority 3 (Normal / General Inquiries): Initial response within 4 hours during business hours.
- Priority 4 (Low / Feature Requests): Initial response within 24 hours.

## 2. Tier 1 to Tier 2 Escalation Criteria
Tier 1 support agents must escalate tickets to Tier 2 Technical Support if:
1. The issue cannot be resolved using documented troubleshooting scripts within 25 minutes.
2. The customer reproduces an unhandled 500 error or database consistency failure.
3. The customer represents an Enterprise tier account ($50k+ ARR) experiencing degraded performance.

## 3. Management Escalation and Customer Outreach
If a Priority 1 ticket remains unresolved after 60 minutes, the Support Lead must notify the VP of Customer Success and activate the incident command bridge. An executive summary must be emailed to the affected enterprise account stakeholders every 2 hours until resolution.
"""
    },
    {
        "title": "Engineering Incident Response & Severity Matrix",
        "category": "Engineering",
        "access_scope": "organization",
        "file_name": "incident_response_sop.md",
        "mime_type": "text/markdown",
        "content": """# Engineering Incident Response & Severity Matrix

## 1. Severity Classification
- SEV-1 (Critical Outage): Full system downtime or critical data loss affecting >5% of active users.
- SEV-2 (Major Degradation): High-impact bug or partial outage affecting a primary workflow without complete system downtime.
- SEV-3 (Minor Incident): Non-critical service degradation with an available workaround.
- SEV-4 (Low Impact): Cosmetic bug or internal monitoring alert with no customer impact.

## 2. Incident Commander (IC) Responsibilities
When a SEV-1 or SEV-2 is declared:
1. The On-Call primary engineer assumes the role of Incident Commander (IC).
2. The IC creates a dedicated Slack channel: #inc-<YYYYMMDD>-<incident-title>.
3. The IC spins up the incident voice bridge and assigns a Communications Lead and Scribe.
4. The IC updates the public status page within 15 minutes of SEV-1 confirmation.

## 3. Post-Incident Review (Blameless Post-Mortem)
A blameless post-mortem document must be drafted within 48 hours of incident closure for all SEV-1 and SEV-2 incidents. The post-mortem review meeting must occur within 5 business days, focusing on root-cause analysis (5 Whys) and concrete remediation action items tracked in Jira.
"""
    },
    {
        "title": "Document Retention, Archiving & Compliance Policy",
        "category": "Legal & Compliance",
        "access_scope": "organization",
        "file_name": "document_retention_policy.md",
        "mime_type": "text/markdown",
        "content": """# Document Retention, Archiving & Compliance Policy

## 1. Policy Purpose and Scope
This policy establishes minimum mandatory retention periods for company records, contractual agreements, financial ledgers, employee records, and operational audit logs.

## 2. Retention Schedules
- Financial Records, Tax Filings, and Invoices: Retain for 7 years from filing date.
- Customer Contracts and Master Services Agreements (MSAs): Retain for 10 years following contract termination.
- Employee Personnel Files & Payroll Records: Retain for 7 years post-employment.
- Security Audit Logs and Access Records: Retain in hot storage for 90 days, immutable cold archive for 365 days.
- Temporary Internal Chat Messages (Slack Public): Retained for 180 days before automated purge.

## 3. Secure Destruction Procedures
Physical documents subject to expiration must be shredded using cross-cut shredders (DIN-66399 Level P-4 or higher). Digital storage records must be cryptographically erased using NIST SP 800-88 Rev. 1 compliant wiping procedures.
"""
    },
    {
        "title": "Corporate Password, MFA & Security Standard",
        "category": "Security",
        "access_scope": "organization",
        "file_name": "password_and_security_standard.md",
        "mime_type": "text/markdown",
        "content": """# Corporate Password, MFA & Security Standard

## 1. Password Complexity Rules
All company user accounts must adhere to the following baseline complexity requirements:
- Minimum length: 14 characters.
- Must contain uppercase letters, lowercase letters, numbers, and special symbols.
- Passwords must not contain common dictionary words, employee names, or sequential characters (e.g., "Company123!").
- Passwords expire every 90 days for privileged administrative accounts.

## 2. Multi-Factor Authentication (MFA) Requirements
MFA is mandatory across all internal SaaS tools, VPNs, single sign-on (SSO) gateways, and code repositories.
- Approved MFA methods: FIDO2 / WebAuthn hardware security keys (YubiKey) or TOTP authenticator apps (1Password, Google Authenticator).
- SMS and voice call verification are explicitly prohibited due to SIM-swapping vulnerabilities.

## 3. Session Timeouts and Device Locking
- Workstations must automatically lock after 5 minutes of inactivity.
- Web session cookies for internal portals expire after 12 hours of inactivity.
"""
    },
    {
        "title": "Executive Compensation & Restricted Strategy",
        "category": "Executive",
        "access_scope": "restricted",
        "file_name": "executive_compensation_strategy.md",
        "mime_type": "text/markdown",
        "content": """# Executive Compensation & Confidential Strategy

## 1. Restricted Access Notice
This document is strictly restricted to Organization Owners, Board Members, and designated HR Executives. Unauthorized access or dissemination is a violation of company policy.

## 2. Leadership Equity Vesting Schedule
Executive stock grants follow a 4-year vesting schedule with a 1-year cliff (25% vesting after month 12), followed by monthly linear vesting over the remaining 36 months. Accelerated change-of-control double-trigger clauses apply to VP-level and above roles.

## 3. Annual Discretionary Executive Bonus Formula
Executive bonuses are calculated annually based on corporate ARR target achievement (70% weighting) and individual departmental OKR scoring (30% weighting). Maximum bonus cap is 150% of target bonus.
"""
    }
]


def seed_demo_database():
    print("--- Initializing Django Secure Knowledge Hub Seed Data ---")

    # Clear existing data for clean idempotent seed
    AuditLog.objects.all().delete()
    AnswerFeedback.objects.all().delete()
    UnansweredQuestion.objects.all().delete()
    Message.objects.all().delete()
    Conversation.objects.all().delete()
    Document.objects.all().delete()
    OrganizationMembership.objects.all().delete()
    Profile.objects.all().delete()
    Organization.objects.all().delete()

    # 1. Organizations
    demo_org = Organization.objects.create(
        id=DEMO_ORG_ID,
        name="Acme Global Enterprises",
        slug="acme-corp",
        domain="acme.internal",
    )
    ext_org = Organization.objects.create(
        id=EXTERNAL_ORG_ID,
        name="Competitor External Org",
        slug="competitor-corp",
        domain="competitor.com",
    )

    # 2. Profiles and Memberships
    for user_key, udata in DEMO_USERS.items():
        profile = Profile.objects.create(
            id=udata["id"],
            email=udata["email"],
            full_name=udata["full_name"],
        )
        target_org = ext_org if user_key == "unauthorizedUser" else demo_org
        OrganizationMembership.objects.create(
            organization=target_org,
            user=profile,
            role=udata["role"],
            department=udata["department"],
            is_active=True,
        )

    # 3. Ingest Documents
    admin_id = DEMO_USERS["admin"]["id"]
    for doc in SEED_DOCUMENTS:
        res = process_document_ingestion(
            org_id=DEMO_ORG_ID,
            user_id=admin_id,
            title=doc["title"],
            file_name=doc["file_name"],
            mime_type=doc["mime_type"],
            file_bytes=doc["content"].encode('utf-8'),
            category=doc["category"],
            access_scope=doc["access_scope"],
        )

        if doc["access_scope"] == "restricted":
            DocumentAccessRule.objects.create(
                document=res["document"],
                target_type="role",
                target_value="admin",
                can_view=True,
                can_edit=True,
            )

        print(f" Indexed: {doc['title']} ({res['chunk_count']} chunks, scope: {doc['access_scope']})")

    # 4. Sample Conversations & Queries
    eng_id = DEMO_USERS["engineer"]["id"]
    conv1 = Conversation.objects.create(
        organization=demo_org,
        user=Profile.objects.get(id=eng_id),
        title="PTO Accrual & Rollover Limits",
    )
    execute_rag_pipeline(
        org_id=DEMO_ORG_ID,
        user_id=eng_id,
        conversation_id=str(conv1.id),
        question="How many days of PTO can I roll over into the new year and what is the deadline?",
    )

    # Add positive feedback
    asst_msg = Message.objects.filter(conversation=conv1, sender="assistant").first()
    if asst_msg:
        AnswerFeedback.objects.create(
            organization=demo_org,
            conversation=conv1,
            message=asst_msg,
            user=Profile.objects.get(id=eng_id),
            rating="helpful",
            explanation="Grounded and cited the PTO policy directly.",
        )

    # Support SLA query
    supp_id = DEMO_USERS["support"]["id"]
    conv2 = Conversation.objects.create(
        organization=demo_org,
        user=Profile.objects.get(id=supp_id),
        title="Priority 1 Support SLA",
    )
    execute_rag_pipeline(
        org_id=DEMO_ORG_ID,
        user_id=supp_id,
        conversation_id=str(conv2.id),
        question="What is the required initial response time for Priority 1 urgent tickets?",
    )

    # Missing doc query (abstention)
    conv3 = Conversation.objects.create(
        organization=demo_org,
        user=Profile.objects.get(id=eng_id),
        title="Company Pet Policy",
    )
    execute_rag_pipeline(
        org_id=DEMO_ORG_ID,
        user_id=eng_id,
        conversation_id=str(conv3.id),
        question="What is the company policy on bringing pets to the office and pet insurance?",
    )

    print("✅ Seed successfully finished with realistic documents, conversations, citations, and metrics.")
