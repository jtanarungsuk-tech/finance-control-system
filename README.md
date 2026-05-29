# Finance Control System

Production-ready baseline system for business money-flow control using:
- Frontend: HTML5/CSS3/Vanilla JS
- Backend: Google Apps Script
- Database: Google Sheets
- Evidence Storage: Google Drive
- Hosting: GitHub Pages

## Project Structure

```
finance-control-system/
  frontend/
  backend/
  docs/
```

## Setup Steps

1. Create Google Apps Script
2. Paste `backend/Code.gs`
3. Run `setupSystem()`
4. Deploy Web App
5. Copy Web App URL
6. Create `frontend/config.js`
7. Put `API_URL` inside `config.js`
8. Push to GitHub
9. Enable GitHub Pages

## GitHub Pages

- Go to repository **Settings > Pages**
- Deploy from branch: `main`
- Folder: `frontend`
- Final URL format:
  `https://USERNAME.github.io/finance-control-system/`

## Required config.js

Create `frontend/config.js` from `frontend/config.example.js`

```js
const API_URL = "PUT_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

## Security Notes

- Do not trust frontend validation.
- Backend performs role checks and data validation.
- Every critical action is logged in `AUDIT_LOG`.
- Login whitelist is controlled by `SETTINGS` (`OWNER_EMAILS`, `EMPLOYEE_EMAILS`).
- File evidence upload supports `jpg/png/pdf` up to `10MB` and stores files in Google Drive.
