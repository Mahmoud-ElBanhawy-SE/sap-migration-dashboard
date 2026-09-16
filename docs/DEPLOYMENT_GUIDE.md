# Deployment Guide

## Quick Start (Docker Compose - Recommended)

The easiest way to get the dashboard running is with Docker Compose. This will spin up all services automatically.

### Prerequisites
- Docker & Docker Compose installed
- 4GB RAM available
- Ports 3000, 5000, 5432 available

### Deploy Locally

```bash
# Clone the repository
git clone https://github.com/Mahmoud-ElBanhawy-SE/sap-migration-dashboard.git
cd sap-migration-dashboard

# Start all services
docker-compose up -d

# Check services are running
docker-compose ps

# View logs
docker-compose logs -f
```

**Access the dashboard:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: localhost:5432

### Stop Services

```bash
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

---

## Manual Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Set Up PostgreSQL Database

```bash
# Create database
createdb cutover_dashboard

# Initialize schema and seed data
psql cutover_dashboard -f backend/database/init.sql

# Verify tables created
psql cutover_dashboard -c "\dt"
```

### 2. Install & Run Backend

```bash
cd backend

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql://username:password@localhost:5432/cutover_dashboard
NODE_ENV=development
PORT=5000
CUTOVER_DATE=2027-03-01
BASELINE_DATE=2026-06-01
FRONTEND_URL=http://localhost:3000
EOF

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm run dev
# Server will run on http://localhost:5000
```

### 3. Install & Run Frontend

```bash
cd frontend

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000
REACT_APP_CUTOVER_DATE=2027-03-01
EOF

# Install dependencies
npm install

# Start development server
npm run dev
# Frontend will run on http://localhost:3000
```

---

## Production Deployment

### Environment Configuration

Create production `.env` files with secure credentials:

**Backend (`.env.production`):**
```
DATABASE_URL=postgresql://prod_user:SECURE_PASSWORD@prod-db-host:5432/cutover_dashboard
NODE_ENV=production
PORT=5000
CUTOVER_DATE=2027-03-01
BASELINE_DATE=2026-06-01
FRONTEND_URL=https://your-domain.com
JWT_SECRET=your-secure-secret-key
LOG_LEVEL=info
```

**Frontend (`.env.production`):**
```
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_WS_URL=wss://api.your-domain.com
REACT_APP_CUTOVER_DATE=2027-03-01
```

### Option A: Docker Compose (Production)

```bash
# Create production docker-compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Scale backend service
docker-compose up -d --scale backend=3
```

### Option B: Kubernetes Deployment

**Create deployment manifest (`k8s/deployment.yaml`):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cutover-dashboard-backend
  labels:
    app: cutover-dashboard
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cutover-dashboard
      component: backend
  template:
    metadata:
      labels:
        app: cutover-dashboard
        component: backend
    spec:
      containers:
      - name: backend
        image: your-registry/cutover-dashboard-backend:latest
        ports:
        - containerPort: 5000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dashboard-secrets
              key: database-url
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 5000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: cutover-dashboard-backend
  labels:
    app: cutover-dashboard
spec:
  type: LoadBalancer
  ports:
  - port: 5000
    targetPort: 5000
    protocol: TCP
  selector:
    app: cutover-dashboard
    component: backend
```

Deploy to Kubernetes:

```bash
# Create namespace
kubectl create namespace cutover-dashboard

# Create secrets
kubectl create secret generic dashboard-secrets \
  --from-literal=database-url='postgresql://...' \
  -n cutover-dashboard

# Deploy
kubectl apply -f k8s/deployment.yaml -n cutover-dashboard

# Monitor
kubectl logs -f deployment/cutover-dashboard-backend -n cutover-dashboard
```

### Option C: Cloud Platforms

#### AWS ECS
```bash
# Build and push image
docker build -t cutover-dashboard-backend:latest backend/
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_REGISTRY_URL
docker tag cutover-dashboard-backend:latest YOUR_REGISTRY_URL/cutover-dashboard-backend:latest
docker push YOUR_REGISTRY_URL/cutover-dashboard-backend:latest

# Create ECS task definition and service
# Use AWS Console or CloudFormation
```

#### Azure Container Instances
```bash
# Push to Azure Container Registry
az acr build --registry YOUR_REGISTRY --image cutover-dashboard-backend:latest backend/

# Deploy container instance
az container create \
  --resource-group your-rg \
  --name cutover-dashboard-backend \
  --image YOUR_REGISTRY.azurecr.io/cutover-dashboard-backend:latest \
  --cpu 1 --memory 1.5 \
  --environment-variables DATABASE_URL="postgresql://..." \
  --ports 5000
```

---

## Data Integration

### Loading Data from Marvin KPI Pipeline

