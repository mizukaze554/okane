# Okane

Okane is a clean, offline-first personal finance control app built with only HTML, CSS, and vanilla JavaScript. It works as a single page app and installable PWA with all finance data stored locally in the browser.

Developed by [Deltashift](https://deltashift.netlify.app/) and [mizukaze554](https://github.com/mizukaze554).

## Features

- Dashboard with total balance, monthly income/outcome, access balances, and recent transactions
- Add income and outcome transactions
- Category management
- Access/payment source management
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

## Run Locally

You can open `index.html` directly in a browser for basic use.

For full PWA and service worker behavior, serve the folder with a local static server:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
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

Add a license file if you plan to publish or distribute this project.
