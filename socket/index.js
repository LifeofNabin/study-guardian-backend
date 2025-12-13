/**
 * FILE PATH: backend/socket/index.js
 * * Initializes the Socket.IO server and handles connection/room logic.
 * It connects the real-time backend with the frontend metrics and monitoring panels.
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Define the function that sets up Socket.IO
const initializeSocketIO = (server, app) => {
  // 1. Configure CORS for Socket.IO
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    },
    // Optional: Configure transport methods
    transports: ['websocket', 'polling'], 
  });

  // 2. Attach Socket.IO instance to the Express App
  // This allows routes (like interactions.js) to access the server instance via req.app.get('io')
  app.set('io', io);

  // 3. Socket.IO Middleware for Authentication
  // Ensures only authenticated users can establish a connection
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication failed: No token provided'));
    }

    try {
      // Use the same secret as JWT_ACCESS_SECRET
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      
      const user = await User.findById(decoded.userId).select('-password');

      if (!user || !user.is_active) {
        return next(new Error('Authentication failed: User invalid or inactive'));
      }
      
      // Attach user details to the socket object
      socket.user = {
        _id: user._id.toString(),
        role: user.role,
        name: user.name,
      };

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new Error('Authentication failed: Token expired'));
      }
      return next(new Error('Authentication failed: Invalid token'));
    }
  });


  // 4. Main Connection Handler
  io.on('connection', (socket) => {
    const { user } = socket;
    console.log(`\n🔌 Socket connected: ${user.name} (${user.role}) [ID: ${socket.id}]`);

    // --- Student-Specific Logic ---
    if (user.role === 'student') {
      // ⭐️ Student joins their private channel for receiving real-time metrics
      // (Used by frontend MetricsPanel.js)
      const studentChannel = `student:${user._id}`;
      socket.join(studentChannel);
      console.log(`   --> Student joined private channel: ${studentChannel}`);

      // Emit connection success to the client
      socket.emit('connection-status', { success: true, message: 'Connected to real-time metrics' });
    }

    // --- Teacher-Specific Logic ---
    if (user.role === 'teacher') {
      // Teachers don't join a general channel but can listen for requests to join a 'room'
      console.log(`   --> Teacher ready to join monitoring rooms.`);

      // Handler for a teacher requesting to join a specific room for monitoring
      socket.on('join-room', (roomId) => {
        const roomChannel = `room:${roomId}`;
        socket.join(roomChannel);
        console.log(`   --> Teacher ${user.name} joined monitoring room: ${roomChannel}`);
        socket.emit('room-joined', roomId);
      });
      
      // Handler for a teacher requesting to leave a room
      socket.on('leave-room', (roomId) => {
        const roomChannel = `room:${roomId}`;
        socket.leave(roomChannel);
        console.log(`   --> Teacher ${user.name} left monitoring room: ${roomChannel}`);
        socket.emit('room-left', roomId);
      });
      
      // Emit connection success to the client
      socket.emit('connection-status', { success: true, message: 'Connected to teacher monitoring server' });
    }
    
    // 5. Disconnection Handler
    socket.on('disconnect', () => {
      console.log(`\n🔌 Socket disconnected: ${user.name} [ID: ${socket.id}]`);
    });
  });

  return io;
};

export default initializeSocketIO;