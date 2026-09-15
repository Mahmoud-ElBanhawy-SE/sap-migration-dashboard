# SAP S/4HANA Cutover Readiness Dashboard

A comprehensive web-based executive dashboard for tracking data migration status during SAP S/4HANA cutover projects.

**Live Example**: https://wacz21303shrp1p.gad.schneider-electric.com/cutover_dashboard/#so?period=30d

## Overview

This dashboard provides real-time visibility into cutover readiness across three data families:

| Family | Metrics | Meaning | Display |
|---|---|---|---|
| **Volume** | To Migrate Lines, Open Lines, Documents, In-Scope | The size of the cutover load | Latest value, movement, % change |
| **Readiness** | Hard-Blocked Lines, Unassessed Lines, Cleansing Worklist | Must be zero before cutover | Burn rate, projected zero date, track status |
| **Decision** | Material Decision Lines (soft-blocked) | Business decisions required | Latest value, movement |

## Key Features

✅ **Real-time KPI Tracking** — Volume, Readiness, and Decision metrics  
✅ **Burn-Down Analysis** — Projected zero dates with On Track / At Risk / Off Track status  
✅ **Period Selection** — Filter by 7d, 14d, 30d, or custom date ranges  
✅ **Module-wise Progress** — Track SO (Sales Orders), PO (Purchase Orders), STOCK separately  
✅ **Business Model Segmentation** — Split metrics by Transac, Services, Projects, Equipment, Software  
✅ **Cleansing Worklist** — Monitor master-data blockers and cleansing signals  
✅ **Trend Visualization** — Line charts, burn-down curves, heat maps  
✅ **Executive Summary** — Ready-to-present KPI cards and tables  
✅ **Export Reports** — Download summary reports as PDF/Excel  

## Technology Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Charting**: Recharts + Chart.js
- **Backend**: Node.js/Express + PostgreSQL
- **Real-time**: WebSockets (Socket.io)
- **Container**: Docker & Docker Compose
- **CI/CD**: GitHub Actions

## Project Structure

```
sap-migration-dashboard/
├── frontend/                    # React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── BurndownChart.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   └── CleansingWorklist.tsx
│   │   ├── pages/
│   │   │   ├── CutoverReadiness.tsx
│   │   │   ├── CleansingFollowup.tsx
│   │   │   └── BusinessModelSplit.tsx
│   │   ├── hooks/
│   │   │   ├── useDashboardData.ts
│   │   │   └── useWebSocket.ts
│   │   └── App.tsx
│   ├── public/
│   └── Dockerfile
├── backend/                     # Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   └── app.ts
│   ├── database/
│   │   ├── migrations/
│   │   └── seeds/
│   └── Dockerfile
├── docs/
│   ├── REQUIREMENTS.md
│   ├── DATABASE_SCHEMA.md
│   └── API_REFERENCE.md
├── docker-compose.yml
├── .github/workflows/
├── README.md
└── LICENSE
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 14+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mahmoud-ElBanhawy-SE/sap-migration-dashboard.git
   cd sap-migration-dashboard
   ```

2. **Start with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Access the dashboard**
   - Frontend: http://localhost:3000
   - API: http://localhost:5000
   - Database: localhost:5432

### Manual Setup

**Backend:**
```bash
cd backend
npm install
npm run build
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## Data Model

Three core tables power the dashboard:

### FactProgress
- `run_key` (PK)
- `metric_name` (To Migrate Lines, Hard-Blocked Lines, etc.)
- `metric_value_num` (decimal)
- `metric_unit` (lines, documents, positions, %)
- `business_model` (Transac, Services, Projects, Equipment, Software)
- `captured_at` (timestamp)
- `is_total` (boolean)

### FactCleansing
- `run_key` (PK)
- `signal_theme` (Master Data, Material Decision, etc.)
- `metric_label` (descriptive label)
- `metric_value` (count or percentage)
- `signal_class` (Blocker, Cleansing, Profile)
- `captured_at` (timestamp)

### DimRun
- `run_key` (PK)
- `pipeline` (SO, PO, STOCK)
- `kpi_kind` (Progress, Cleansing)
- `captured_at_utc` (timestamp)
- `is_latest_run` (boolean)
- `is_last_run_of_day` (boolean)

## API Endpoints

### KPI Data
```
GET  /api/kpi/progress              List all progress metrics
GET  /api/kpi/progress?period=30d   Filter by period
GET  /api/kpi/cleansing             Cleansing signals
GET  /api/kpi/executive-summary     Pre-computed executive metrics
```

### Time Series
```
GET  /api/trends/burndown?pipeline=SO   Burn-down curve for Sales Orders
GET  /api/trends/volume?pipeline=PO     Volume trend for Purchase Orders
```

### Reports
```
POST /api/reports/generate          Generate PDF/Excel report
GET  /api/reports/:id               Retrieve generated report
```

## Configuration

### Environment Variables

**Backend** (`.env`):
```
DATABASE_URL=postgresql://user:password@localhost:5432/cutover_dashboard
NODE_ENV=production
PORT=5000
JWT_SECRET=your-secret-key
CUTOVER_DATE=2027-03-01
BASELINE_DATE=2026-06-01
```

**Frontend** (`.env`):
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_CUTOVER_DATE=2027-03-01
```

