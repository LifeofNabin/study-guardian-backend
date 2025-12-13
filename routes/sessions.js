// FILE PATH: backend/routes/sessions.js
// ✅ COMPLETE VERSION WITH /recent ENDPOINT ADDED

import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Room from '../models/Room.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ✅ NEW: Get recent sessions (for teacher monitoring and analytics)
router.get('/recent', authenticateToken, async (req, res) => {
  try {
    let query = {};
    
    // If teacher, get sessions for their rooms
    if (req.user.role === 'teacher') {
      const rooms = await Room.find({ teacher_id: req.user.id });
      const roomIds = rooms.map(r => r._id);
      query.room_id = { $in: roomIds };
    } 
    // If student, get their own sessions
    else if (req.user.role === 'student') {
      query.student_id = req.user.id;
    }
    
    const sessions = await Session.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('student_id', 'name email')
      .populate('room_id', 'title code');
      
    console.log(`✅ Found ${sessions.length} recent sessions for ${req.user.role}`);
    
    res.json(sessions);
  } catch (error) {
    console.error('❌ Error fetching recent sessions:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch recent sessions',
      error: error.message 
    });
  }
});

// Create new session
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { room_id, document_id, document_path } = req.body;
    const student_id = req.user.id;
    
    console.log('📥 Creating session:', {
      room_id,
      document_id,
      document_path,
      student_id
    });

    // Validate required fields
    if (!document_id || !document_path) {
      return res.status(400).json({ 
        success: false,
        message: 'Document ID and path are required to start a session' 
      });
    }

    // Find and automatically end any previous active session for this student
    const existingSession = await Session.findOne({
      student_id,
      is_active: true
    });

    if (existingSession) {
      console.log('⚠️ Found an orphaned active session. Automatically ending it now:', existingSession._id);
      
      existingSession.is_active = false;
      existingSession.end_time = new Date();
      existingSession.duration_seconds = Math.floor(
        (existingSession.end_time - existingSession.start_time) / 1000
      );
      
      await existingSession.save();
      console.log('✅ Orphaned session ended. Duration:', existingSession.duration_seconds, 'seconds.');
    }

    // Create new session
    const session = new Session({
      room_id,
      document_id,
      document_path,
      student_id,
      is_active: true,
      start_time: new Date(),
      interactions: [],
      metrics: {}
    });

    await session.save();
    
    console.log('✅ Session created successfully:', session._id);

    res.status(201).json({ 
      success: true,
      session: {
        _id: session._id,
        room_id: session.room_id,
        document_id: session.document_id,
        document_path: session.document_path,
        student_id: session.student_id,
        is_active: session.is_active,
        start_time: session.start_time
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create session',
      error: error.message 
    });
  }
});

// Get session by ID
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('student_id', 'name email')
      .populate('room_id', 'title subject teacher_id');
    
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    // Check if user has access to this session
    if (session.student_id._id.toString() !== req.user.id && 
        req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.json({ 
      success: true,
      session 
    });
  } catch (error) {
    console.error('❌ Error fetching session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch session',
      error: error.message 
    });
  }
});

// Get active session for current user
router.get('/active/current', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOne({
      student_id: req.user.id,
      is_active: true
    }).populate('room_id', 'title subject');
    
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'No active session found' 
      });
    }
    
    res.json({ 
      success: true,
      session 
    });
  } catch (error) {
    console.error('❌ Error fetching active session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch active session' 
    });
  }
});

// End session
router.patch('/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await Session.findOne({ _id: sessionId });
    
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    // Verify ownership
    if (session.student_id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!session.is_active) {
      return res.status(400).json({
        success: false,
        message: 'Session is already ended'
      });
    }
    
    session.is_active = false;
    session.end_time = new Date();
    session.duration_seconds = Math.floor(
      (session.end_time - session.start_time) / 1000
    );
    
    await session.save();
    
    console.log('✅ Session ended:', session._id, 'Duration:', session.duration_seconds);
    
    res.json({ 
      success: true,
      message: 'Session ended successfully',
      session: {
        _id: session._id,
        duration_seconds: session.duration_seconds,
        end_time: session.end_time
      }
    });
  } catch (error) {
    console.error('❌ Error ending session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to end session',
      error: error.message 
    });
  }
});

// Get session metrics
router.get('/:sessionId/metrics', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    // Calculate real-time metrics
    const webcamInteractions = session.interactions.filter(i => i.type === 'webcam');
    const pageInteractions = session.interactions.filter(i => i.type === 'page_turn');
    
    const metrics = {
      totalInteractions: session.interactions.length,
      webcamEvents: webcamInteractions.length,
      pageChanges: pageInteractions.length,
      duration: session.is_active 
        ? Math.floor((new Date() - session.start_time) / 1000)
        : session.duration_seconds,
      isActive: session.is_active,
      ...session.metrics
    };
    
    res.json({ 
      success: true,
      metrics 
    });
  } catch (error) {
    console.error('❌ Error fetching metrics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch metrics' 
    });
  }
});

// Delete session (admin/cleanup)
router.delete('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ 
        success: false,
        message: 'Session not found' 
      });
    }

    // Only student or teacher can delete
    if (session.student_id.toString() !== req.user.id && 
        req.user.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Session.findByIdAndDelete(req.params.sessionId);
    
    res.json({ 
      success: true,
      message: 'Session deleted successfully' 
    });
  } catch (error) {
    console.error('❌ Error deleting session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to delete session' 
    });
  }
});

export default router;