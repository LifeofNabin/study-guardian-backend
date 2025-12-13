import express from 'express';
import mongoose from 'mongoose';
import Metric from '../models/Metric.js';
import Session from '../models/Session.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/metrics
 * @desc    Save a single metric datapoint
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      timestamp,
      presence,
      facial,
      posture,
      distraction,
      health,
      environment,
      engagement_score,
      engagement_components,
      raw_data
    } = req.body;

    // Validation
    if (!session_id || engagement_score === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: session_id, engagement_score'
      });
    }

    // Verify session belongs to user
    const session = await Session.findOne({
      _id: session_id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized'
      });
    }

    // Create metric
    const metric = await Metric.create({
      user_id: req.user._id,
      session_id,
      timestamp: timestamp || new Date(),
      presence: presence || { detected: false, confidence: 0, face_count: 0 },
      facial: facial || {},
      posture: posture || { score: 0, detected: false },
      distraction: distraction || { detected: false, type: 'none' },
      health: health || {},
      environment: environment || {},
      engagement_score,
      engagement_components: engagement_components || {},
      raw_data: raw_data || undefined
    });

    res.status(201).json({
      success: true,
      message: 'Metric saved successfully',
      data: metric
    });

  } catch (error) {
    console.error('Error saving metric:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save metric',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/metrics/batch
 * @desc    Save multiple metrics at once (bulk insert)
 * @access  Private
 */
router.post('/batch', async (req, res) => {
  try {
    const { metrics } = req.body;

    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid metrics array'
      });
    }

    // Add user_id to each metric
    const metricsWithUser = metrics.map(m => ({
      ...m,
      user_id: req.user._id,
      timestamp: m.timestamp || new Date()
    }));

    // Batch insert
    const createdMetrics = await Metric.insertMany(metricsWithUser, { 
      ordered: false // Continue even if some fail
    });

    res.status(201).json({
      success: true,
      message: `${createdMetrics.length} metrics saved successfully`,
      count: createdMetrics.length
    });

  } catch (error) {
    console.error('Error saving batch metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId
 * @desc    Get all metrics for a session
 * @access  Private
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { startTime, endTime, limit, includeRaw = 'false' } = req.query;

    // Verify session belongs to user
    const session = await Session.findOne({
      _id: sessionId,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized'
      });
    }

    // Build query
    const query = { session_id: sessionId };
    
    if (startTime || endTime) {
      query.timestamp = {};
      if (startTime) query.timestamp.$gte = new Date(startTime);
      if (endTime) query.timestamp.$lte = new Date(endTime);
    }

    // Get metrics
    let metricsQuery = Metric.find(query).sort({ timestamp: 1 });

    // Exclude raw_data unless explicitly requested
    if (includeRaw !== 'true') {
      metricsQuery = metricsQuery.select('-raw_data');
    }

    if (limit) {
      metricsQuery = metricsQuery.limit(parseInt(limit));
    }

    const metrics = await metricsQuery;

    res.json({
      success: true,
      count: metrics.length,
      data: metrics
    });

  } catch (error) {
    console.error('Error fetching session metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/summary
 * @desc    Get comprehensive session summary with analytics
 * @access  Private
 */
router.get('/session/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify session belongs to user
    const session = await Session.findOne({
      _id: sessionId,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized'
      });
    }

    // Get summary
    const summary = await Metric.getSessionSummary(sessionId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'No metrics found for this session'
      });
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching session summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session summary',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/recent
 * @desc    Get recent metrics (last N minutes)
 * @access  Private
 */
router.get('/session/:sessionId/recent', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { minutes = 5 } = req.query;

    const metrics = await Metric.getRecentMetrics(sessionId, parseInt(minutes));

    res.json({
      success: true,
      count: metrics.length,
      minutes: parseInt(minutes),
      data: metrics
    });

  } catch (error) {
    console.error('Error fetching recent metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/trend
 * @desc    Get engagement trend over time
 * @access  Private
 */
router.get('/session/:sessionId/trend', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { interval = 5 } = req.query; // minutes

    const trend = await Metric.getEngagementTrend(sessionId, parseInt(interval));

    // Format timestamps
    const formattedTrend = trend.map(t => ({
      timestamp: new Date(t._id),
      avg_engagement: Math.round(t.avg_engagement * 10) / 10,
      avg_attention: Math.round(t.avg_attention * 10) / 10,
      distraction_count: t.distraction_count,
      datapoints: t.datapoints
    }));

    res.json({
      success: true,
      interval: parseInt(interval),
      count: formattedTrend.length,
      data: formattedTrend
    });

  } catch (error) {
    console.error('Error fetching engagement trend:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trend',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/anomalies
 * @desc    Detect anomalies in session metrics
 * @access  Private
 */
router.get('/session/:sessionId/anomalies', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const anomalies = await Metric.detectAnomalies(sessionId);

    res.json({
      success: true,
      count: anomalies.length,
      data: anomalies
    });

  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect anomalies',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/alerts
 * @desc    Get current alerts based on latest metrics
 * @access  Private
 */
router.get('/session/:sessionId/alerts', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get most recent metric
    const latestMetric = await Metric.findOne({ session_id: sessionId })
      .sort({ timestamp: -1 });

    if (!latestMetric) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    const alerts = latestMetric.getAlerts();

    res.json({
      success: true,
      count: alerts.length,
      timestamp: latestMetric.timestamp,
      data: alerts
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alerts',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/session/:sessionId/engagement-timeline
 * @desc    Get detailed engagement timeline with events
 * @access  Private
 */
router.get('/session/:sessionId/engagement-timeline', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const metrics = await Metric.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .select('timestamp engagement_score presence.detected distraction.detected posture.score facial.emotion');

    // Build timeline with events
    const timeline = metrics.map((m, index) => {
      const events = [];
      
      if (!m.presence.detected) events.push('absence');
      if (m.distraction.detected) events.push('distraction');
      if (m.posture.score < 50) events.push('poor_posture');
      
      // Detect engagement changes
      if (index > 0) {
        const prevScore = metrics[index - 1].engagement_score;
        const diff = m.engagement_score - prevScore;
        if (diff > 20) events.push('engagement_spike');
        if (diff < -20) events.push('engagement_drop');
      }

      return {
        timestamp: m.timestamp,
        engagement_score: m.engagement_score,
        emotion: m.facial.emotion,
        events
      };
    });

    res.json({
      success: true,
      count: timeline.length,
      data: timeline
    });

  } catch (error) {
    console.error('Error fetching engagement timeline:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch timeline',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/aggregate/user
 * @desc    Get aggregated metrics across all user sessions
 * @access  Private
 */
router.get('/aggregate/user', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build match query
    const matchQuery = { user_id: req.user._id };
    if (startDate || endDate) {
      matchQuery.timestamp = {};
      if (startDate) matchQuery.timestamp.$gte = new Date(startDate);
      if (endDate) matchQuery.timestamp.$lte = new Date(endDate);
    }

    // Aggregate metrics
    const aggregate = await Metric.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total_datapoints: { $sum: 1 },
          avg_engagement: { $avg: '$engagement_score' },
          max_engagement: { $max: '$engagement_score' },
          min_engagement: { $min: '$engagement_score' },
          avg_posture: { $avg: '$posture.score' },
          avg_blink_rate: { $avg: '$facial.blink_rate' },
          total_distractions: {
            $sum: { $cond: ['$distraction.detected', 1, 0] }
          },
          presence_count: {
            $sum: { $cond: ['$presence.detected', 1, 0] }
          }
        }
      }
    ]);

    if (aggregate.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No data available for the selected period'
      });
    }

    const data = aggregate[0];
    delete data._id;

    // Calculate additional metrics
    data.presence_rate = (data.presence_count / data.total_datapoints) * 100;
    data.distraction_rate = (data.total_distractions / data.total_datapoints) * 100;

    // Get emotion distribution
    const emotionDist = await Metric.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$facial.emotion',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    data.emotion_distribution = emotionDist;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error fetching user aggregate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch aggregate data',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/aggregate/daily
 * @desc    Get daily aggregated metrics for the user
 * @access  Private
 */
router.get('/aggregate/daily', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const dailyStats = await Metric.aggregate([
      {
        $match: {
          user_id: mongoose.Types.ObjectId(req.user._id),
          timestamp: { $gte: cutoffDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          avg_engagement: { $avg: '$engagement_score' },
          avg_posture: { $avg: '$posture.score' },
          avg_blink_rate: { $avg: '$facial.blink_rate' },
          total_distractions: {
            $sum: { $cond: ['$distraction.detected', 1, 0] }
          },
          datapoints: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Format dates
    const formattedStats = dailyStats.map(stat => ({
      date: new Date(stat._id.year, stat._id.month - 1, stat._id.day),
      avg_engagement: Math.round(stat.avg_engagement * 10) / 10,
      avg_posture: Math.round(stat.avg_posture * 10) / 10,
      avg_blink_rate: Math.round(stat.avg_blink_rate * 10) / 10,
      total_distractions: stat.total_distractions,
      datapoints: stat.datapoints
    }));

    res.json({
      success: true,
      days: parseInt(days),
      count: formattedStats.length,
      data: formattedStats
    });

  } catch (error) {
    console.error('Error fetching daily aggregate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily data',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/health/:sessionId
 * @desc    Get health-related metrics for a session
 * @access  Private
 */
router.get('/health/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const healthMetrics = await Metric.find({ session_id: sessionId })
      .sort({ timestamp: 1 })
      .select('timestamp health facial.blink_rate posture.score');

    // Calculate health insights
    const blinkRates = healthMetrics.map(m => m.facial.blink_rate).filter(b => b > 0);
    const avgBlinkRate = blinkRates.reduce((a, b) => a + b, 0) / blinkRates.length || 0;
    
    const eyeStrainAlerts = healthMetrics.filter(m => 
      m.health.eye_strain_risk === 'high' || m.health.eye_strain_risk === 'critical'
    ).length;

    const postureIssues = healthMetrics.filter(m => m.posture.score < 50).length;

    const fatigueData = healthMetrics.map(m => ({
      timestamp: m.timestamp,
      fatigue_level: m.health.fatigue_level
    }));

    res.json({
      success: true,
      data: {
        avg_blink_rate: Math.round(avgBlinkRate * 10) / 10,
        eye_strain_alerts: eyeStrainAlerts,
        posture_issues: postureIssues,
        fatigue_timeline: fatigueData,
        health_score: Math.max(0, 100 - eyeStrainAlerts * 5 - postureIssues * 2)
      }
    });

  } catch (error) {
    console.error('Error fetching health metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health metrics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/distractions/:sessionId
 * @desc    Get distraction analysis for a session
 * @access  Private
 */
router.get('/distractions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const metrics = await Metric.find({ session_id: sessionId })
      .sort({ timestamp: 1 });

    // Analyze distractions
    const distractions = metrics.filter(m => m.distraction.detected);
    
    const distractionsByType = distractions.reduce((acc, m) => {
      acc[m.distraction.type] = (acc[m.distraction.type] || 0) + 1;
      return acc;
    }, {});

    // Find distraction episodes (continuous periods)
    const episodes = [];
    let currentEpisode = null;

    metrics.forEach((m, index) => {
      if (m.distraction.detected) {
        if (!currentEpisode) {
          currentEpisode = {
            start: m.timestamp,
            end: m.timestamp,
            type: m.distraction.type,
            count: 1
          };
        } else {
          currentEpisode.end = m.timestamp;
          currentEpisode.count++;
        }
      } else if (currentEpisode) {
        episodes.push(currentEpisode);
        currentEpisode = null;
      }
    });

    // Add last episode if exists
    if (currentEpisode) {
      episodes.push(currentEpisode);
    }

    // Calculate durations
    episodes.forEach(ep => {
      ep.duration_seconds = (ep.end - ep.start) / 1000;
    });

    const totalDistractionTime = episodes.reduce((sum, ep) => sum + ep.duration_seconds, 0);

    res.json({
      success: true,
      data: {
        total_distractions: distractions.length,
        distraction_rate: (distractions.length / metrics.length) * 100,
        by_type: distractionsByType,
        episodes: episodes.length,
        total_distraction_time: Math.round(totalDistractionTime),
        avg_episode_duration: episodes.length ? totalDistractionTime / episodes.length : 0,
        longest_episode: episodes.length ? Math.max(...episodes.map(e => e.duration_seconds)) : 0,
        distraction_timeline: episodes
      }
    });

  } catch (error) {
    console.error('Error fetching distraction analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch distraction analysis',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/metrics/comparison/:sessionId
 * @desc    Compare session metrics with user's historical average
 * @access  Private
 */
router.get('/comparison/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get current session summary
    const currentSession = await Metric.getSessionSummary(sessionId);

    if (!currentSession) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Get user's historical average (excluding current session)
    const historicalAvg = await Metric.aggregate([
      {
        $match: {
          user_id: mongoose.Types.ObjectId(req.user._id),
          session_id: { $ne: mongoose.Types.ObjectId(sessionId) }
        }
      },
      {
        $group: {
          _id: null,
          avg_engagement: { $avg: '$engagement_score' },
          avg_posture: { $avg: '$posture.score' },
          avg_blink_rate: { $avg: '$facial.blink_rate' },
          distraction_rate: {
            $avg: { $cond: ['$distraction.detected', 1, 0] }
          }
        }
      }
    ]);

    const comparison = {
      current: {
        avg_engagement: currentSession.avg_engagement,
        avg_posture: currentSession.avg_posture_score,
        avg_blink_rate: currentSession.avg_blink_rate,
        distraction_rate: currentSession.distraction_rate
      },
      historical: historicalAvg[0] || null,
      differences: {}
    };

    if (historicalAvg[0]) {
      const hist = historicalAvg[0];
      comparison.differences = {
        engagement: currentSession.avg_engagement - hist.avg_engagement,
        posture: currentSession.avg_posture_score - hist.avg_posture,
        blink_rate: currentSession.avg_blink_rate - hist.avg_blink_rate,
        distraction_rate: currentSession.distraction_rate - (hist.distraction_rate * 100)
      };
    }

    res.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('Error fetching comparison:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comparison data',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/metrics/session/:sessionId
 * @desc    Delete all metrics for a session
 * @access  Private
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await Metric.deleteMany({
      session_id: sessionId,
      user_id: req.user._id
    });

    res.json({
      success: true,
      message: `${result.deletedCount} metrics deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete metrics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/metrics/export/:sessionId
 * @desc    Export session metrics
 * @access  Private
 */
router.post('/export/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format = 'json' } = req.body;

    const metrics = await Metric.find({ 
      session_id: sessionId,
      user_id: req.user._id
    })
      .sort({ timestamp: 1 })
      .select('-raw_data')
      .lean();

    if (metrics.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No metrics found'
      });
    }

    let exportData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case 'json':
        exportData = JSON.stringify(metrics, null, 2);
        contentType = 'application/json';
        filename = `metrics_${sessionId}_${Date.now()}.json`;
        break;

      case 'csv':
        const csvHeader = 'Timestamp,Engagement,Presence,Posture,BlinkRate,Emotion,Distraction,EyeStrain\n';
        const csvRows = metrics.map(m =>
          `"${m.timestamp}",${m.engagement_score},${m.presence.detected},${m.posture.score},${m.facial.blink_rate},"${m.facial.emotion}",${m.distraction.detected},"${m.health.eye_strain_risk}"`
        ).join('\n');
        exportData = csvHeader + csvRows;
        contentType = 'text/csv';
        filename = `metrics_${sessionId}_${Date.now()}.csv`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid format. Supported: json, csv'
        });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export metrics',
      error: error.message
    });
  }
});

export default router;
