# GOOGLE SHEET SCHEMA

Spreadsheet: `Finance_Control_System_DB`

## Tabs
1. `DAILY_SALES`
2. `EXPENSES`
3. `DEPOSITS`
4. `RECEIVABLES`
5. `CANCEL_REQUESTS`
6. `CASH_RECON`
7. `ATTACHMENTS`
8. `SETTINGS`
9. `OWNER_ADJUSTMENTS`
10. `AUDIT_LOG`

## Main Formulas
- `total_sales = cash_amount + transfer_amount + credit_amount`
- `coin_balance = cash_before_deposit - deposit_amount`
- `balance_amount = credit_amount - paid_amount`
- `difference = actual_cash - expected_cash`
