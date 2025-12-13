// backend/models/RefreshToken.js

import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    index: true 
  },
  
  token: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  
  expires_at: { 
    type: Date, 
    required: true, 
    index: true 
  },
  
  created_by_ip: { 
    type: String,
    required: true 
  },
  
  revoked: { 
    type: Boolean, 
    default: false 
  },
  
  revoked_at: Date,
  revoked_by_ip: String,
  replaced_by_token: String
}, { timestamps: true });

refreshTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

refreshTokenSchema.virtual('isExpired').get(function() {
  return Date.now() >= this.expires_at;
});

refreshTokenSchema.virtual('isActive').get(function() {
  return !this.revoked && !this.isExpired;
});

refreshTokenSchema.methods.revoke = function(ipAddress, replacedByToken) {
  this.revoked = true;
  this.revoked_at = Date.now();
  this.revoked_by_ip = ipAddress;
  this.replaced_by_token = replacedByToken;
};

refreshTokenSchema.statics.revokeAllForUser = async function(userId) {
  return this.updateMany(
    { user_id: userId, revoked: false },
    { 
      revoked: true, 
      revoked_at: Date.now() 
    }
  );
};

refreshTokenSchema.statics.cleanupExpired = async function() {
  return this.deleteMany({ 
    expires_at: { $lt: Date.now() } 
  });
};

export default mongoose.model('RefreshToken', refreshTokenSchema);