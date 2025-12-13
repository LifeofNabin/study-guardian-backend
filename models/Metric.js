// ============================================
// FILE: models/Metric.js (ESM Version)
// ============================================

import mongoose from 'mongoose';

const metricSchema = new mongoose.Schema({
  // References
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  },

  // Presence Detection
  presence: {
    detected: { type: Boolean, default: false },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    face_count: { type: Number, default: 0, min: 0 }
  },

  // Facial Metrics
  facial: {
    eyes_open: { type: Boolean, default: true },
    blink_detected: { type: Boolean, default: false },
    blink_rate: { type: Number, default: 0, min: 0 },
    eye_aspect_ratio: { type: Number, min: 0, max: 1 },
    gaze_direction: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 }
    },
    looking_at_screen: { type: Boolean, default: true },
    head_pose: {
      yaw: { type: Number, default: 0 },
      pitch: { type: Number, default: 0 },
      roll: { type: Number, default: 0 }
    },
    emotion: {
      type: String,
      enum: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'confused', 'focused', 'bored', 'tired'],
      default: 'neutral'
    },
    emotion_confidence: { type: Number, min: 0, max: 1, default: 0 }
  },

  // Posture Analysis
  posture: {
    score: { type: Number, min: 0, max: 100, default: 0 },
    detected: { type: Boolean, default: false },
    shoulders_visible: { type: Boolean, default: false },
    spine_angle: { type: Number, default: 0 },
    quality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor', 'very_poor'],
      default: 'good'
    },
    distance_score: { type: Number, min: 0, max: 100, default: 50 },
    too_close: { type: Boolean, default: false },
    too_far: { type: Boolean, default: false },
    slouching: { type: Boolean, default: false },
    slouch_severity: { type: Number, min: 0, max: 100, default: 0 }
  },

  // Distraction Detection
  distraction: {
    detected: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['phone', 'looking_away', 'multiple_people', 'absence', 'other', 'none'],
      default: 'none'
    },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    duration: { type: Number, default: 0 },
    phone_detected: { type: Boolean, default: false },
    multiple_faces: { type: Boolean, default: false },
    attention_score: { type: Number, min: 0, max: 100, default: 100 }
  },

  // Health Metrics
  health: {
    eye_strain_risk: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    blink_rate_health: {
      type: String,
      enum: ['healthy', 'low', 'very_low'],
      default: 'healthy'
    },
    fatigue_level: { type: Number, min: 0, max: 100, default: 0 },
    fatigue_indicators: [{
      type: String,
      enum: ['slow_blink', 'droopy_eyes', 'yawning', 'head_droop', 'reduced_movement']
    }],
    time_since_break: { type: Number, default: 0 },
    break_recommended: { type: Boolean, default: false }
  },

  // Environmental Factors
  environment: {
    lighting_quality: {
      type: String,
      enum: ['excellent', 'good', 'poor', 'very_poor'],
      default: 'good'
    },
    noise_level: { type: Number, min: 0, max: 100, default: 0 },
    noise_detected: { type: Boolean, default: false }
  },

  // Engagement Score
  engagement_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    required: true
  },

  engagement_components: {
    presence_score: { type: Number, default: 0 },
    attention_score: { type: Number, default: 0 },
    posture_score: { type: Number, default: 0 },
    emotion_score: { type: Number, default: 0 },
    health_score: { type: Number, default: 0 }
  },

  raw_data: {
    type: mongoose.Schema.Types.Mixed,
    select: false
  }
}, {
  timestamps: true
});

// Indexes
metricSchema.index({ session_id: 1, timestamp: 1 });
metricSchema.index({ user_id: 1, timestamp: -1 });
metricSchema.index({ session_id: 1, 'distraction.detected': 1 });
metricSchema.index({ session_id: 1, engagement_score: 1 });

// Virtual
metricSchema.virtual('time_bucket').get(function() {
  const minutes = Math.floor(this.timestamp.getMinutes() / 5) * 5;
  const bucket = new Date(this.timestamp);
  bucket.setMinutes(minutes, 0, 0);
  return bucket;
});

// Instance Methods
metricSchema.methods.isEngaged = function() {
  return this.engagement_score >= 60 &&
         this.presence.detected &&
         !this.distraction.detected;
};

metricSchema.methods.needsBreak = function() {
  return this.health.break_recommended ||
         this.health.eye_strain_risk === 'critical' ||
         this.health.fatigue_level > 70;
};

