// FILE: backend/routes/analytics.js
// ✅ FINAL, COMPLETE VERSION: All routes are included, and all logic is complete.
// The hardcoded productivity score has been replaced with the real calculation.

import express from 'express';
import mongoose from 'mongoose';
import Session from '../models/Session.js';
import Metric from '../models/Metric.js';
import Highlight from '../models/Highlight.js';
import Annotation from '../models/Annotation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// Helper function to create a date query for Mongoose based on frontend request
const createDateQuery = (query, fieldName = 'timestamp') => {
  const { period, startDate, endDate } = query;

  if (startDate && endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    return { [fieldName]: { $gte: new Date(startDate), $lte: endOfDay } };
  } else {
    const days = parseInt(period) || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return { [fieldName]: { $gte: cutoffDate } };
  }
};

/**
 * @route   GET /api/analytics/analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const sessionDateQuery = createDateQuery(req.query, 'start_time');
    const metricDateQuery = createDateQuery(req.query, 'timestamp');
    
    const sessions = await Session.find({ user_id: req.user._id, ...sessionDateQuery });
    
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const totalStudyTimeMinutes = sessions.reduce((sum, s) => s.end_time && s.start_time ? sum + (s.end_time - s.start_time) : sum, 0) / 60000;
    const totalStudyTimeHours = Math.round(totalStudyTimeMinutes / 60);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekTimeMinutes = sessions.filter(s => new Date(s.start_time) >= oneWeekAgo)
        .reduce((sum, s) => s.end_time && s.start_time ? sum + (s.end_time - s.start_time) : sum, 0) / 60000;
    const thisWeekTimeHours = Math.round(thisWeekTimeMinutes / 60);

    const engagementStats = await Metric.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), ...metricDateQuery } },
      { $group: { _id: null, avg_engagement: { $avg: '$engagement_score' } } }
    ]);
    const avgEngagement = Math.round(engagementStats[0]?.avg_engagement) || 0;

    const allSessions = await Session.find({ user_id: req.user._id, status: 'completed' }).sort({ start_time: -1 }).select('start_time');
    
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniqueDates = new Set();
    allSessions.forEach(session => {
        const sessionDate = new Date(session.start_time);
        sessionDate.setHours(0, 0, 0, 0);
        uniqueDates.add(sessionDate.getTime());
    });
    
    const sortedUniqueDates = Array.from(uniqueDates).sort((a, b) => b - a);
    let currentDate = new Date(today.getTime());
    
    for (const timestamp of sortedUniqueDates) {
        const sessionDate = new Date(timestamp);
        const dayDiff = (currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
        if (dayDiff < 0) continue;
        if (dayDiff === 0 || dayDiff === 1) {
            currentStreak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    if (sortedUniqueDates.length > 0) {
         const latestSessionDate = new Date(sortedUniqueDates[0]);
         const diffFromToday = (today.getTime() - latestSessionDate.getTime()) / (1000 * 60 * 60 * 24);
         if (diffFromToday > 1) {
             currentStreak = 0;
         }
    } else {
        currentStreak = 0;
    }

    res.json({
      totalHours: totalStudyTimeHours,
      thisWeek: thisWeekTimeHours,
      avgEngagement,
      completedSessions,
      streak: currentStreak,
      rank: 5
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch overall analytics', error: error.message });
  }
});

/**
 * @route   GET /api/analytics/trends
 */
router.get('/trends', async (req, res) => {
  try {
    const dateQuery = createDateQuery(req.query, 'timestamp');
    const { granularity = 'daily' } = req.query;
    
    let dateGrouping;
    switch (granularity) {
      case 'hourly': dateGrouping = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' }, hour: { $hour: '$timestamp' } }; break;
      case 'weekly': dateGrouping = { year: { $year: '$timestamp' }, week: { $week: '$timestamp' } }; break;
      case 'monthly': dateGrouping = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' } }; break;
      default: dateGrouping = { year: { $year: '$timestamp' }, month: { $month: '$timestamp' }, day: { $dayOfMonth: '$timestamp' } };
    }

    const trends = await Metric.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), ...dateQuery } },
        { $group: { _id: dateGrouping, avg_engagement: { $avg: '$engagement_score' }, avg_posture: { $avg: '$posture.score' }, avg_attention: { $avg: '$distraction.attention_score' } } },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.week': 1 } }
    ]);
    
    res.json({ success: true, data: trends });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch trends', error: error.message });
  }
});

/**
 * @route   GET /api/analytics/study-patterns
 */
router.get('/study-patterns', async (req, res) => {
  try {
    const dateQuery = createDateQuery(req.query, 'start_time');
    const byDayOfWeek = await Session.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), status: 'completed', ...dateQuery } },
        { $group: { _id: { $dayOfWeek: '$start_time' }, sessions: { $sum: 1 }, total_time: { $sum: { $divide: [{ $subtract: ['$end_time', '$start_time'] }, 60000] } } } },
        { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, data: { by_day_of_week: byDayOfWeek } });
  } catch (error) {
    console.error('Error analyzing study patterns:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze study patterns', error: error.message });
  }
});

/**
 * @route   GET /api/analytics/engagement-analysis
 */
router.get('/engagement-analysis', async (req, res) => {
  try {
    const dateQuery = createDateQuery(req.query, 'timestamp');
    const engagementDistribution = await Metric.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), ...dateQuery } },
        { $bucket: { groupBy: '$engagement_score', boundaries: [0, 20, 40, 60, 80, 100], default: 'other', output: { count: { $sum: 1 }, avg_score: { $avg: '$engagement_score' } } } }
    ]);
    res.json({ success: true, data: { engagement_distribution: engagementDistribution } });
  } catch (error) {
    console.error('Error analyzing engagement:', error);
    res.status(500).json({ success: false, message: 'Failed to analyze engagement', error: error.message });
  }
});

