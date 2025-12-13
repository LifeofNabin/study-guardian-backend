// FILE PATH: backend/models/Routine.js
// ✅ UPDATED: Added pdf_path and has_pdf to the subjectSchema

import mongoose from 'mongoose';

// -----------------------------------------------------------
// SUB-SCHEMA: Subject tracking within a routine
// -----------------------------------------------------------
const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  target_hours: {
    type: Number,
    required: true,
    min: 0,
  },
  actual_hours: {
    type: Number,
    default: 0,
    min: 0,
  },
  last_studied: {
    type: Date,
  },
  // ✅ NEW: Fields to track the PDF for each subject
  pdf_path: {
    type: String,
    default: null,
  },
  has_pdf: {
    type: Boolean,
    default: false,
  },
  pdf_name: { 
    type: String,
    default: null
  },
}, { _id: true }); // Use _id for easier lookups if needed

// -----------------------------------------------------------
// SUB-SCHEMA: Daily schedule times
// -----------------------------------------------------------
const timeSlotSchema = new mongoose.Schema({
  start: {
    type: String, // Format: "HH:MM" (e.g., "09:00")
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: 'Time must be in HH:MM format (24-hour)',
    },
  },
  end: {
    type: String, // Format: "HH:MM"
    required: true,
    validate: {
      validator: function(v) {
        return /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
      },
      message: 'Time must be in HH:MM format (24-hour)',
    },
  },
}, { _id: false });

// -----------------------------------------------------------
// MAIN SCHEMA: Routine
// -----------------------------------------------------------
const routineSchema = new mongoose.Schema({
  // Owner
  student_id: {
    type: String,
    ref: 'User',
    required: [true, 'Student ID is required'],
    index: true,
  },

  // Basic Info
  title: {
    type: String,
    required: [true, 'Routine title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  
  // ✅ NEW: Overall duration in minutes for flexible display
  totalDuration: {
    type: Number, 
    default: 0
  },

  // Type and Duration
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    default: 'daily',
  },
  start_date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  end_date: {
    type: Date,
    required: true,
    validate: {
      validator: function(value) {
        return value >= this.start_date;
      },
      message: 'End date must be on or after start date',
    },
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'completed', 'paused', 'cancelled'],
    default: 'active',
  },
  is_active: {
    type: Boolean,
    default: true,
  },

  // Subjects and Goals
  subjects: [subjectSchema],

  // Schedule
  times: timeSlotSchema,
  
  // Days of week (for weekly routines)
  days_of_week: {
    type: [String],
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },

  // PDF/Document for the entire routine (legacy/optional)
  pdf_path: {
    type: String,
  },
  pdf_name: {
    type: String,
  },
  has_pdf: {
    type: Boolean,
    default: false,
  },

  // Progress tracking
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  total_sessions: {
    type: Number,
    default: 0,
  },
  completed_sessions: {
    type: Number,
    default: 0,
  },
  total_study_hours: {
    type: Number,
    default: 0,
  },

  // Reminders and notifications
  reminder_enabled: {
    type: Boolean,
    default: true,
  },
  reminder_time: {
    type: String, // Format: "HH:MM"
  },

  // Notes
  notes: {
    type: String,
    maxlength: 1000,
  },

  // Metadata
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// INDEXES
routineSchema.index({ student_id: 1, status: 1 });
routineSchema.index({ student_id: 1, start_date: 1 });

// INSTANCE METHODS

routineSchema.methods.calculateProgress = function() {
  if (this.subjects.length === 0) return 0;
  const totalTarget = this.subjects.reduce((sum, s) => sum + (s.target_hours || 0), 0);
  const totalActual = this.subjects.reduce((sum, s) => sum + (s.actual_hours || 0), 0);
  if (totalTarget === 0) return 0;
  this.progress = Math.min(Math.round((totalActual / totalTarget) * 100), 100);
  return this.progress;
};

routineSchema.methods.updateSubjectHours = function(subjectName, hoursToAdd) {
  const subject = this.subjects.find(s => s.name === subjectName);
  if (subject) {
    subject.actual_hours += hoursToAdd;
    subject.last_studied = new Date();
    this.total_study_hours += hoursToAdd;
    this.calculateProgress();
  }
};

routineSchema.methods.addSubject = function(name, targetHours) {
  if (this.subjects.find(s => s.name === name)) {
    throw new Error('Subject already exists');
  }
  this.subjects.push({ name, target_hours: targetHours, actual_hours: 0 });
};

routineSchema.methods.removeSubject = function(subjectName) {
  this.subjects = this.subjects.filter(s => s.name !== subjectName);
  this.calculateProgress();
};

routineSchema.methods.isExpired = function() {
  return new Date() > this.end_date;
};

routineSchema.methods.complete = function() {
  this.status = 'completed';
  this.is_active = false;
  this.calculateProgress();
};

routineSchema.methods.getSummary = function() {
  return {
    title: this.title, status: this.status, progress: this.progress,
    total_study_hours: this.total_study_hours,
    subjects: this.subjects.map(s => ({
      name: s.name, target_hours: s.target_hours, actual_hours: s.actual_hours,
    })),
  };
};

// STATIC METHODS

routineSchema.statics.getActiveRoutines = function(studentId) {
  return this.find({ student_id: studentId, status: 'active', is_active: true, end_date: { $gte: new Date() } });
};

routineSchema.statics.getTodayRoutines = function(studentId) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' });
  return this.find({ student_id: studentId, status: 'active', days_of_week: today, end_date: { $gte: new Date() } });
};

// MIDDLEWARE (Hooks)

routineSchema.pre('save', function(next) {
  this.updated_at = new Date();
  this.calculateProgress();
  if (this.isModified('subjects')) {
    this.totalDuration = this.subjects.reduce((sum, s) => sum + (s.duration || 0), 0);
  }
  if (this.isExpired() && this.status === 'active') {
    this.complete();
  }
  next();
});

const Routine = mongoose.model('Routine', routineSchema);

export default Routine;