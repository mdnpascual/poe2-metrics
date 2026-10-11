# Feature 1: Data Ingestion Pipeline

## Status: MVP ✅

## Priority: 1 (no other features work without this)

## Description
Ingest all scraped JSON character profiles from `../scraper/data/poe.ninja/` into DuckDB tables. This is the foundation — every query and visualization depends on data being in the database.

## Requirements
- Scan the scraper's data directory for the latest (or all) timestamped capture folders
- Parse each JSON file into normalized DuckDB tables: characters, items, skills, flasks
- Handle duplicates gracefully (INSERT OR REPLACE by character id)
- Support re-ingestion (clear + reload) and incremental (skip existing)
- CLI: `npm run ingest` or `npm run ingest -- <path>`
- Log progress and final counts

## DuckDB Tables
- `characters` — one row per character profile
- `items` — one row per equipped item (FK to characters)
- `skills` — one row per skill slot (FK to characters)
- `flasks` — one row per flask (FK to characters)

## Acceptance Criteria
- [ ] Running `npm run ingest` reads JSON from latest captures folder
- [ ] All 4 tables populated with correct data
- [ ] Handles malformed/partial JSON without crashing
- [ ] Logs: "Ingested X characters, Y items from Z files"
- [ ] Re-running doesn't duplicate data

## Dependencies
- None (first in chain)

## Files
- `server/db.ts` — Table creation DDL
- `server/ingest.ts` — Main ingestion logic
