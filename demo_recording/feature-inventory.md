# Feature and User-Flow Inventory

**Application:** Secure Internal Knowledge Hub (Enterprise RAG Platform)  
**Inspection Date:** October 10, 2026  
**Auditor / Specialist:** Senior QA Engineer & Demo Recording Specialist  

---

## 1. Inventory Checklist

| ID | Feature / Workflow | User Role | Starting Screen | Actions Required | Expected Outcome | Actual Outcome | Include in Demo? | Blockers / Defects |
|---|---|---|---|---|---|---|---|---|
| **FEAT-01** | **Persona & RBAC Switcher** | All Roles | `/chat/` (Sidebar) | Change select dropdown between Member, Editor, Admin, Owner | Updates session, role permissions, and active organization context | ✅ Session & role update immediately | **Yes (Scene 1 & 4)** | None |
| **FEAT-02** | **Grounded Query & SSE Streaming** | Member / All | `/chat/` | Click prompt starter or type policy question; submit | Tokens stream progressively with GSAP cursor; citations appear upon completion | ✅ Smooth token cadence & card reveal | **Yes (Scene 2)** | None |
| **FEAT-03** | **Interactive Source Citation Cards** | Member / All | `/chat/` | View cited evidence beneath answer | Shows title, match percentage, heading path, page number, and quote | ✅ Formatted with full metadata | **Yes (Scene 2)** | None |
| **FEAT-04** | **Answer Feedback (Helpful/Unhelpful)** | Member / All | `/chat/` | Click 👍 or 👎 on assistant message bubble | Logs rating in database, updates analytics metrics | ✅ Feedback stored & notification banner shown | **Yes (Scene 2)** | None |
| **FEAT-05** | **Permission-Aware Abstention** | Member | `/chat/` | Ask question on restricted document (e.g. Executive Compensation) | Explicit abstention: *"I couldn't find enough information in the documents you have access to..."* | ✅ Safe abstention with zero data leakage | **Yes (Scene 3)** | None |
| **FEAT-06** | **Knowledge Gap Submission** | Member | `/chat/` | Click *"Submit to Knowledge Gaps"* button on abstention card | Queues question in admin triage backlog at `/gaps/` | ✅ Logged with status `pending` | **Yes (Scene 3)** | None |
| **FEAT-07** | **Elevated Access Query** | Owner / Admin | `/chat/` | Switch to Owner; re-run restricted executive query | Full grounded answer with executive citations displayed | ✅ Authorized access granted | **Yes (Scene 4)** | None |
| **FEAT-08** | **Document Catalog & Filtering** | All Roles | `/documents/` | Filter by category (Operations/Compliance) and status (Ready/Retired) | Table updates to show matching documents and access badges | ✅ Dynamic server filtering | **Yes (Scene 5)** | None |
| **FEAT-09** | **Document Access Boundary Modal** | Admin / Owner | `/documents/` | Click *"Permissions"* button on document row | Modal opens with GSAP animation; save Organization vs Restricted scope | ✅ Scope updated; audit log generated | **Yes (Scene 5)** | None |
| **FEAT-10** | **Instant Document Retirement** | Admin / Owner | `/documents/` | Click *"Retire"* button on document row | Document status switches to `retired`; immediately excluded from retrieval | ✅ Document retired and badge changes to gray | **Yes (Scene 5)** | None |
| **FEAT-11** | **Multi-Format Ingestion Modal** | Admin / Editor | `/documents/` | Click *"Upload Document"*; preview file picker & scope selector | Modal renders cleanly with category, title, and scope fields | ✅ Ingestion modal opens smoothly | **Yes (Scene 5)** | None |
| **FEAT-12** | **Usage Telemetry & KPI Cards** | Admin / Owner | `/analytics/` | Navigate to `/analytics/` | Displays Total Queries, Satisfaction %, Abstention Rate %, Top Policy Categories | ✅ Real-time metric cards rendered | **Yes (Scene 6)** | None |
| **FEAT-13** | **Knowledge Gaps Triage Workflow** | Admin / Owner | `/gaps/` | Navigate to `/gaps/`; change question status from `pending` to `reviewed` | Status updates in DB and persists for compliance audit | ✅ Status updated successfully | **Yes (Scene 6)** | None |
| **FEAT-14** | **Security Audit Stream** | Admin / Owner | `/audit/` | Navigate to `/audit/` | Displays immutable log of RAG queries, ingestions, and permission updates | ✅ Chronological event stream verified | **Yes (Scene 7)** | None |
| **FEAT-15** | **Cloud Connectors Architecture** | All Roles | `/integrations/` | Navigate to `/integrations/` | Displays Google Drive & Microsoft SharePoint connector specifications & sync lifecycle | ✅ Connector interface verified | **Yes (Scene 7)** | None |
| **FEAT-16** | **Member Roles Management** | Admin / Owner | `/members/` | Navigate to `/members/` | Displays member roster and role promotion dropdown | ✅ Role hierarchy verified | Optional | None |

---

## 2. Summary of Test Coverage
- **16 distinct features** verified.
- **0 blockers or critical defects** identified.
- Core RAG, RBAC boundaries, SSE streaming, and lifecycle management are fully functional and ready for recording.
