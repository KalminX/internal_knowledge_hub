# Engineering Incident Response & Severity Matrix

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
