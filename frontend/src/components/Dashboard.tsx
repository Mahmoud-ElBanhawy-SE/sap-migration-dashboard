import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.css';

interface KPIData {
  id: number;
  metric_name: string;
  metric_value_num: number;
  metric_unit: string;
  business_model: string;
  captured_at: string;
  is_total: boolean;
}

interface ExecutiveSummary {
  pipeline: string;
  metric_name: string;
  latest_value: number;
  track_status: string;
  projected_zero_date: string;
}

const Dashboard: React.FC = () => {
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummary[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState('SO');
  const [selectedPeriod, setSelectedPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPipeline, selectedPeriod]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [progressRes, summaryRes] = await Promise.all([
        axios.get(`${API_URL}/api/kpi/progress?period=${selectedPeriod}&pipeline=${selectedPipeline}`),
        axios.get(`${API_URL}/api/kpi/executive-summary?pipeline=${selectedPipeline}`)
      ]);
      
      setKpiData(progressRes.data);
      setExecutiveSummary(summaryRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toMigrateMetrics = kpiData.filter(
    d => d.metric_name === 'To Migrate Lines' && d.is_total
  );

  const hardBlockedMetrics = kpiData.filter(
    d => d.metric_name === 'Hard-Blocked Lines' && d.is_total
  );

  const getTrackStatusColor = (status: string) => {
    switch (status) {
      case 'On track':
        return '#22c55e';
      case 'At risk':
        return '#f59e0b';
      case 'Off track':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>SAP S/4HANA Cutover Dashboard</h1>
        <div className="header-controls">
          <div className="control-group">
            <label htmlFor="pipeline-select">Pipeline:</label>
            <select 
              id="pipeline-select"
              value={selectedPipeline} 
              onChange={(e) => setSelectedPipeline(e.target.value)}
            >
              <option value="SO">Sales Orders (SO)</option>
              <option value="PO">Purchase Orders (PO)</option>
              <option value="STOCK">Stock</option>
            </select>
          </div>

          <div className="control-group">
            <label htmlFor="period-select">Period:</label>
            <select 
              id="period-select"
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="7d">Last 7 days</option>
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
      </header>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="dashboard-content">
        {/* KPI Cards */}
        <section className="kpi-cards-section">
          <h2>Key Performance Indicators</h2>
          <div className="kpi-cards-grid">
            {toMigrateMetrics.length > 0 && (
              <div className="kpi-card">
                <div className="kpi-card-header">To Migrate Lines</div>
                <div className="kpi-card-value">
                  {toMigrateMetrics[0].metric_value_num.toLocaleString()}
                </div>
                <div className="kpi-card-unit">{toMigrateMetrics[0].metric_unit}</div>
              </div>
            )}

            {hardBlockedMetrics.length > 0 && (
              <div className="kpi-card kpi-card-warning">
                <div className="kpi-card-header">Hard-Blocked Lines</div>
                <div className="kpi-card-value">
                  {hardBlockedMetrics[0].metric_value_num.toLocaleString()}
                </div>
                <div className="kpi-card-unit">{hardBlockedMetrics[0].metric_unit}</div>
              </div>
            )}

            <div className="kpi-card">
              <div className="kpi-card-header">Days to Cutover</div>
              <div className="kpi-card-value">
                {Math.ceil((new Date('2027-03-01').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
              </div>
              <div className="kpi-card-unit">days</div>
            </div>
          </div>
        </section>

        {/* Executive Summary Table */}
        <section className="table-section">
          <h2>Executive Summary - Readiness</h2>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Latest Value</th>
                  <th>Projected Zero Date</th>
                  <th>Track Status</th>
                </tr>
              </thead>
              <tbody>
                {executiveSummary
                  .filter(d => d.metric_family === 'Readiness')
                  .map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.metric_name}</td>
                      <td>{row.latest_value.toLocaleString()}</td>
                      <td>{row.projected_zero_date || 'N/A'}</td>
                      <td>
                        <span 
                          className={`badge badge-${row.track_status.toLowerCase().replace(' ', '-')}`}
                          style={{ backgroundColor: getTrackStatusColor(row.track_status) }}
                        >
                          {row.track_status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Volume Trends */}
        <section className="chart-section">
          <h2>Volume Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={toMigrateMetrics.map(d => ({
              date: new Date(d.captured_at).toLocaleDateString(),
              value: d.metric_value_num
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#0ea5e9" name="To Migrate" />
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Burn-down Trend */}
        <section className="chart-section">
          <h2>Hard-Blocked Lines Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={hardBlockedMetrics.map(d => ({
              date: new Date(d.captured_at).toLocaleDateString(),
              blocked: d.metric_value_num
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="blocked" fill="#fca5a5" stroke="#ef4444" name="Hard-Blocked" />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
