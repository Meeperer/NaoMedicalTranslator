import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import conversationRoutes from './routes/conversations.js';
import aiRoutes from './routes/ai.js';
import { getClientErrorMessage } from './utils/safeError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production';

// Ensure .env is loaded from server directory when run from project root
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

const groqKey = process.env.GROQ_API_KEY || '';
const groqKeyPlaceholder = groqKey.length === 0 || groqKey.includes('your_groq') || groqKey === 'your_groq_api_key_here';
if (groqKeyPlaceholder && process.env.NODE_ENV !== 'production') {
  console.log('[NaoMedical] AI summary: set GROQ_API_KEY in server/.env to use "Generate AI summary".');
}
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check before DB (so /api/health responds even if MongoDB is slow or down)
app.use((req, res, next) => {
  const path = (req.url || '/').split('?')[0];
  if (req.method === 'GET' && path === '/api/health') {
    return res.json({ ok: true, vercel: isVercel, message: 'Express API is reachable' });
  }
  next();
});

// Log incoming request only in development (avoid leaking query params or user data in production)
if (isVercel && !isProduction) {
  app.use((req, res, next) => {
    const pathOnly = (req.url || '/').split('?')[0];
    console.log('[naomedical-express]', req.method, pathOnly);
    next();
  });
}

// Wait for MongoDB before handling any API request (avoids "buffering timed out" on serverless)
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/naomedical';
if ((process.env.RENDER || process.env.VERCEL) && mongoUri.includes('localhost')) {
  console.error('[NaoMedical] Set MONGODB_URI (e.g. MongoDB Atlas) in this environment. localhost is not available.');
}
const mongooseConnectPromise = mongoose
  .connect(mongoUri)
  .then(() => {
    if (!isVercel) console.log('MongoDB connected');
    return null;
  })
  .catch((err) => {
    if (!isProduction) console.error('MongoDB error:', err.message);
    throw err;
  });

app.use(async (req, res, next) => {
  try {
    await mongooseConnectPromise;
    next();
  } catch (err) {
    if (!isProduction) console.error('Database error:', err?.message);
    res.status(503).json({
      error: 'Database unavailable',
      ...(isProduction ? {} : { message: err?.message }),
    });
  }
});

// Uploaded audio (disk only when not on Vercel; on Vercel we use Blob in the route)
if (!isVercel) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

app.use('/api/conversations', conversationRoutes);
app.use('/api/ai', aiRoutes);

// Serve React build in production (only when running as standalone server, not on Vercel)
if (!isVercel && process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

if (!isVercel) {
  app.listen(PORT, () => console.log(`NaoMedical server on port ${PORT} (polling only)`));
}

export default app;
