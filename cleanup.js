// Create: backend/cleanup.js
import mongoose from 'mongoose';
import Session from './models/Session.js';

mongoose.connect('mongodb://localhost:27017/myapp');

async function cleanup() {
  const result = await Session.updateMany(
    { is_active: true },
    { is_active: false, end_time: new Date() }
  );
  console.log(`✅ Closed ${result.modifiedCount} active sessions`);
  process.exit(0);
}

cleanup();