require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const apiRoutes = require('./routes/api');
const socketUtil = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: '*', // Allow all origins for the hackathon prototype
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, '../public')));

// Initialize Sockets cleanly attached to HTTP pipeline
socketUtil.init(server, corsOptions);

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

// Advanced POS Routes
app.use('/api/v2/shops', require('./routes/shopRoutes'));
app.use('/api/booking', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));

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
    server.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`Odoo Cafe POS Backend running on port ${PORT}`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
      console.log(`=============================================`);
    });
  })
  .catch(err => {
    console.error('Failed to run migrations. Starting server anyway...', err);
    server.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`Odoo Cafe POS Backend running on port ${PORT} (Migration Error)`);
      console.log(`API base URL: http://localhost:${PORT}/api`);
      console.log(`=============================================`);
    });
  });
