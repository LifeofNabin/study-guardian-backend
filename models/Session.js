// FILE 1: backend/models/Session.js - FIXED ENUM AND ADDED MISSING TYPES
// ============================================================================

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const interactionSchema = new mongoose.Schema({
  type: {
    type: String,
    // ✅ FIXED: Added ALL missing interaction types to prevent validation errors
    enum: [
      'highlight',
      'scroll', 
      'zoom',
      'page_change',  // ✅ ADDED - Was causing validation error
      'page_turn',
      'webcam',
      'face_metric',  // ✅ ADDED - For WebcamMonitor
      'break_start',
      'break_end',
      'click',        // ✅ ADDED - For general interactions
      'hover',
      'input',
      'focus',
      'blur',
      'navigation'
    ],
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  data: mongoose.Schema.Types.Mixed,
});

const sessionSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4,
  },
  room_id: {
    type: String,
    ref: 'Room',
  },
  document_id: { 
    type: String, 
    required: [true, 'Document ID is required'],
  },
  student_id: {
    type: String,
    ref: 'User',
    required: [true, 'Student ID is required'],
  },
  document_path: { 
    type: String,
    required: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  start_time: {
    type: Date,
    default: Date.now,
  },
  end_time: {
    type: Date,
  },
  duration_seconds: {
    type: Number,
    default: 0,
  },
  interactions: [interactionSchema],
  metrics: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ai_summary: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  _id: false,
  timestamps: true,
});

sessionSchema.methods.addInteraction = function(type, data) {
  this.interactions.push({
    type,
    data,
    timestamp: data.timestamp || new Date(),
  });
};

sessionSchema.methods.getPageTimeAnalytics = function() {
  const pageTime = {};
  const pageTurnEvents = this.interactions.filter(i => i.type === 'page_turn' || i.type === 'page_change');

  pageTurnEvents.forEach(change => {
    const page = change.data.from || change.data.page;
    const time = change.data.time_spent || change.data.duration || 0;
    if (page) {
      pageTime[page] = (pageTime[page] || 0) + time;
    }
  });

  return pageTime;
};

const Session = mongoose.model('Session', sessionSchema);
export default Session;