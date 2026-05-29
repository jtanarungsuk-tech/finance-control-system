# Backend Setup (Google Apps Script)

1. Create a new Google Apps Script project.
2. Open `Code.gs` and paste all code from `backend/Code.gs`.
3. Save project.
4. Bind script to a Google Spreadsheet file (recommended), or run `setupSystem()` once to auto-create spreadsheet and folders.
5. Set script timezone to your business timezone.
6. Run `setupSystem()` manually from Apps Script editor (first-time auth required).
7. Verify output contains Spreadsheet ID and Folder IDs.
8. Deploy > New deployment > Web app.
9. Execute as: `Me`, Who has access: `Anyone with link` (or your preferred restricted policy).
10. Copy Web App URL and use in frontend `config.js`.
11. Open `SETTINGS` sheet and set:
   - `ALLOW_SELF_REGISTER` = `false` (recommended production)
   - `OWNER_EMAILS` = comma-separated owner emails
   - `EMPLOYEE_EMAILS` = comma-separated employee emails

## API Behavior
- All requests must include `role` and `user`.
- Employee backdate is limited to 3 days.
- Owner has no backdate restriction.
- Every create/approve/reject/upload writes to `AUDIT_LOG`.
- Login is verified by backend whitelist in `SETTINGS`.
