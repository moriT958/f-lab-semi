# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a work time and salary calculation web application (`work-tracker-app`). It's a simple Node.js/Express application that tracks work hours, calculates salaries with night shift premiums (22:00-5:00 at 1.25x rate), and exports records to CSV.

## Development Commands

### Start the server

```bash
npm start
# Server runs on http://localhost:3000
```

### Install dependencies

```bash
npm install
```

## Architecture

### Application Structure

This is a **monolithic single-page application** with a clear separation between backend API and frontend:

- **Backend** (`server.js`): Express server with SQLite database
- **Frontend** (`public/index.html`): Single HTML file with embedded JavaScript and CSS

### Key Architectural Patterns

#### 1. Time Calculation Flow (Frontend → Backend)

The time calculation happens entirely in the **frontend** (public/index.html:101-167), not the backend:

1. User inputs start/end times and break periods
2. JavaScript iterates **minute-by-minute** through the work period (index.html:130-138)
3. For each minute:
   - Checks if it's during a break → skip if true
   - Checks if it's night time (22:00-5:00) → increment `nightMinutes`
   - Increments `workMinutes`
4. Calculates salary using the formula:
   ```javascript
   totalSalary =
     ((workMinutes - nightMinutes) / 60) * hourlyRate +
     (nightMinutes / 60) * hourlyRate * 1.25;
   ```
5. Sends **pre-calculated** values to backend via POST /records

The backend (server.js:25-36) acts as a **passive storage layer** - it only saves the already-calculated values without any validation or recalculation.

#### 2. Database Schema (server.js:14-22)

SQLite table `records` stores:

- `date` (TEXT): Work date as localized string
- `time` (TEXT): Start-end time range (e.g., "9:00:00 - 18:00:00")
- `breakTime` (TEXT): Break periods as string (e.g., "12:00:00 - 13:00:00 / 15:00:00 - 15:15:00")
- `hours` (REAL): Total work hours (already calculated)
- `night` (INTEGER): Night shift minutes (already calculated)
- `salary` (INTEGER): Total salary (already calculated)

**Important**: All calculations are done client-side; database stores final results.

#### 3. CSV Export (server.js:55-80)

- Fetches all records from DB
- Calculates totals by reducing over all records
- Adds a summary row with totals
- Writes to `勤務記録.csv` with **BOM (U+FEFF)** for Excel compatibility (server.js:74)
- Sends file as download

#### 4. Multi-break Support (public/index.html:86-99)

- Dynamic DOM manipulation to add/remove break time inputs
- Each break is a `.break-pair` div with start/end datetime inputs
- Breaks are collected into `breakIntervals` array and checked during minute-by-minute iteration

## Important Implementation Details

### Night Shift Calculation Logic

Located in `public/index.html:134`:

```javascript
if (hour >= 22 || hour < 5) nightMinutes++;
```

This checks if the current hour is between 22:00-23:59 OR 0:00-4:59.

### No Server-Side Validation

The backend trusts all data from the frontend. If you add validation, implement it in `server.js:25-36` (POST /records endpoint).

### CSV Encoding

The CSV uses BOM-prefixed UTF-8 (server.js:74) to ensure Japanese characters display correctly in Excel:

```javascript
const csv = "\uFEFF" + [header, ...lines].join("\n");
```

### Static File Serving

Express serves everything in `public/` directory automatically (server.js:10):

```javascript
app.use(express.static("public"));
```

## Database

- **Type**: SQLite (file-based, auto-created on first run)
- **File**: `records.db` in project root
- **Initialization**: Table created automatically on server start (server.js:14-22)
- **No migrations**: Schema changes require manual ALTER TABLE or deleting the DB

## API Endpoints

All endpoints are defined in `server.js`:

- `POST /records` (line 25): Save work record
- `GET /records` (line 39): Fetch all records
- `DELETE /records/:id` (line 47): Delete a record
- `GET /records/csv` (line 55): Download CSV export

## Testing

No test framework is currently configured. To add testing:

1. Install a test framework (e.g., `npm install --save-dev jest supertest`)
2. Create tests for API endpoints using supertest
3. For frontend, consider adding Playwright or Cypress for E2E tests
