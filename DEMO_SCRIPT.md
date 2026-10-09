# Client Demonstration & Walkthrough Script

This script is structured for a 5-to-10 minute presentation to prospective enterprise clients, engineering leaders, and stakeholders.

---

## 🎯 Presentation Objectives

1. Demonstrate that this is **not a generic chatbot wrapper**, but an enterprise-grade, secure knowledge retrieval system.
2. Prove that **data privacy and role boundaries** are enforced at the database level.
3. Show that answers are **100% verifiable with source citations**.
4. Highlight **automated operational feedback and documentation gap tracking**.

---

## 🎬 Step-by-Step Demo Walkthrough

### 1. Introduction & Security Persona Switcher (1 Minute)
- Open the application at `http://localhost:3000`.
- Highlight the **Active Test Persona** dropdown in the top-left sidebar:
  - Explain that we have pre-configured 4 distinct roles:
    * `Sarah Connor (Admin)` — Full administrative & restricted document access.
    * `David Miller (Editor)` — Knowledge document author & pipeline manager.
    * `Alex Rivera (Engineer)` — Regular team member.
    * `Eve Hacker (External Org)` — Outsider in a separate tenant organization.
- Emphasize that all role permissions are enforced server-side.

---

### 2. Grounded Question Answering & Citation Cards (2 Minutes)
- Select persona: **Alex Rivera (Engineer)**.
- Navigate to **Knowledge Assistant**.
- Click the prompt chip: *"How many days of PTO can I roll over into the new year and what is the deadline?"*
- Observe the response:
  - The assistant directly answers with the exact 5 days / March 31st deadline.
  - Show the **Verified Source Citations card**:
    * Highlights the document title (`Leave and Paid Time Off (PTO) Policy`).
    * Displays the exact section (`Rollover and Forfeiture Limits`) and page number.
    * Displays the similarity match score.
    * Shows the exact source excerpt from the policy.

---

### 3. Demonstrating Permission Isolation & Restricted Documents (2 Minutes)
- While still logged in as **Alex Rivera (Engineer)**:
  - Ask: *"What is the leadership equity vesting schedule and executive bonus formula?"*
  - Observe that the assistant **immediately abstains**: *"I couldn't find enough information in the documents you have access to answer this reliably."*
  - Explain that the document exists, but is marked as `restricted` to Admins.
- Now switch the persona to **Sarah Connor (Admin)** in the sidebar.
- Re-ask the exact same question.
- Observe:
  - The assistant answers with the full 4-year vesting schedule, 1-year cliff, and ARR bonus formula, citing the `Executive Compensation & Restricted Strategy` document.
  - This proves that permissions are evaluated before retrieval!

---

### 4. Demonstrating Autonomous Abstention & Knowledge Gap Automation (2 Minutes)
- Switch to persona: **Alex Rivera (Engineer)**.
- Ask an out-of-scope question: *"What is the company policy on bringing pets to the office and pet health insurance?"*
- Observe:
  - The assistant refuses to fabricate a policy.
  - The Insufficient Evidence banner appears with a **"Submit as Documentation Gap"** action.
  - Click the button or provide unhelpful feedback.
- Now switch to **Sarah Connor (Admin)** and click **Knowledge Gaps** in the sidebar.
- Show that the unanswered question is queued in the operational backlog with status `Pending`, allowing the HR/Operations team to author the missing document!

---

### 5. Document Ingestion Lifecycle & Immediate Retirement (2 Minutes)
- Navigate to **Document Library**.
- Show the table with categories, version numbers (`v1`), and status badges (`ready`).
- Upload a new document or click **Retire** on the PTO Policy.
- Demonstrate that retired documents immediately vanish from retrieval without leaving orphan chunks.

---

### 6. Operations Analytics & Security Audit Stream (1 Minute)
- Navigate to **Usage Analytics**:
  - Show real-time telemetry: Total Questions, Answer Satisfaction %, Abstention Rate, Top Queried Policy Topics, and Most Cited Documents.
- Navigate to **Security Audit Logs**:
  - Show the immutable audit trail of document ingestion, role updates, and RAG queries.
- Conclude the demo by highlighting production deployment readiness with Supabase and Anthropic Claude.