The dashboard expects data in these tables:
- `fact_progress` — Volume and Readiness metrics
- `fact_cleansing` — Cleansing signals
- `exec_summary` — Pre-computed KPI headlines

**Option 1: SQL Server Integration (Recommended)**

Create a scheduled job to:
1. Query `DP1.MarvinKpiHistory` from your UNIFY instance
2. Transform and load into PostgreSQL `fact_progress`, `fact_cleansing`
3. Compute `exec_summary` view

Example ETL query:

```sql
-- Load Progress Metrics (run daily)
INSERT INTO fact_progress (run_key, metric_name, metric_value_num, metric_unit, business_model, is_total, captured_at)
SELECT 
  CONCAT(pipeline, '_', CAST(captured_at_utc AS VARCHAR)),
  metric_name,
  CAST(metric_value_text AS DECIMAL),
  metric_unit,
  business_model,
  is_total,
  captured_at_utc
FROM marvin_source_table
WHERE kpi_kind = 'Progress'
  AND captured_at_utc > NOW() - INTERVAL '1 day';
```

**Option 2: REST API Integration**

Use the dashboard's API to push data:

```bash
curl -X POST http://localhost:5000/api/kpi/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "run_key": "SO_20260916_100000",
    "pipeline": "SO",
    "metrics": [
      {
        "metric_name": "To Migrate Lines",
        "metric_value_num": 50000,
        "metric_unit": "lines",
        "business_model": "(Total)",
        "is_total": true
      }
    ]
  }'
```

---

## Monitoring & Maintenance

### Check Health

```bash
# Backend health
curl http://localhost:5000/health

# Database connection
curl http://localhost:5000/api/health/db
```

### View Logs

```bash
# Docker Compose
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Kubernetes
kubectl logs -f deployment/cutover-dashboard-backend -n cutover-dashboard

# Manual
tail -f backend/logs/app.log
```

### Database Backup

```bash
# Backup
pg_dump cutover_dashboard > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql cutover_dashboard < backup_20260916_100000.sql
```

### Performance Tuning

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM fact_progress WHERE captured_at > NOW() - INTERVAL '7 days';

-- Vacuum database
VACUUM ANALYZE;

-- Check index usage
SELECT * FROM pg_stat_user_indexes ORDER BY idx_scan DESC;
```

---

## Troubleshooting

### Issue: "Cannot connect to database"

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check credentials
psql -h localhost -U dashboard_user -d cutover_dashboard

# View PostgreSQL logs
docker-compose logs postgres
```

### Issue: "Frontend shows blank dashboard"

1. Check backend is running: `curl http://localhost:5000/health`
2. Check browser console for errors (F12)
3. Check CORS settings in backend
4. Verify `REACT_APP_API_URL` environment variable

### Issue: "Data not appearing"

1. Verify data loaded into database: `SELECT COUNT(*) FROM fact_progress;`
2. Check `is_latest_run` flag is set correctly
3. Verify `kpi_kind` matches query filters
4. Check for timezone mismatches in dates

---

## Security Checklist

- [ ] Change default database password
- [ ] Use strong JWT secret in production
- [ ] Enable HTTPS/TLS for frontend
- [ ] Enable CORS only for trusted domains
- [ ] Use environment variables for secrets (not hardcoded)
- [ ] Set database firewall rules
- [ ] Enable database backups
- [ ] Implement API rate limiting
- [ ] Enable audit logging
- [ ] Use secrets management (AWS Secrets Manager, Azure Key Vault)

---

## Scaling & Performance

### Horizontal Scaling

```bash
# Docker Compose
docker-compose up -d --scale backend=5

# Kubernetes
kubectl scale deployment cutover-dashboard-backend --replicas=5
```

### Database Optimization

```sql
-- Create indexes for common queries
CREATE INDEX idx_fact_progress_pipeline_date ON fact_progress(pipeline, captured_at);
CREATE INDEX idx_exec_summary_latest ON exec_summary(is_latest, pipeline);

-- Partition large tables by date
CREATE TABLE fact_progress_2026_q1 PARTITION OF fact_progress
  FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
```

### Caching

The dashboard uses in-memory caching for executive summaries:

```bash
# Redis integration (optional)
docker run -d -p 6379:6379 redis:alpine
```

Update `.env`:
```
REDIS_URL=redis://localhost:6379
CACHE_TTL=300
```

---

## Support & Troubleshooting

- **Documentation**: `/docs` folder in repository
- **Database Schema**: `/docs/DATABASE_SCHEMA.md`
- **API Reference**: `/docs/API_REFERENCE.md`
- **Issues**: https://github.com/Mahmoud-ElBanhawy-SE/sap-migration-dashboard/issues
- **Contact**: sesa834252@se.com

---

**Last Updated**: 2026-09-16  
**Tested On**: Docker 24.0, Docker Compose 2.20, Node.js 18.18, PostgreSQL 15
