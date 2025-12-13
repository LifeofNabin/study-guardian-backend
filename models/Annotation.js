import mongoose from 'mongoose';

const annotationSchema = new mongoose.Schema({
  // User and Session References
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
  material_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true
  },

  // Location Information
  page_number: {
    type: Number,
    required: true,
    min: 1
  },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, default: 200 },
    height: { type: Number, default: 100 }
  },

  // Annotation Content
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['note', 'question', 'summary', 'insight', 'todo', 'definition'],
    default: 'note'
  },

  // Metadata
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  color: {
    type: String,
    default: '#FFD700',
    match: /^#[0-9A-F]{6}$/i
  },
  
  // AI Enhancement (optional)
  ai_generated: {
    type: Boolean,
    default: false
  },
  related_highlights: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Highlight'
  }],

  // Context (for better understanding)
  surrounding_text: {
    type: String,
    maxlength: 1000
  },

  // Status
  is_resolved: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for faster queries
annotationSchema.index({ user_id: 1, session_id: 1 });
annotationSchema.index({ user_id: 1, material_id: 1 });
annotationSchema.index({ page_number: 1 });
annotationSchema.index({ type: 1 });
annotationSchema.index({ tags: 1 });
annotationSchema.index({ createdAt: -1 });

// Virtual for annotation age
annotationSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Instance Methods
annotationSchema.methods.toggleResolved = function() {
  this.is_resolved = !this.is_resolved;
  return this.save();
};

annotationSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag.toLowerCase())) {
    this.tags.push(tag.toLowerCase());
    return this.save();
  }
  return this;
};

annotationSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag.toLowerCase());
  return this.save();
};

// Static Methods
annotationSchema.statics.findBySession = function(sessionId) {
  return this.find({ session_id: sessionId })
    .sort({ page_number: 1, createdAt: 1 })
    .populate('related_highlights');
};

annotationSchema.statics.findByPage = function(sessionId, pageNumber) {
  return this.find({ 
    session_id: sessionId, 
    page_number: pageNumber 
  }).sort({ createdAt: 1 });
};

annotationSchema.statics.findByType = function(userId, type) {
  return this.find({ user_id: userId, type })
    .sort({ createdAt: -1 });
};

annotationSchema.statics.searchByTag = function(userId, tag) {
  return this.find({ 
    user_id: userId, 
    tags: tag.toLowerCase() 
  }).sort({ createdAt: -1 });
};

annotationSchema.statics.getUnresolved = function(userId) {
  return this.find({ 
    user_id: userId, 
    is_resolved: false 
  }).sort({ priority: -1, createdAt: -1 });
};

annotationSchema.statics.getStatsByType = async function(userId) {
  return this.aggregate([
    { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
    { $group: { 
      _id: '$type', 
      count: { $sum: 1 },
      resolved: { 
        $sum: { $cond: ['$is_resolved', 1, 0] } 
      }
    }},
    { $sort: { count: -1 } }
  ]);
};

// Pre-save middleware
annotationSchema.pre('save', function(next) {
  // Ensure tags are unique and lowercase
  this.tags = [...new Set(this.tags.map(t => t.toLowerCase()))];
  next();
});

const Annotation = mongoose.model('Annotation', annotationSchema);

export default Annotation;
