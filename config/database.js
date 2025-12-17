// backend/config/database.js

import mongoose from 'mongoose';

/**
 * MongoDB Connection Configuration
 * Handles connection to MongoDB database with proper error handling
 * and connection event listeners
 */

export const connectDB = async () => {
  try {
    // Check if MongoDB URI is provided
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    console.log('🔍 Attempting MongoDB connection...');
    console.log('URI present:', !!process.env.MONGODB_URI);
    
    // Mask password for logging
    const maskedURI = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':***@');
    console.log('Masked URI:', maskedURI);

    // MongoDB connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased to 10 seconds
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      w: 'majority'
    };

    // Connect to MongoDB
    const conn = await mongoose.connect(process.env.MONGODB_URI, options);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`📈 Ready State: ${getConnectionStatus()}`);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('🔗 Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose disconnected from MongoDB');
    });

    return conn;

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // ⚠️ CRITICAL: DO NOT EXIT - throw error instead
    throw error; // Let server.js handle whether to exit or continue
  }
};

/**
 * Get current connection status
 */
export const getConnectionStatus = () => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  return states[mongoose.connection.readyState] || 'unknown';
};

/**
 * Close database connection
 */
export const closeDB = async () => {
  try {
    await mongoose.connection.close();
    console.log('✅ Database connection closed successfully');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
    throw error;
  }
};