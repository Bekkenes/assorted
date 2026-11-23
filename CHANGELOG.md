# Changelog

## Nagare 2.3 – 2026-11-23

### Fixed
- Weather codes were misread: snow showed "Rain", showers "Storm" and thunderstorms "Snow". Now follows Open-Meteo's WMO codes.
- City search sent the name unencoded in the URL (broke on e.g. `Ålesund, NO` or `&`) and gave no message when nothing was found.

### Changed
- Clicking the weather line opens settings, as the "Tap to set location" text suggests.
- Checks the HTTP status of the weather call and prevents duplicate apps.