metricSchema.methods.getAlerts = function() {
  const alerts = [];
  if (!this.presence.detected) {
    alerts.push({ type: 'absence', severity: 'high', message: 'Student not detected' });
  }
  if (this.distraction.detected) {
    alerts.push({
      type: 'distraction',
      severity: 'medium',
      message: `Distraction detected: ${this.distraction.type}`
    });
  }
  if (['poor', 'very_poor'].includes(this.posture.quality)) {
    alerts.push({ type: 'posture', severity: 'low', message: 'Poor posture detected' });
  }
  if (['high', 'critical'].includes(this.health.eye_strain_risk)) {
    alerts.push({ type: 'health', severity: 'high', message: 'High eye strain risk detected' });
  }
  if (this.health.break_recommended) {
    alerts.push({ type: 'break', severity: 'medium', message: 'Break recommended' });
  }
  return alerts;
};

// Static Methods
metricSchema.statics.getSessionMetrics = function(sessionId) {
  return this.find({ session_id: sessionId })
    .sort({ timestamp: 1 })
    .select('-raw_data');
};

metricSchema.statics.getSessionSummary = async function(sessionId) {
  const metrics = await this.find({ session_id: sessionId });
  if (metrics.length === 0) return null;

  const summary = {
    total_datapoints: metrics.length,
    duration_minutes: (metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 60000,
    avg_engagement: metrics.reduce((s, m) => s + m.engagement_score, 0) / metrics.length,
    max_engagement: Math.max(...metrics.map(m => m.engagement_score)),
    min_engagement: Math.min(...metrics.map(m => m.engagement_score)),
    presence_rate: (metrics.filter(m => m.presence.detected).length / metrics.length) * 100,
    distraction_count: metrics.filter(m => m.distraction.detected).length,
    distraction_rate: (metrics.filter(m => m.distraction.detected).length / metrics.length) * 100,
    distraction_types: [...new Set(metrics.filter(m => m.distraction.detected).map(m => m.distraction.type))],
    avg_posture_score: metrics.reduce((s, m) => s + m.posture.score, 0) / metrics.length,
    poor_posture_count: metrics.filter(m => ['poor', 'very_poor'].includes(m.posture.quality)).length,
    avg_blink_rate: metrics.reduce((s, m) => s + m.facial.blink_rate, 0) / metrics.length,
    eye_strain_alerts: metrics.filter(m => ['high', 'critical'].includes(m.health.eye_strain_risk)).length,
    avg_fatigue: metrics.reduce((s, m) => s + m.health.fatigue_level, 0) / metrics.length,
    emotion_distribution: metrics.reduce((acc, m) => {
      acc[m.facial.emotion] = (acc[m.facial.emotion] || 0) + 1;
      return acc;
    }, {}),
    engagement_timeline: metrics.map(m => ({
      timestamp: m.timestamp,
      score: m.engagement_score
    }))
  };
  return summary;
};

metricSchema.statics.getRecentMetrics = function(sessionId, minutes = 5) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  return this.find({ session_id: sessionId, timestamp: { $gte: cutoff } })
    .sort({ timestamp: -1 });
};

metricSchema.statics.getEngagementTrend = async function(sessionId, intervalMinutes = 5) {
  return this.aggregate([
    { $match: { session_id: new mongoose.Types.ObjectId(sessionId) } },
    {
      $group: {
        _id: {
          $subtract: [
            { $toLong: '$timestamp' },
            { $mod: [{ $toLong: '$timestamp' }, intervalMinutes * 60 * 1000] }
          ]
        },
        avg_engagement: { $avg: '$engagement_score' },
        avg_attention: { $avg: '$distraction.attention_score' },
        distraction_count: { $sum: { $cond: ['$distraction.detected', 1, 0] } },
        datapoints: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
};

metricSchema.statics.detectAnomalies = async function(sessionId) {
  const metrics = await this.find({ session_id: sessionId });
  const anomalies = [];

  // Sudden engagement drops
  for (let i = 1; i < metrics.length; i++) {
    const drop = metrics[i - 1].engagement_score - metrics[i].engagement_score;
    if (drop > 30) {
      anomalies.push({
        type: 'engagement_drop',
        timestamp: metrics[i].timestamp,
        severity: drop > 50 ? 'high' : 'medium',
        details: `Engagement dropped by ${drop.toFixed(1)} points`
      });
    }
  }

  // Prolonged absence
  let absenceStreak = 0;
  for (const metric of metrics) {
    if (!metric.presence.detected) {
      absenceStreak++;
      if (absenceStreak === 5) {
        anomalies.push({
          type: 'prolonged_absence',
          timestamp: metric.timestamp,
          severity: 'high',
          details: 'Student absent for extended period'
        });
      }
    } else {
      absenceStreak = 0;
    }
  }

  return anomalies;
};

// Pre-save middleware
metricSchema.pre('save', function(next) {
  this.engagement_score = Math.max(0, Math.min(100, this.engagement_score));

  if (this.health.time_since_break > 25 ||
      this.health.eye_strain_risk === 'critical' ||
      this.health.fatigue_level > 75) {
    this.health.break_recommended = true;
  }

  next();
});

const Metric = mongoose.model('Metric', metricSchema);
export default Metric;
