/**
 * FILE PATH: backend/server.js
 * ✅ COMPLETE VERSION: Fixed PDF uploads - express-fileupload only for teacher routes
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import helmet from 'helmet';
import fileUpload from 'express-fileupload'; // ✅ For teacher uploads only
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config imports
import { connectDB } from './config/database.js';
import passport from './config/passport.js';

// Middleware imports
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/auth.js';
import roomsRoutes from './routes/rooms.js';
import routinesRoutes from './routes/routines.js';
import sessionsRoutes from './routes/sessions.js';
import interactionsRoutes from './routes/interactions.js';
import aiRoutes from './routes/ai.js';
import analyticsRoutes from './routes/analytics.js';

// Socket.IO Import
import initializeSocketIO from './socket/index.js';
// After all imports in server.js
console.log('🔍 Checking route imports:');
console.log('authRoutes type:', typeof authRoutes);
console.log('authRoutes:', authRoutes ? 'Loaded' : 'NOT LOADED');

// Test if it has router methods
if (authRoutes) {
  console.log('authRoutes.stack length:', authRoutes.stack?.length || 0);
}

// ======================= INITIALIZATION =======================
const app = express();
const httpServer = createServer(app);

console.log('🚀 Initializing studyguardian Server...');

// ======================= CORS CONFIGURATION =======================
// ======================= CORS CONFIGURATION =======================
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'https://studyguardian.vercel.app', // ✅ ADD THIS
    'https://study-guardian-frontend.onrender.com',
    'https://studyguardian.vercel.app' // Vercel domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
console.log('✅ CORS configured');

// ======================= SECURITY MIDDLEWARE =======================
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Allow inline scripts for development
}));
console.log('✅ Security headers configured');

// ======================= BODY PARSING MIDDLEWARE =======================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
console.log('✅ Body parsers configured');

// ======================= STATIC FILES =======================
// Serve uploaded PDFs
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
console.log('✅ Static file serving configured');

// ======================= PASSPORT AUTHENTICATION =======================
app.use(passport.initialize());
console.log('✅ Passport initialized');

// ======================= DATABASE CONNECTION =======================
// connectDB();
// ======================= DATABASE CONNECTION =======================
// ======================= DATABASE CONNECTION =======================
const initializeDatabase = async () => {
  try {
    await connectDB();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    console.log('⚠️ Server starting without database connection');
    console.log('⚠️ Auth and data persistence will not work');
    // Don't exit - let server start in degraded mode
  }
};

// Start database connection (don't await - let it run in background)
initializeDatabase().catch(err => {
  console.error('Unhandled database error:', err);
});
// Test MongoDB connection details
console.log('🔍 MongoDB Configuration:');
console.log('URI present:', !!process.env.MONGODB_URI);
if (process.env.MONGODB_URI) {
  console.log('URI length:', process.env.MONGODB_URI.length);
  // Mask password in logs for security
  const maskedURI = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':***@');
  console.log('Masked URI:', maskedURI);
}

connectToDatabase();

// ======================= SOCKET.IO SETUP =======================
const io = initializeSocketIO(httpServer, app);
console.log('✅ Socket.IO server initialized');

// ======================= FILE UPLOAD MIDDLEWARE =======================
// ✅ CRITICAL FIX: Apply express-fileupload ONLY to teacher routes
// This prevents conflict with multer used in student routes
const teacherFileUpload = fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  },
  abortOnLimit: true,
  responseOnLimit: 'File size limit exceeded (max 10MB)',
  useTempFiles: false,
  debug: false // Disable verbose logging
});
console.log('✅ File upload middleware configured (express-fileupload for teachers, multer for students)');

// ======================= API ROUTES =======================
// Health check (before other routes)
app.get('/healthz', (req, res) => {
  res.json({ 
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes with conditional file upload middleware
app.use('/api/auth', authRoutes);
app.use('/api/rooms', teacherFileUpload, roomsRoutes); // ✅ Teacher uploads use express-fileupload
app.use('/api/routines', routinesRoutes); // ✅ Student uploads use multer (defined in route)
app.use('/api/sessions', sessionsRoutes);
app.use('/api/interactions', interactionsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/analytics', analyticsRoutes);
console.log('✅ API routes registered');

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'studyguardian API is running',
    status: 'ready',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      rooms: '/api/rooms',
      routines: '/api/routines',
      sessions: '/api/sessions',
      interactions: '/api/interactions',
      ai: '/api/ai',
      analytics: '/api/analytics'
    }
  });
});

// ======================= 404 HANDLER =======================
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// ======================= ERROR HANDLER =======================
app.use(errorHandler);

// ======================= START SERVER =======================
const PORT = parseInt(process.env.PORT) || 5001;

httpServer.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 studyguardian Server is running`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`📤 Teacher uploads: express-fileupload`);
  console.log(`📤 Student uploads: multer`);
  console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
  console.log('='.repeat(50));
});

// ======================= GRACEFUL SHUTDOWN =======================
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// ======================= UNHANDLED ERRORS =======================
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

export default app;