# API SPEC

Base URL: `API_URL` from Apps Script deployment

## GET
- `getEmployeeDailyDashboard`
- `getOwnerDashboard`
- `getPendingCancelRequests`
- `getAuditLogs`

## POST
- `createDailySales`
- `createExpense`
- `createDeposit`
- `createReceivable`
- `createCancelRequest`
- `createCashRecon`
- `approveCancelRequest`
- `rejectCancelRequest`
- `uploadAttachment`

## Required Common Fields
- `role`: `employee` or `owner`
- `user`: user email

## Response Format
```json
{ "ok": true, "data": { } }
```
Error:
```json
{ "ok": false, "error": "message" }
```
