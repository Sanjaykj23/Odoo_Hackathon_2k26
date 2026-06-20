require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for the hackathon prototype
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// SSE Real-time Endpoint
const sse = require('./middleware/sse');
app.get('/api/events', sse.register);

// API Routes
app.use('/api', apiRoutes);

// Base Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Odoo Cafe POS Backend API', status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Run migrations on startup, then start server
const runMigrations = require('./migrations');
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`Odoo Cafe POS Backend running on port ${PORT}`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
      console.log(`=============================================`);
    });
  })
  .catch(err => {
    console.error('Failed to run migrations. Starting server anyway...', err);
    app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`Odoo Cafe POS Backend running on port ${PORT} (Migration Error)`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
      console.log(`=============================================`);
    });
  });

