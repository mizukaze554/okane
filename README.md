# Okane

An offline-first personal finance tracker with **one asset and one balance**, built using HTML, CSS, and vanilla JavaScript. No backend, no cloud sync, no currency exchange, and no separate wallets or balances.

## What it does

- **Dashboard:** one JPY balance, recent transactions, monthly income/expenses.
- **Transactions:** add, search, edit, and delete income/expenses.
- **Analytics:** category breakdown, daily expenses, six-month trends, net cash flow.
- **Transport:** configure outgoing/returning fare, days per month, and a monthly commute estimate; or automatically create daily commute transactions for chosen weekdays.
- **Recurring:** automatically create daily, weekly, or monthly expenses and income when opening the app, up to one year back.
- **Budgets:** set monthly spending limits by category.
- **Savings goals:** track progress without reducing the money balance.
- **Settings:** edit opening balance, manage categories, export/import JSON, or reset the app.

## Install and run

Use a local static server (ES modules and service workers require HTTP or HTTPS):

```sh
python3 -m http.server 8000
```

Visit http://localhost:8000. The app supports PWA installation and caches all its code for offline use. Data stays in the browser's localStorage.

## Testing

```sh
npm test
```

Requires Node.js 22 or newer. GitHub Actions runs the tests and JavaScript syntax checks on pull requests.

## Data migration

Existing v1 browser data is read from the original `minimalFinanceControlState` localStorage key.

- The old Cash/Bank/PayPay **initial balances** are summed into one opening balance.
- Historical income and expense records remain unchanged, but their account references are removed.
- No individual payment source or asset subdivisions remain.
- After the next successful write, the new schema is saved as v2.

**Export a JSON backup before upgrading.** v2 backups cannot be imported into v1. If saved data cannot be parsed, Okane warns the user and does not immediately overwrite that original value.

Automated entries are generated on app open, not by a background scheduler. They are date-keyed to prevent duplication. Recurring and transport rules start at the selected date. Removing a rule leaves already generated transactions in place; deleting an automated entry will not regenerate it.

The monthly transport estimate is only a projection. To record actual transport expenses automatically, choose daily mode. Weekends are excluded by default and can be included through the weekday selector; public holidays are not automatically detected.

## Architecture

- `src/storage.js`: schema migration, validation, browser persistence and backup.
- `src/finance.js`: cash-flow calculations, transaction operations, summaries, transport estimates and automation.
- `src/app.js`: navigation, forms, rendering and user interactions.
- `styles.css`: responsive light/dark design.
- `service-worker.js`: local asset cache.
- `tests/finance.test.js`: regression tests using Node's built-in test runner.

## Limits

This version is **single-currency JPY** and tracks only a single total balance. It intentionally does not support asset-to-asset transfers, CSV export, or cloud synchronization. A savings goal is a target, not a separate reserved account. Automatic entries depend on the device date and are reconciled when the app opens. Clearing browser site data without a JSON backup will lose all records.

Developed by [Deltashift](https://deltashift.netlify.app/) and [mizukaze554](https://github.com/mizukaze554). MIT licensed.
