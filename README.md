# Country Explorer

A responsive country search app: type a name and get an instant profile — capital, population,
currency, languages, area, region, calling code, timezone, flag and a map link.

## Features

- Search all 250 countries by name (common **or** official), with partial matching (`nep` → Nepal)
- Instant results: the dataset ships with the app, so there is no API key, rate limit or CORS issue
- Six data cells per country: capital, population, currency, languages, area, subregion
- Footer chips: international calling code, primary timezone, "map" link to Google Maps
- Recent searches saved in `localStorage` (max 8, de-duplicated) and one click to reopen
- "Surprise me" jumps to a random country
- Enter key submits; loading spinner, inline errors and flag fallbacks built in
- Fully responsive down to small phones

## Tech Used

HTML | CSS | JavaScript

The page fetches `data/countries.json` once with the Fetch API, then searches it in memory.

## Data

`data/countries.json` (250 countries, ~105 KB) is a trimmed build of:

- [world-countries](https://www.npmjs.com/package/world-countries) — names, currencies, languages,
  calling codes, coordinates, region/subregion
- [GeoNames](https://www.geonames.org/export/) — population, area and timezones

Flags are served from [flagcdn.com](https://flagcdn.com/).

## Structure

```text
country-info-app/
├── index.html
├── style.css
├── country.js
└── data/countries.json
```

Open `index.html` with any static server (the dataset is loaded via `fetch`, so `file://` will not
work in most browsers):

```bash
python -m http.server 8000
```
