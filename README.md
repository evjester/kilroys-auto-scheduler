# Kilroy's Bar Auto-Scheduler

Intelligent auto-scheduling demo for bar staff, powered by historical Toast POS data and 7shifts workforce data. **All data is mock** — no real API connections or credentials.

## Quick Start

```bash
npm install
npm run generate-data   # Creates mock CSV files in mock-data/
npm run dev             # Starts on localhost:3000
```

## How It Works

1. **Ingests** 4 weeks of mock Toast data (daily sales, employee tips, labor hours, checks)
2. **Ingests** mock 7shifts data (employee roster, availability, time-off requests, historical shifts)
3. **Computes** per-employee performance scores from the Toast metrics
4. **Generates** an optimized weekly schedule using a weighted scoring algorithm
5. **Explains** every assignment with human-readable reasoning

### Scheduling Algorithm

Uses **greedy assignment with difficulty sorting + swap optimization**:

- Shifts are sorted hardest-to-fill first (prime shifts, constrained roles)
- Each employee is scored across 6 weighted factors:
  - **Performance (25%)** — Toast-derived sales/hr, tips/hr, tip %
  - **Proficiency (20%)** — Primary role match vs secondary role
  - **Preference (15%)** — Day and shift type preferences
  - **Fairness (20%)** — Equitable prime shift distribution over 4 weeks
  - **Rest (10%)** — Clopen avoidance, minimum 10hr between shifts
  - **Hours Need (10%)** — Distance from target weekly hours
- After greedy assignment, a swap optimization pass catches improvements
- Every assignment includes a full reasoning breakdown

### Hard Constraints (never violated)

- Employee availability windows
- Role qualification
- Max weekly hours (40hr default)
- No overlapping shifts
- Minimum 10hr rest between shifts
- Approved time-off requests

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with summary stats and daily coverage chart |
| `/schedule` | Weekly grid (role x day) with color-coded shift cards |
| `/employees` | Sortable employee table with Toast performance metrics |
| `/reasoning` | Searchable assignment reasoning log with full scoring |
| `/what-if` | Scenario simulator — call-outs, availability changes |

## Project Structure

```
auto-scheduler/
├── scripts/generate-mock-data.ts    # Mock data generator
├── mock-data/
│   ├── toast/                       # Sales, tips, labor, checks CSVs
│   └── 7shifts/                     # Employees, availability, time-off, shifts
├── src/
│   ├── lib/
│   │   ├── types.ts                 # TypeScript interfaces
│   │   ├── mock-config.ts           # Bar config, employee defs, staffing reqs
│   │   ├── time-utils.ts            # Overnight shift math
│   │   ├── ingest.ts                # CSV parsers
│   │   ├── metrics.ts               # Performance score computation
│   │   ├── shift-templates.ts       # Weekly shift slot generation
│   │   ├── constraints.ts           # Hard constraint checking
│   │   ├── scoring.ts               # 6-factor weighted scoring
│   │   ├── reasoning.ts             # Natural-language explanations
│   │   └── scheduler.ts             # Core scheduling algorithm
│   └── app/                         # Next.js App Router (pages + API)
```

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **PapaParse** (CSV parsing)
- **date-fns** (date math)

## Key Assumptions

- Single location: Kilroy's on Kirkwood, Bloomington, IN
- 15 employees across 7 roles (Bartender, Lead Bartender, Barback, Server, Host, Doorman, Bar Manager)
- Operating hours: 11 AM – 2 AM (Sunday closes after AM shift)
- Shifts: AM (11:00–17:00), PM (16:00–01:00), Late (20:00–02:00)
- All data is synthetic mock data — no real PII or API keys
