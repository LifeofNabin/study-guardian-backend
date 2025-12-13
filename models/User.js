// backend/models/User.js
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  role: {
    type: String,
    enum: ['student', 'teacher'],
    required: [true, 'Role is required'],
  },
  // ✅ ADDED: Active status field
  is_active: {
    type: Boolean,
    default: true,
  },
  // ✅ ADDED: Email verification status
  is_verified: {
    type: Boolean,
    default: false,
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  githubId: {
    type: String,
    sparse: true,
    unique: true,
  },
  lastLogin: {
    type: Date,
  },
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified or new
  if (!this.isModified('password')) return next();
  
  // Don't hash if password is empty (for OAuth users)
  if (!this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Public profile method
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id.toString(), // Convert ObjectId to string for JSON
    email: this.email,
    name: this.name,
    role: this.role,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

// Virtual for id (if you want to use .id instead of ._id)
userSchema.virtual('id').get(function() {
  return this._id.toString();
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

userSchema.set('toObject', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

// Export as ES module
export default mongoose.model('User', userSchema);