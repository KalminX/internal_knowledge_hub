# Professional Screen Recording Storyboard

**Project:** Secure Internal Knowledge Hub (Enterprise RAG)  
**Target Video Specs:** 1280×720 (720p 16:9), 30 FPS, H.264 / yuv420p, Smooth Visible Cursor  
**Estimated Total Runtime:** ~75–90 seconds  

---

## Scene-by-Scene Storyboard

### Scene 1: Landing & Session Architecture (0:00 – 0:10)
- **Start Screen:** `/chat/` (Knowledge Assistant interface).
- **Visuals & Context:**
  - Dark enterprise UI with Linear/Vercel styling, Lucide icons, and session status bar.
  - Active persona: `Marcus Vance (MEMBER)` in `Acme Corporation`.
- **Actions:**
  - Cursor moves over the persona switcher and top header badges (`Tenant Verified`, `Scope: MEMBER`).
  - Cursor moves to the prompt starters grid.

### Scene 2: Grounded Q&A & Real-Time SSE Token Streaming (0:10 – 0:25)
- **Start Screen:** `/chat/`.
- **Actions:**
  - Cursor hovers over benchmark chip *"PTO Rollover Rules"*; clicks it.
  - Input populates with: *"How many days of PTO can I roll over into the new year and what is the deadline?"* and submits.
  - Assistant bubble enters; SSE stream streams answer tokens in real-time with active typing cursor.
  - Viewport auto-scrolls smoothly; GSAP staggered animation expands the verified citation card linking to *Leave and Paid Time Off (PTO) Policy* (5 days, March 31st, 90%+ match).
  - Cursor moves to the message footer and clicks the **Helpful (👍)** button.
  - Green confirmation toast appears.

### Scene 3: Security Boundary & Safe Abstention (0:25 – 0:38)
- **Start Screen:** `/chat/` (Still as `Marcus Vance - Member`).
- **Actions:**
  - Cursor clicks input field, types: *"What is the leadership equity vesting schedule and bonus formula?"*
  - Clicks **Query** button.
  - Assistant analyzes evidence boundary; detects that *Executive Compensation & Restricted Strategy* is restricted to Admins.
  - Stream completes with clear, explicit abstention: *"I couldn't find enough information in the documents you have access to answer this reliably."*
  - Abstention card appears. Cursor clicks **"Submit to Knowledge Gaps"** button.
  - Operational banner confirms gap logged for administrative review.

### Scene 4: Persona Elevation & Restricted Knowledge Retrieval (0:38 – 0:50)
- **Start Screen:** `/chat/`.
- **Actions:**
  - Cursor moves to sidebar persona dropdown; selects **`Sarah Chen (OWNER)`**.
  - Page updates session to Owner with full organizational permissions.
  - Cursor types the exact same executive query: *"What is the leadership equity vesting schedule and bonus formula?"* and submits.
  - Grounded answer streams with full executive breakdown (4-year vesting, 1-year cliff, 25% annual bonus target) and verified citations to the *Executive Compensation* document.

### Scene 5: Document Library & Ingestion Lifecycle (0:50 – 1:05)
- **Start Screen:** Navigates to `/documents/`.
- **Actions:**
  - Table loads with GSAP staggered entrance showing 7 indexed SOPs and compliance handbooks.
  - Cursor filters by category `Operations`.
  - Cursor clicks **"Permissions"** on a document; permissions modal opens smoothly; cursor closes modal.
  - Cursor clicks **"Retire"** on *Customer Support Escalation & SLA Protocol*; status updates immediately to `retired` (gray badge).

### Scene 6: Operational Telemetry & Knowledge Gaps Triage (1:05 – 1:20)
- **Start Screen:** Navigates to `/analytics/`.
- **Actions:**
  - KPI cards display live satisfaction rate (100%), total questions, and policy category distribution.
  - Cursor navigates to `/gaps/` (Knowledge Gaps).
  - The unanswered question submitted by Marcus in Scene 3 is visible in the triage table.
  - Cursor changes its status dropdown from `Pending` to `Reviewed` (In Review).

### Scene 7: Security Audit Stream & Connectors (1:20 – 1:30)
- **Start Screen:** Navigates to `/audit/`.
- **Actions:**
  - Displays chronological security audit records for all actions taken (RAG queries, status changes, persona shifts).
  - Cursor navigates to `/integrations/` showing Google Drive and SharePoint enterprise connector specifications.
  - Cursor smoothly returns to `/chat/` for a clean closing view.
