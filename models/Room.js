// backend/models/Room.js
import mongoose from 'mongoose';

// Notification sub-schema
const notificationSchema = new mongoose.Schema({
  message: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  read_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { _id: true });

// Room schema
const roomSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true, 
    maxlength: 100 
  },
  
  code: { 
    type: String, 
    required: true, 
    unique: true, 
    uppercase: true,
    trim: true,
    minlength: 6,
    maxlength: 10,
    index: true
  },
  
  teacher_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true
  },
  
  allowed_students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  max_students: {
    type: Number,
    default: 20,
    min: 1,
    max: 50
  },

  subject: { type: String, trim: true, maxlength: 100, default: 'General' },
  start_time: { type: Date },
  end_time: { type: Date },

  pdf_path: { 
    type: String,
    default: null
  },
  
  pdf_name: { 
    type: String,
    default: null
  },
  
  pdf_uploaded_at: Date,
  
  is_active: { 
    type: Boolean, 
    default: true,
    index: true
  },
  
  notifications: [notificationSchema],
  
  settings: {
    allow_student_pdfs: { type: Boolean, default: true },
    require_webcam: { type: Boolean, default: true },
    auto_end_sessions: { type: Boolean, default: false },
    session_timeout: { type: Number, default: 120 }
  }
}, { 
  timestamps: true,
  // ✅ CRITICAL FIX: Enable virtuals in JSON/Object conversions
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ======================== INDEXES ========================
roomSchema.index({ teacher_id: 1, is_active: 1, createdAt: -1 });
roomSchema.index({ allowed_students: 1, is_active: 1 });

// ======================== VIRTUALS ========================
roomSchema.virtual('student_count').get(function() {
  return this.allowed_students ? this.allowed_students.length : 0;
});

roomSchema.virtual('has_pdf').get(function() {
  return !!this.pdf_path;
});

// ======================== METHODS ========================
roomSchema.methods.isStudentAllowed = function(studentId) {
  return this.allowed_students.some(id => id.toString() === studentId.toString());
};

roomSchema.methods.addStudent = function(studentId) {
  if (this.isStudentAllowed(studentId)) {
    throw new Error('Student already added to room');
  }
  if (this.allowed_students.length >= this.max_students) {
    throw new Error(`Room is full (max ${this.max_students} students)`);
  }
  this.allowed_students.push(studentId);
};

roomSchema.methods.removeStudent = function(studentId) {
  this.allowed_students = this.allowed_students.filter(
    id => id.toString() !== studentId.toString()
  );
};

roomSchema.methods.addNotification = function(message) {
  this.notifications.push({ message });
  if (this.notifications.length > 50) {
    this.notifications = this.notifications.slice(-50);
  }
};

roomSchema.methods.markNotificationAsRead = function(notificationId, studentId) {
  const notification = this.notifications.id(notificationId);
  if (notification && !notification.read_by.includes(studentId)) {
    notification.read_by.push(studentId);
  }
};

roomSchema.methods.getUnreadNotifications = function(studentId) {
  return this.notifications.filter(n => 
    !n.read_by.some(id => id.toString() === studentId.toString())
  );
};

roomSchema.methods.setPdf = function(filePath, fileName) {
  this.pdf_path = filePath;
  this.pdf_name = fileName;
  this.pdf_uploaded_at = Date.now();
};

roomSchema.methods.removePdf = function() {
  this.pdf_path = null;
  this.pdf_name = null;
  this.pdf_uploaded_at = null;
};

// ======================== STATIC METHODS ========================
roomSchema.statics.generateUniqueCode = async function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let exists = true;
  while (exists) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    exists = await this.findOne({ code });
  }
  return code;
};

// ======================== PRE SAVE VALIDATION ========================
roomSchema.pre('save', function(next) {
  if (this.allowed_students.length > this.max_students) {
    next(new Error(`Cannot exceed maximum of ${this.max_students} students`));
  }
  next();
});

export default mongoose.model('Room', roomSchema);