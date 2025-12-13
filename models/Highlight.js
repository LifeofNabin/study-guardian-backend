// backend/models/Highlight.js
import mongoose from 'mongoose';

const highlightSchema = new mongoose.Schema({
  // References
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
    index: true
  },
  room_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: null
  },
  
  // Highlight Content
  text: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Position & Page Info
  page_number: {
    type: Number,
    required: true,
    min: 1
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  
  // Visual Properties
  color: {
    type: String,
    enum: ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'],
    default: 'yellow'
  },
  
  // Categorization
  category: {
    type: String,
    enum: ['important', 'definition', 'example', 'formula', 'question', 'review', 'understood', 'unclear'],
    default: 'important'
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // AI Analysis (optional)
  ai_category: {
    type: String,
    enum: ['definition', 'concept', 'example', 'formula', 'fact', 'other'],
    default: null
  },
  complexity_score: {
    type: Number,
    min: 0,
    max: 10,
    default: null
  },
  
  // Metadata
  notes: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  is_reviewed: {
    type: Boolean,
    default: false
  },
  review_count: {
    type: Number,
    default: 0
  },
  last_reviewed: {
    type: Date,
    default: null
  },
  
  // Timestamps
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Indexes for fast queries
highlightSchema.index({ user_id: 1, session_id: 1 });
highlightSchema.index({ user_id: 1, created_at: -1 });
highlightSchema.index({ session_id: 1, page_number: 1 });
highlightSchema.index({ category: 1 });

// Virtual for color hex code
highlightSchema.virtual('color_hex').get(function() {
  const colorMap = {
    yellow: '#FFEB3B',
    green: '#4CAF50',
    blue: '#2196F3',
    pink: '#E91E63',
    orange: '#FF9800',
    purple: '#9C27B0'
  };
  return colorMap[this.color] || '#FFEB3B';
});

// Instance method to mark as reviewed
highlightSchema.methods.markReviewed = function() {
  this.is_reviewed = true;
  this.review_count += 1;
  this.last_reviewed = new Date();
  return this.save();
};

// Static method to get highlights by session
highlightSchema.statics.getBySession = function(sessionId) {
  return this.find({ session_id: sessionId })
    .sort({ page_number: 1, created_at: 1 })
    .lean();
};

// Static method to get highlights by user and date range
highlightSchema.statics.getByUserAndDateRange = function(userId, startDate, endDate) {
  return this.find({
    user_id: userId,
    created_at: { $gte: startDate, $lte: endDate }
  })
  .populate('session_id', 'type duration created_at')
  .sort({ created_at: -1 })
  .lean();
};

// Static method to get highlights by category
highlightSchema.statics.getByCategory = function(userId, category) {
  return this.find({ user_id: userId, category })
    .sort({ created_at: -1 })
    .lean();
};

// Static method to search highlights
highlightSchema.statics.searchHighlights = function(userId, searchTerm) {
  return this.find({
    user_id: userId,
    $or: [
      { text: { $regex: searchTerm, $options: 'i' } },
      { notes: { $regex: searchTerm, $options: 'i' } },
      { tags: { $in: [new RegExp(searchTerm, 'i')] } }
    ]
  })
  .sort({ created_at: -1 })
  .lean();
};

// Pre-save hook to update timestamps
highlightSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Ensure virtuals are included in JSON
highlightSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

highlightSchema.set('toObject', {
  virtuals: true
});

export default mongoose.model('Highlight', highlightSchema);