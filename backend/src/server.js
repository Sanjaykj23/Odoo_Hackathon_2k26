import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './config/prisma.js';
import * as socketUtil from './config/socket.js';

// Load environment configurations
dotenv.config();

// Solve global BigInt serialization issue in Node/Express response payload
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const app = express();
const PORT = process.env.PORT || 5000;

// Configure default CORS profile
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Express Middlewares
app.use(cors(corsOptions));
app.use(express.json());

// Log incoming HTTP transactions
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} - ${req.ip}`);
  next();
});

// Test health check endpoint ensuring db resilience
app.get('/health', async (req, res) => {
  const statusPayload = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'unknown'
  };

  try {
    // Run simple PostgreSQL validation query via Prisma
    await prisma.$queryRaw`SELECT 1`;
    statusPayload.database = 'connected';
    return res.status(200).json(statusPayload);
  } catch (err) {
    console.warn(`[Health Check] Database connectivity check failed: ${err.message}`);
    statusPayload.database = 'disconnected';
    statusPayload.error = err.message;
    // Return 200 to indicate Express server is alive, even if DB is still pending creation
    return res.status(200).json(statusPayload);
  }
});

// Global central error handler middleware
app.use((err, req, res, next) => {
  console.error('[Fatal Error] Caught unhandled route error:', err);
  return res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
});

// Create base HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize real-time Socket.io layer
socketUtil.init(server, corsOptions);

// Boot server listening loop
try {
  server.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`  Cafe POS Server successfully initialized!  `);
    console.log(`  Endpoint URL: http://localhost:${PORT}     `);
    console.log(`  Health Check: http://localhost:${PORT}/health`);
    console.log(`=============================================`);
  });
} catch (err) {
  console.error('[Bootstrap] Failed to listen on specified port:', err);
  process.exit(1);
}