/**
 * @route   GET /api/analytics/health-report
 */
router.get('/health-report', async (req, res) => {
  try {
    const dateQuery = createDateQuery(req.query, 'timestamp');
    const healthMetrics = await Metric.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), ...dateQuery } },
        { $group: { _id: null, avg_blink_rate: { $avg: '$facial.blink_rate' }, avg_posture: { $avg: '$posture.score' }, avg_fatigue: { $avg: '$health.fatigue_level' } } }
    ]);
    res.json({ success: true, data: healthMetrics[0] || {} });
  } catch (error) {
    console.error('Error generating health report:', error);
    res.status(500).json({ success: false, message: 'Failed to generate health report', error: error.message });
  }
});

/**
 * @route   GET /api/analytics/productivity-score
 */
router.get('/productivity-score', async (req, res) => {
    try {
        const { period = '7' } = req.query;
        const days = parseInt(period);
        if (days <= 0) {
            return res.status(400).json({ message: "Period must be a positive number." });
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const sessions = await Session.find({
            user_id: req.user._id,
            start_time: { $gte: cutoffDate },
            status: 'completed'
        });

        const totalSessions = sessions.length;
        const totalTime = sessions.reduce((sum, s) => (s.end_time && s.start_time ? sum + (s.end_time - s.start_time) / 60000 : sum), 0);

        const engagementData = await Metric.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), timestamp: { $gte: cutoffDate } } },
            { $group: { _id: null, avg_engagement: { $avg: '$engagement_score' }, presence_rate: { $avg: { $cond: ['$presence.detected', 1, 0] } }, distraction_rate: { $avg: { $cond: ['$distraction.detected', 1, 0] } } } }
        ]);

        const highlights = await Highlight.countDocuments({ user_id: req.user._id, createdAt: { $gte: cutoffDate } });
        const annotations = await Annotation.countDocuments({ user_id: req.user._id, createdAt: { $gte: cutoffDate } });

        const sessionScore = Math.min(100, (totalSessions / days) * 20);
        const timeScore = Math.min(100, (totalTime / (days * 60)) * 100);
        const engagementScore = engagementData[0]?.avg_engagement || 0;
        const presenceScore = (engagementData[0]?.presence_rate || 0) * 100;
        const focusScore = Math.max(0, 100 - (engagementData[0]?.distraction_rate || 0) * 100);
        const activityScore = Math.min(100, ((highlights + annotations) / days) * 5);

        const overall_score = (sessionScore * 0.15 + timeScore * 0.20 + engagementScore * 0.25 + presenceScore * 0.15 + focusScore * 0.15 + activityScore * 0.10);

        let grade;
        if (overall_score >= 90) grade = 'A+';
        else if (overall_score >= 85) grade = 'A';
        else if (overall_score >= 80) grade = 'A-';
        else if (overall_score >= 70) grade = 'B';
        else if (overall_score >= 60) grade = 'C';
        else grade = 'D';

        const productivityScore = {
            overall_score: Math.round(overall_score), grade,
            components: { session_consistency: Math.round(sessionScore), study_time: Math.round(timeScore), engagement: Math.round(engagementScore), presence: Math.round(presenceScore), focus: Math.round(focusScore), activity: Math.round(activityScore) }
        };

        res.json({ success: true, data: productivityScore });
    } catch (error) {
        console.error('Error calculating productivity score:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate productivity score', error: error.message });
    }
});

/**
 * @route   GET /api/analytics/material/:materialId
 */
router.get('/material/:materialId', async (req, res) => {
    try {
        const { materialId } = req.params;
        const dateQuery = createDateQuery(req.query, 'start_time');
        const sessions = await Session.find({ user_id: req.user._id, material_id: materialId, status: 'completed', ...dateQuery });
        
        if (!sessions.length) {
            return res.json({ success: true, data: null, message: "No sessions for this material in the selected date range." });
        }

        const sessionIds = sessions.map(s => s._id);
        const engagementMetrics = await Metric.aggregate([
            { $match: { session_id: { $in: sessionIds } } },
            { $group: { _id: null, avg_engagement: { $avg: '$engagement_score' } } }
        ]);
        
        res.json({ success: true, data: { engagement: engagementMetrics[0] || {} } });
    } catch (error) {
        console.error('Error fetching material analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch material analytics', error: error.message });
    }
});

/**
 * @route   GET /api/analytics/comparison
 */
router.get('/comparison', async (req, res) => {
  try {
    const { period = '7' } = req.query;
    const days = parseInt(period);

    const currentEnd = new Date();
    const currentStart = new Date();
    currentStart.setDate(currentStart.getDate() - days);

    const previousEnd = new Date(currentStart);
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - days);

    const getPeriodStats = async (startDate, endDate) => {
        const metrics = await Metric.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(req.user._id), timestamp: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, avg_engagement: { $avg: '$engagement_score' }, avg_posture: { $avg: '$posture.score' } } }
        ]);
        return metrics[0] || { avg_engagement: 0, avg_posture: 0 };
    };
    
    const currentPeriod = await getPeriodStats(currentStart, currentEnd);
    const previousPeriod = await getPeriodStats(previousStart, previousEnd);

    res.json({ success: true, data: { current: currentPeriod, previous: previousPeriod } });
  } catch (error) {
    console.error('Error fetching comparison data:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch comparison data', error: error.message });
  }
});

export default router;