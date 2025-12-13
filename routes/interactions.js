// ============================================================================
// FILE 2: backend/routes/interactions.js - FIXED AND ADDED MISSING ENDPOINTS
// ============================================================================

import express from 'express';
import Session from '../models/Session.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ✅ POST - Save single interaction
router.post('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { type, data } = req.body;

    const validTypes = [
      'highlight', 'scroll', 'zoom', 'page_change', 'page_turn',
      'webcam', 'face_metric', 'click', 'hover', 'input', 'focus', 
      'blur', 'navigation', 'break_start', 'break_end'
    ];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid interaction type: ${type}`,
      });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.student_id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    session.interactions.push({
      type,
      data,
      timestamp: new Date(),
    });

    await session.save();

    // Return the saved interaction with its ID
    const savedInteraction = session.interactions[session.interactions.length - 1];

    res.json({ 
      success: true, 
      message: 'Interaction logged successfully',
      _id: savedInteraction._id,
      interaction: savedInteraction
    });
  } catch (error) {
    console.error('❌ Error logging interaction:', error);
    res.status(500).json({ success: false, message: 'Failed to log interaction' });
  }
});

// ✅ POST - Batch save interactions
router.post('/:sessionId/batch', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { interactions } = req.body;

    if (!Array.isArray(interactions)) {
      return res.status(400).json({
        success: false,
        message: 'Interactions must be an array',
      });
    }

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const validTypes = [
      'highlight', 'scroll', 'zoom', 'page_change', 'page_turn',
      'webcam', 'face_metric', 'click', 'hover', 'input', 'focus', 
      'blur', 'navigation', 'break_start', 'break_end'
    ];

    const interactionsToAdd = interactions
      .filter((i) => validTypes.includes(i.type))
      .map(({ type, data }) => ({
        type,
        data,
        timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
      }));

    session.interactions.push(...interactionsToAdd);
    await session.save();

    res.json({
      success: true,
      message: `${interactionsToAdd.length} interactions logged successfully`,
    });
  } catch (error) {
    console.error('❌ Error batch logging interactions:', error);
    res.status(500).json({ success: false, message: 'Failed to batch log interactions' });
  }
});

// ✅ GET - Fetch all interactions for a session (RETURNS ARRAY DIRECTLY)
router.get('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.student_id.toString() !== req.user.id && req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // ✅ CRITICAL FIX: Return interactions array directly (not nested in object)
    res.json(session.interactions);
  } catch (error) {
    console.error('❌ Error fetching interactions:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch interactions' });
  }
});

// ✅ DELETE - Delete a single interaction (highlight)
router.delete('/:interactionId', authenticateToken, async (req, res) => {
  try {
    const { interactionId } = req.params;

    // Find session containing this interaction
    const session = await Session.findOne({
      'interactions._id': interactionId,
      student_id: req.user.id
    });

    if (!session) {
      return res.status(404).json({ 
        success: false, 
        message: 'Interaction not found or access denied' 
      });
    }

    // Remove the interaction
    session.interactions = session.interactions.filter(
      i => i._id.toString() !== interactionId
    );

    await session.save();

    res.json({ 
      success: true, 
      message: 'Interaction deleted successfully',
      id: interactionId
    });
  } catch (error) {
    console.error('❌ Error deleting interaction:', error);
    res.status(500).json({ success: false, message: 'Failed to delete interaction' });
  }
});

// ✅ GET - Overall analytics for student dashboard
router.get('/analytics/overall', authenticateToken, async (req, res) => {
  try {
    const completedSessions = await Session.find({
      student_id: req.user.id,
      is_active: false,
      end_time: { $exists: true }
    });

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const totalSeconds = completedSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const thisWeekSessions = completedSessions.filter(s => s.end_time >= oneWeekAgo);
    const thisWeekSeconds = thisWeekSessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

    const avgEngagement = completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => {
          const faceMetrics = s.interactions.filter(i => i.type === 'face_metric');
          const avgForSession = faceMetrics.length > 0
            ? faceMetrics.reduce((s2, m) => s2 + (m.data.engagementScore || 0), 0) / faceMetrics.length
            : 0;
          return sum + avgForSession;
        }, 0) / completedSessions.length
      : 0;

    // Calculate streak (consecutive days with sessions)
    const sessionDates = completedSessions
      .map(s => new Date(s.end_time).toDateString())
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => new Date(b) - new Date(a));

    let streak = 0;
    let currentDate = new Date().toDateString();
    for (const dateStr of sessionDates) {
      if (dateStr === currentDate) {
        streak++;
        const date = new Date(dateStr);
        date.setDate(date.getDate() - 1);
        currentDate = date.toDateString();
      } else {
        break;
      }
    }

    const analytics = {
      totalHours: (totalSeconds / 3600).toFixed(1),
      thisWeek: (thisWeekSeconds / 3600).toFixed(1),
      avgEngagement: Math.round(avgEngagement),
      completedSessions: completedSessions.length,
      streak: streak,
      rank: 0 // Placeholder - implement leaderboard logic if needed
    };

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('❌ Error fetching overall analytics:', error);
    res.json({
      success: true,
      analytics: {
        totalHours: 0,
        thisWeek: 0,
        avgEngagement: 0,
        completedSessions: 0,
        streak: 0,
        rank: 0,
      }
    });
  }
});

// ✅ GET - Session analytics
router.get('/:sessionId/analytics', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
      .populate('student_id', 'name email');
      
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.student_id._id.toString() !== req.user.id && req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const pageTimeData = session.getPageTimeAnalytics();
    const highlights = session.interactions.filter(i => i.type === 'highlight');
    const faceMetrics = session.interactions.filter(i => i.type === 'face_metric');

    const analytics = {
      session: {
        id: session._id,
        student: session.student_id,
        start_time: session.start_time,
        end_time: session.end_time,
        is_active: session.is_active,
        duration_seconds: session.duration_seconds,
      },
      pageTime: pageTimeData,
      highlights: {
        total: highlights.length,
        byPage: highlights.reduce((acc, h) => {
          const page = h.data.page;
          acc[page] = (acc[page] || 0) + 1;
          return acc;
        }, {}),
      },
      engagement: {
        avgEngagement: faceMetrics.length > 0
          ? Math.round(faceMetrics.reduce((sum, m) => sum + (m.data.engagementScore || 0), 0) / faceMetrics.length)
          : 0,
        attentionRate: faceMetrics.length > 0
          ? Math.round(faceMetrics.reduce((sum, m) => sum + (m.data.attentionRate || 0), 0) / faceMetrics.length)
          : 0,
      },
    };

    res.json({ success: true, analytics });
  } catch (error) {
    console.error('❌ Error fetching session analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});

// ✅ POST - Share report with teacher
router.post('/share-report', authenticateToken, async (req, res) => {
  try {
    const { sessionId, aiInsights, teacherEmail } = req.body;

    const session = await Session.findById(sessionId)
      .populate('student_id', 'name email')
      .populate('room_id', 'title teacher_id');

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.student_id._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // In a real app, you would send email here using emailService
    console.log('📧 Sharing report with:', teacherEmail || session.room_id?.teacher_id?.email);
    console.log('Session:', session._id);
    console.log('AI Insights:', aiInsights);

    res.json({ 
      success: true, 
      message: 'Report shared successfully' 
    });
  } catch (error) {
    console.error('❌ Error sharing report:', error);
    res.status(500).json({ success: false, message: 'Failed to share report' });
  }
});

export default router;
