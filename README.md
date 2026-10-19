# Okane

Okane is a clean, offline-first personal finance control app built with only HTML, CSS, and vanilla JavaScript. It works as a single page app and installable PWA with all finance data stored locally in the browser.

Developed by [Nerdhook](https://nerdhook.site/), a software development organization on [GitHub](https://github.com/Nerdhook).

## Features

- Guided first-run setup plus an optional demo mode
- Dashboard with one available balance, monthly income/expenses, and recent transactions
- Add income and expense transactions
- Edit transactions and undo accidental deletion
- Monthly transport plans with going and return fare calculation
- Recurring monthly income and expense automation
- Analytics for cash flow, categories, trends, daily spending, and transport
- Monthly comparisons, spending projection, and paired income/expense graphs
- Monthly category budgets and savings goals
- Category management
- One asset balance with user-managed debts and debt payments
- One user-selected display currency, with first-run IP detection and offline locale fallback
- Audited opening-balance changes and net-position summaries
- Local-only data storage with `localStorage`
- Export and import all data as JSON
- Automatic rolling local recovery snapshots
- Reset local data with confirmation
- Offline support through a service worker
- Installable PWA
- SVG, PNG, and maskable application icons
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
There is no authentication, cloud account, tracking service, or network API. The
browser on the current device is the complete application and data store. On a
new installation, Okane makes one request to `ipapi.co` to suggest the local
currency from the public IP address; the user can replace that choice at any
time. No IP or location is stored by Okane.

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

The app uses one currency (Japanese yen), one asset balance, and no account
system. Users can add debts and pay them directly from the asset balance.
Existing backups using older data shapes are migrated automatically
when loaded or imported.

Changing the display currency changes symbols and decimal formatting only. It
does not convert stored balances or transaction amounts.

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
- Restore one of up to eight automatic on-device snapshots

Local snapshots help recover an accidental edit, but they live in the same
browser storage. Export JSON regularly for a backup that survives cleared site
data or a lost device.

## Development

Repository:

https://github.com/mizukaze554/okane

Contact for app questions or feedback:

linhtetln67@gmail.com

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
