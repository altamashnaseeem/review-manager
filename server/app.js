import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import reviewRoutes from './routes/review.js';
import businessRoutes from './routes/business.js';
import errorHandler from './middleware/errorHandler.js';
import paymentRoutes, { razorpayWebhook } from './routes/paymentRoutes.js';
dotenv.config();



const app = express();
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(proxyHops) && proxyHops > 0 && proxyHops <= 5) app.set('trust proxy', proxyHops);
// Security headers
app.use(helmet());

// CORS — only allow our frontend
app.use(cors({
  origin: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  credentials: true,
}));

// Preserve the raw bytes for signature verification before JSON parsing.
app.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '128kb' }), razorpayWebhook);

// Rate limiting — 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '64kb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'OK' : 'NOT_READY', timestamp: new Date().toISOString() });
});

app.get('/health/live', (_req, res) => res.json({ status: 'OK' }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
