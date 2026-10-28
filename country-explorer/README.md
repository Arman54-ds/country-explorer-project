# Country Explorer

A responsive country directory built with HTML, CSS, and vanilla JavaScript. It uses the REST Countries v3.1 API.

## Features
- Browse countries with flags, population, region, and capital
- Search by common name, official name, or capital
- Filter by region and sort by name, population, or area
- View country details, currencies, languages, time zones, and neighbouring countries
- Save favourite countries with Local Storage
- Dark/light theme preference
- Responsive layout, loading state, and API error handling
- Shareable country detail URLs using a country code

## Run locally
Because the app uses `fetch()`, run it from a local development server instead of opening `index.html` directly. In VS Code, use the Live Server extension, or run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## API
REST Countries v3.1: https://restcountries.com/

## Files
- `index.html` — page structure
- `style.css` — responsive design and themes
- `script.js` — API, rendering, search, filters, favourites, and routing
