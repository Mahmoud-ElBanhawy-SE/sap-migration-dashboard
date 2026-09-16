import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app: Express = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// KPI Routes
app.get('/api/kpi/progress', async (req: Request, res: Response) => {
  try {
    const { period = '30d', pipeline } = req.query;
    
    let query = `
      SELECT 
        fp.id,
        fp.metric_name,
        fp.metric_value_num,
        fp.metric_unit,
        fp.business_model,
        fp.captured_at,
        fp.is_total
      FROM fact_progress fp
      JOIN dim_run dr ON fp.run_key = dr.run_key
      WHERE dr.is_latest_run = true
      AND dr.kpi_kind = 'Progress'
    `;

    const params: any[] = [];

    if (period && period !== 'all') {
      const days = parseInt(period as string);
      query += ` AND fp.captured_at >= NOW() - INTERVAL '${days} days'`;
    }

    if (pipeline) {
      query += ` AND dr.pipeline = $${params.length + 1}`;
      params.push(pipeline);
    }

    query += ` ORDER BY fp.captured_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching progress KPIs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/kpi/executive-summary', async (req: Request, res: Response) => {
  try {
    const { pipeline } = req.query;
    
    let query = `
      SELECT 
        es.id,
        es.pipeline,
        es.metric_name,
        es.latest_value,
        es.delta_window,
        es.burn_per_day,
        es.required_burn_per_day,
        es.projected_zero_date,
        es.track_status,
        es.metric_family,
        es.is_burn_down,
        es.captured_at
      FROM exec_summary es
      WHERE es.is_latest = true
    `;

    const params: any[] = [];

    if (pipeline) {
      query += ` AND es.pipeline = $${params.length + 1}`;
      params.push(pipeline);
    }

    query += ` ORDER BY es.pipeline, es.metric_name`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching executive summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/kpi/cleansing', async (req: Request, res: Response) => {
  try {
    const { pipeline } = req.query;
    
    let query = `
      SELECT 
        fc.id,
        fc.signal_theme,
        fc.metric_label,
        fc.metric_value,
        fc.signal_class,
        fc.business_model,
        fc.captured_at
      FROM fact_cleansing fc
      JOIN dim_run dr ON fc.run_key = dr.run_key
      WHERE dr.is_latest_run = true
      AND dr.kpi_kind = 'Cleansing'
    `;

    const params: any[] = [];

    if (pipeline) {
      query += ` AND dr.pipeline = $${params.length + 1}`;
      params.push(pipeline);
    }

    query += ` ORDER BY fc.captured_at DESC, fc.signal_theme`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cleansing data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Trends Routes
app.get('/api/trends/burndown', async (req: Request, res: Response) => {
  try {
    const { pipeline } = req.query;
    
    let query = `
      SELECT 
        dr.captured_at,
        SUM(CASE WHEN fp.metric_name = 'Hard-Blocked Lines' THEN fp.metric_value_num ELSE 0 END) as hard_blocked,
        SUM(CASE WHEN fp.metric_name = 'To Migrate Lines' THEN fp.metric_value_num ELSE 0 END) as to_migrate
      FROM fact_progress fp
      JOIN dim_run dr ON fp.run_key = dr.run_key
      WHERE dr.kpi_kind = 'Progress'
      AND fp.is_total = true
    `;

    const params: any[] = [];

    if (pipeline) {
      query += ` AND dr.pipeline = $${params.length + 1}`;
      params.push(pipeline);
    }

    query += ` GROUP BY dr.captured_at ORDER BY dr.captured_at ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching burndown data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });

  socket.on('subscribe_kpi', (pipeline) => {
    socket.join(`kpi:${pipeline}`);
  });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, io, pool };
