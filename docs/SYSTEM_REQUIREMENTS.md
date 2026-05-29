# SYSTEM REQUIREMENTS

## Business Objectives
- Track full money trail from sales to final cash/bank balance.
- Detect variance source quickly (cash missing, unapproved cancel, unreconciled expense).
- Keep immutable history via audit log.

## Functional Scope
- Sales, Expenses, Deposits, Receivables, Cancel Requests, Cash Reconciliation.
- Employee daily dashboard (today only).
- Owner dashboard (day/week/month/year logic extensible).
- Cancel request approval workflow.
- Attachment upload tracking.

## Non-Functional Requirements
- Frontend: static hosting (GitHub Pages), responsive mobile-first UI.
- Backend: Google Apps Script Web App with strict server-side validation.
- Database: Google Sheets tabs with fixed schema.
- Storage: Google Drive folder separation by evidence type.
- Security: frontend is untrusted; role checks on every backend action.

## Key Control Rules
- Employee cannot edit/delete submitted records.
- Employee can backdate up to 3 days only.
- Owner can approve/reject cancel request.
- All actions produce audit logs with old/new values where relevant.