## Three Important Rules

**1. Marvin Runs Multiple Times Daily**
- Every pipeline run appends to `MarvinKpiHistory`
- Always resolve to a single run per pipeline first using `IsLatestRun`
- Use `Value (Latest Run)` measure pattern

**2. Two Kinds of Capture, Different Timestamps**
- Progress snapshots: end of pipeline run (`KpiKind = 'Progress'`)
- Cleansing signals: cross-pipeline KPI export (`KpiKind = 'Cleansing'`)
- Every measure must pin `KpiKind` to prevent blanking

**3. Totals and Business Models in One Column**
- Headline figures have `BusinessModel = '(Total)'`, `IsTotal = TRUE`
- Segments have `IsTotal = FALSE`
- Split reconciles exactly to total — **never mix them**

## Parameters

| Parameter | Default | Purpose |
|---|---|---|
| `@CutoverDate` | `2027-03-01` | DP1 → UNIFY go-live date |
| `@BaselineDate` | `2026-06-01` | Programme baseline |
| `@BaselineGraceDays` | `14` | Late start grace period |
| `@RateWindowDays` | `14` | Burn rate lookback window |
| `@AtRiskMarginDays` | `30` | Days before cutover = At Risk |

## Dashboard Pages

### Page 1: Cutover Readiness (Executive Slide)
- Volume KPI cards (To Migrate Lines)
- Days to Cutover countdown
- Readiness table (Hard-Blocked Lines burn-down, track status)
- Material Decision table
- Hard-Blocked trend line
- To Migrate trend line

### Page 2: Cleansing Follow-up
- Cleansing worklist (Blockers and Cleansing signals)
- Stacked bar by theme and pipeline
- Master-Data Blocker trend
- Filters: Pipeline, Signal Class, Metric Group

### Page 3: Business Model Split
- To Migrate by business model (stacked column over time)
- 100% stacked bar by pipeline
- Matrix: Business Model × Pipeline with key metrics
- Unattributed To Migrate card
- Business model slicer

## Data Integration

### From Marvin KPI Pipeline
The dashboard consumes data from Marvin's append-only `MarvinKpiHistory` table:

1. **Source System**: `DP1.MarvinKpiHistory` on `UNIFY_GermanyFO_3y_new`
2. **Server**: `wacz21303oneq2p.gad.schneider-electric.com` (Windows Auth)
3. **Update Frequency**: Every pipeline run + KPI export
4. **Typed Columns**:
   - `MetricValueNum` (decimal) — leading number
   - `MetricUnit` (lines, documents, positions, %)
   - `MetricValueKind` (Count, Currency, Percent, Timestamp, Text)
   - `CapturedAtDate` (date)

### SQL Query Pack
Original SQL queries are in `/backend/database/queries/`:
- `01_DimDate.sql` — Calendar from first capture to cutover + 14d
- `02_DimPipeline.sql` — SO, PO, STOCK pipeline definitions
- `03_DimRun.sql` — One row per KPI capture
- `04_FactProgress.sql` — Run × metric × business model
- `05_FactCleansing.sql` — Run × cleansing signal × business model
- `06_ExecSummary.sql` — Latest-run headlines (pre-computed)
- `07_CleansingWorklist.sql` — Latest cleansing signals (pre-computed)
- `08_DimBusinessModel.sql` — Business model segments

## Development

### Run Tests
```bash
npm run test
```

### Build Docker Images
```bash
docker-compose build
```

### View Logs
```bash
docker-compose logs -f frontend
docker-compose logs -f backend
```

## Deployment

### To Production

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **CI/CD Pipeline** (GitHub Actions)
   - Runs tests
   - Builds Docker images
   - Pushes to registry
   - Deploys to cloud (ECS, AKS, etc.)

3. **Manual Deployment**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Troubleshooting

### Dashboard shows blank KPIs
→ Check that all data filters use `IsLatestRun = TRUE` and `KpiKind` is pinned

### Burn-down date appears wrong
→ Verify `@CutoverDate` parameter and rate window (`@RateWindowDays`)

### Business model split doesn't add up
→ Ensure `IsTotal = FALSE` filter when breaking by business model; use `(by BM)` measures

### Material Decision metrics missing
→ Confirm `MetricFamily = 'Decision'` and `IsBurnDown = FALSE` filter

## Performance Tuning

- Materialized views for `ExecSummary` and `CleansingWorklist`
- Indexes on `(Pipeline, CapturedAt)`, `(BusinessModel, IsTotal)`
- WebSocket for real-time without constant polling
- React memo on chart components

## Support & Contact

- **Issues**: https://github.com/Mahmoud-ElBanhawy-SE/sap-migration-dashboard/issues
- **Documentation**: See `/docs` folder
- **Database Schema**: `/docs/DATABASE_SCHEMA.md`
- **API Reference**: `/docs/API_REFERENCE.md`

## License

MIT — See LICENSE file

---

**Inspired by** the Schneider Electric Cutover Dashboard  
**Based on** the Marvin KPI Pipeline and Power BI Query Pack  
**Last Updated**: 2026-09-15
