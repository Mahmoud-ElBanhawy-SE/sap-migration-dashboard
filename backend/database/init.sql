-- Create dimensions
CREATE TABLE IF NOT EXISTS dim_date (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  year INT,
  quarter INT,
  month INT,
  day_of_month INT,
  day_of_week INT,
  is_cutover_day BOOLEAN DEFAULT FALSE,
  is_weekend BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_pipeline (
  id SERIAL PRIMARY KEY,
  pipeline VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100),
  description TEXT,
  sort_order INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_business_model (
  id SERIAL PRIMARY KEY,
  business_model VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150),
  description TEXT,
  sort_order INT,
  show_in_segment_slicer BOOLEAN DEFAULT TRUE,
  must_be_closed_before_cutover BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dim_run (
  id SERIAL PRIMARY KEY,
  run_key VARCHAR(255) NOT NULL UNIQUE,
  pipeline_id INT NOT NULL REFERENCES dim_pipeline(id),
  pipeline VARCHAR(50),
  kpi_kind VARCHAR(50) CHECK (kpi_kind IN ('Progress', 'Cleansing')),
  captured_at_utc TIMESTAMP,
  captured_at_date DATE,
  is_latest_run BOOLEAN DEFAULT FALSE,
  is_last_run_of_day BOOLEAN DEFAULT FALSE,
  run_timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (pipeline_id) REFERENCES dim_pipeline(id),
  FOREIGN KEY (captured_at_date) REFERENCES dim_date(date)
);

-- Create facts
CREATE TABLE IF NOT EXISTS fact_progress (
  id SERIAL PRIMARY KEY,
  run_key VARCHAR(255) NOT NULL REFERENCES dim_run(run_key),
  metric_name VARCHAR(100),
  metric_value_num DECIMAL(38, 6),
  metric_unit VARCHAR(50),
  metric_value_text TEXT,
  metric_value_kind VARCHAR(50),
  business_model_id INT REFERENCES dim_business_model(id),
  business_model VARCHAR(100),
  is_total BOOLEAN DEFAULT FALSE,
  is_repeated_total BOOLEAN DEFAULT FALSE,
  has_segment_detail BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (run_key) REFERENCES dim_run(run_key)
);

CREATE TABLE IF NOT EXISTS fact_cleansing (
  id SERIAL PRIMARY KEY,
  run_key VARCHAR(255) NOT NULL REFERENCES dim_run(run_key),
  signal_theme VARCHAR(150),
  metric_label VARCHAR(255),
  metric_value DECIMAL(38, 6),
  metric_value_text TEXT,
  signal_class VARCHAR(50) CHECK (signal_class IN ('Blocker', 'Cleansing', 'Profile')),
  business_model_id INT REFERENCES dim_business_model(id),
  business_model VARCHAR(100),
  rank_in_pipeline INT,
  is_total BOOLEAN DEFAULT FALSE,
  captured_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (run_key) REFERENCES dim_run(run_key)
);

-- Create summary tables
CREATE TABLE IF NOT EXISTS exec_summary (
  id SERIAL PRIMARY KEY,
  pipeline VARCHAR(50),
  metric_name VARCHAR(100),
  metric_family VARCHAR(50),
  latest_value DECIMAL(38, 6),
  delta_window DECIMAL(38, 6),
  pct_change_window DECIMAL(38, 6),
  pct_reduced_since_baseline DECIMAL(38, 6),
  burn_per_day DECIMAL(38, 6),
  required_burn_per_day DECIMAL(38, 6),
  projected_zero_date DATE,
  track_status VARCHAR(50),
  is_burn_down BOOLEAN DEFAULT FALSE,
  baseline_note TEXT,
  captured_at TIMESTAMP,
  is_latest BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleansing_worklist (
  id SERIAL PRIMARY KEY,
  pipeline VARCHAR(50),
  signal_theme VARCHAR(150),
  metric_label VARCHAR(255),
  latest_value DECIMAL(38, 6),
  delta_prior DECIMAL(38, 6),
  pct_reduced_since_baseline DECIMAL(38, 6),
  movement_label VARCHAR(100),
  signal_class VARCHAR(50),
  rank_in_pipeline INT,
  baseline_note TEXT,
  captured_at TIMESTAMP,
  is_latest BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fact_progress_run_key ON fact_progress(run_key);
CREATE INDEX IF NOT EXISTS idx_fact_progress_pipeline_date ON fact_progress((SELECT pipeline FROM dim_run WHERE dim_run.run_key = fact_progress.run_key), captured_at);
CREATE INDEX IF NOT EXISTS idx_fact_cleansing_run_key ON fact_cleansing(run_key);
CREATE INDEX IF NOT EXISTS idx_dim_run_latest ON dim_run(pipeline, is_latest_run);
CREATE INDEX IF NOT EXISTS idx_dim_run_captured_date ON dim_run(captured_at_date);
CREATE INDEX IF NOT EXISTS idx_exec_summary_pipeline ON exec_summary(pipeline, is_latest);

-- Seed data for pipelines
INSERT INTO dim_pipeline (pipeline, display_name, sort_order) VALUES
  ('SO', 'Sales Orders', 1),
  ('PO', 'Purchase Orders', 2),
  ('STOCK', 'Stock', 3)
ON CONFLICT (pipeline) DO NOTHING;

-- Seed data for business models
INSERT INTO dim_business_model (business_model, display_name, sort_order, show_in_segment_slicer) VALUES
  ('(Total)', 'Total', 0, FALSE),
  ('Transac', 'Transactional', 1, TRUE),
  ('Services', 'Services', 2, TRUE),
  ('Projects', 'Projects', 3, TRUE),
  ('Equipment', 'Equipment', 4, TRUE),
  ('Software', 'Software', 5, TRUE),
  ('(Not split)', 'Not Split', 99, FALSE)
ON CONFLICT (business_model) DO NOTHING;
