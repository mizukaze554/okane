# Okane

Okane is a clean, offline-first personal finance control app built with only HTML, CSS, and vanilla JavaScript. It works as a single page app and installable PWA with all finance data stored locally in the browser.

Developed by [Nerdhook](https://nerdhook.site/), a software development organization on [GitHub](https://github.com/Nerdhook).

## Features

- Dashboard with total balance, monthly income/outcome, account balances, and recent transactions
- Add income and outcome transactions
- Edit transactions and undo accidental deletion
- Balance-neutral transfers between JPY accounts
- Monthly transport plans with going and return fare calculation
- Recurring monthly income and expense automation
- Analytics for cash flow, categories, trends, accounts, and transport
- Monthly category budgets and savings goals
- Category management
- Account/payment source management (single currency: JPY)
- Local-only data storage with `localStorage`
- Export and import all data as JSON
- Reset local data with confirmation
- Offline support through a service worker
- Installable PWA
- Responsive mobile and desktop UI
- Automatic light/dark theme based on system settings

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Web App Manifest
- Service Worker Cache Storage
- Browser `localStorage`

No frameworks, backend, build tools, or external CDN dependencies are required.

## Project Structure

```text
okane/
├── app.js              Browser controller and event handling
├── src/
│   ├── config.js       App-wide constants
│   ├── analytics.js    Monthly summaries and trends
│   ├── automation.js   Transport and recurring generation
│   ├── finance.js      Pure balance, total, sort, and filter logic
│   ├── render.js       Reusable HTML renderers
│   ├── state.js        Defaults, storage, validation, and migrations
│   └── utils.js        Date, currency, ID, and escaping helpers
├── test/               Node unit tests for finance and state logic
├── index.html
├── styles.css
└── service-worker.js
```

The app uses one currency (Japanese yen) across multiple accounts such as Cash,
Bank, and PayPay. Account transfers move money without changing income or
expense totals. Existing backups using the old `accesses` data shape are
migrated automatically when loaded or imported.

## Run Locally

Serve the folder with a local static server (native JavaScript modules and the
service worker require HTTP):

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Test

```bash
npm test
```

## Data

All app data is stored only on the current device in browser `localStorage`.

Use the Backup page to:

- Export JSON backup files
- Import JSON backup files
- Reset all local app data

## Development

Repository:

https://github.com/mizukaze554/okane

Contact for app questions or feedback:

linhtetln67@gmail.com

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
