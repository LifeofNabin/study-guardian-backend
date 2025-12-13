import mongoose from 'mongoose';

const userPreferencesSchema = new mongoose.Schema({
  // User Reference
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // Reading Preferences
  reading: {
    speed: {
      type: Number,
      default: 250, // words per minute
      min: 100,
      max: 1000
    },
    preferred_font_size: {
      type: Number,
      default: 16,
      min: 10,
      max: 32
    },
    preferred_line_height: {
      type: Number,
      default: 1.5,
      min: 1.0,
      max: 3.0
    },
    text_to_speech_enabled: {
      type: Boolean,
      default: false
    },
    tts_voice: {
      type: String,
      default: 'en-US'
    },
    tts_speed: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 2.0
    }
  },

  // Display Preferences
  display: {
    dark_mode: {
      type: Boolean,
      default: false
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'sepia', 'auto'],
      default: 'light'
    },
    contrast_mode: {
      type: String,
      enum: ['normal', 'high', 'low'],
      default: 'normal'
    },
    pdf_view_mode: {
      type: String,
      enum: ['single', 'double', 'continuous'],
      default: 'single'
    },
    show_toolbar: {
      type: Boolean,
      default: true
    },
    show_sidebar: {
      type: Boolean,
      default: true
    }
  },

  // Highlight Preferences
  highlights: {
    default_color: {
      type: String,
      default: '#FFFF00',
      match: /^#[0-9A-F]{6}$/i
    },
    color_palette: [{
      name: String,
      color: String,
      category: String
    }],
    auto_save: {
      type: Boolean,
      default: true
    },
    show_in_sidebar: {
      type: Boolean,
      default: true
    }
  },

  // Study Session Preferences
  study: {
    // Pomodoro Timer
    pomodoro_work_duration: {
      type: Number,
      default: 25, // minutes
      min: 5,
      max: 60
    },
    pomodoro_short_break: {
      type: Number,
      default: 5,
      min: 1,
      max: 15
    },
    pomodoro_long_break: {
      type: Number,
      default: 15,
      min: 5,
      max: 30
    },
    pomodoro_enabled: {
      type: Boolean,
      default: false
    },
    
    // Break Reminders
    break_reminder_interval: {
      type: Number,
      default: 25, // minutes
      min: 10,
      max: 90
    },
    break_reminders_enabled: {
      type: Boolean,
      default: true
    },
    
    // Study Goals
    daily_study_goal: {
      type: Number,
      default: 120, // minutes
      min: 15,
      max: 480
    },
    weekly_study_goal: {
      type: Number,
      default: 600, // minutes
      min: 60,
      max: 3000
    }
  },

  // Webcam & Privacy Preferences
  webcam: {
    enabled: {
      type: Boolean,
      default: true
    },
    blur_background: {
      type: Boolean,
      default: false
    },
    show_preview: {
      type: Boolean,
      default: true
    },
    
    // Privacy settings
    store_snapshots: {
      type: Boolean,
      default: false
    },
    share_data_for_insights: {
      type: Boolean,
      default: true
    },
    
    // Monitoring preferences
    monitor_posture: {
      type: Boolean,
      default: true
    },
    monitor_attention: {
      type: Boolean,
      default: true
    },
    monitor_emotion: {
      type: Boolean,
      default: true
    },
    detect_distractions: {
      type: Boolean,
      default: true
    },
    
    // Alert thresholds
    posture_alert_threshold: {
      type: Number,
      default: 40, // score below which to alert
      min: 0,
      max: 100
    },
    distraction_alert_enabled: {
      type: Boolean,
      default: true
    }
  },

  // Notification Preferences
  notifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    sound_enabled: {
      type: Boolean,
      default: true
    },
    
    // Types of notifications
    break_reminders: {
      type: Boolean,
      default: true
    },
    posture_alerts: {
      type: Boolean,
      default: true
    },
    eye_strain_warnings: {
      type: Boolean,
      default: true
    },
    distraction_alerts: {
      type: Boolean,
      default: true
    },
    achievement_notifications: {
      type: Boolean,
      default: true
    },
    daily_summary: {
      type: Boolean,
      default: true
    },
    
    // Notification timing
    quiet_hours: {
      enabled: {
        type: Boolean,
        default: false
      },
      start_time: {
        type: String,
        default: '22:00'
      },
      end_time: {
        type: String,
        default: '08:00'
      }
    }
  },

  // Analytics Preferences
  analytics: {
    track_reading_speed: {
      type: Boolean,
      default: true
    },
    track_engagement: {
      type: Boolean,
      default: true
    },
    show_detailed_stats: {
      type: Boolean,
      default: true
    },
    compare_with_average: {
      type: Boolean,
      default: false
    },
    export_data_enabled: {
      type: Boolean,
      default: true
    }
  },

  // AI Features Preferences
  ai: {
    auto_generate_summaries: {
      type: Boolean,
      default: false
    },
    auto_generate_questions: {
      type: Boolean,
      default: false
    },
    show_ai_insights: {
      type: Boolean,
      default: true
    },
    ai_summary_length: {
      type: String,
      enum: ['short', 'medium', 'long'],
      default: 'medium'
    },
    difficulty_level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    }
  },

  // Accessibility
  accessibility: {
    high_contrast: {
      type: Boolean,
      default: false
    },
    large_text: {
      type: Boolean,
      default: false
    },
    reduce_motion: {
      type: Boolean,
      default: false
    },
    keyboard_shortcuts_enabled: {
      type: Boolean,
      default: true
    },
    screen_reader_mode: {
      type: Boolean,
      default: false
    }
  },

  // Language & Localization
  localization: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'hi', 'zh', 'ja', 'ar']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    date_format: {
      type: String,
      enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
      default: 'MM/DD/YYYY'
    },
    time_format: {
      type: String,
      enum: ['12h', '24h'],
      default: '12h'
    }
  },

  // Advanced Settings
  advanced: {
    auto_save_interval: {
      type: Number,
      default: 30, // seconds
      min: 10,
      max: 300
    },
    metrics_sampling_rate: {
      type: Number,
      default: 5, // seconds
      min: 1,
      max: 60
    },
    cache_enabled: {
      type: Boolean,
      default: true
    },
    offline_mode: {
      type: Boolean,
      default: false
    }
  },

  // Last updated timestamp
  last_synced: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for color palette size
userPreferencesSchema.virtual('color_count').get(function() {
  return this.highlights.color_palette.length;
});

// Instance Methods
userPreferencesSchema.methods.addHighlightColor = function(name, color, category = 'custom') {
  if (!this.highlights.color_palette.find(c => c.color === color)) {
    this.highlights.color_palette.push({ name, color, category });
    return this.save();
  }
  return this;
};

userPreferencesSchema.methods.removeHighlightColor = function(color) {
  this.highlights.color_palette = this.highlights.color_palette.filter(c => c.color !== color);
  return this.save();
};

userPreferencesSchema.methods.isQuietHours = function() {
  if (!this.notifications.quiet_hours.enabled) return false;
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const start = this.notifications.quiet_hours.start_time;
  const end = this.notifications.quiet_hours.end_time;
  
  if (start < end) {
    return currentTime >= start && currentTime < end;
  } else {
    return currentTime >= start || currentTime < end;
  }
};

userPreferencesSchema.methods.shouldShowNotification = function(type) {
  if (!this.notifications.enabled || this.isQuietHours()) {
    return false;
  }
  
  const notificationMap = {
    'break': this.notifications.break_reminders,
    'posture': this.notifications.posture_alerts,
    'eye_strain': this.notifications.eye_strain_warnings,
    'distraction': this.notifications.distraction_alerts,
    'achievement': this.notifications.achievement_notifications,
    'summary': this.notifications.daily_summary
  };
  
  return notificationMap[type] !== false;
};

userPreferencesSchema.methods.getPomodoroConfig = function() {
  return {
    enabled: this.study.pomodoro_enabled,
    workDuration: this.study.pomodoro_work_duration * 60 * 1000, // convert to ms
    shortBreak: this.study.pomodoro_short_break * 60 * 1000,
    longBreak: this.study.pomodoro_long_break * 60 * 1000
  };
};

userPreferencesSchema.methods.getThemeSettings = function() {
  return {
    theme: this.display.theme,
    darkMode: this.display.dark_mode,
    contrast: this.display.contrast_mode,
    highContrast: this.accessibility.high_contrast,
    reduceMotion: this.accessibility.reduce_motion
  };
};

// Static Methods
userPreferencesSchema.statics.getOrCreate = async function(userId) {
  let preferences = await this.findOne({ user_id: userId });
  
  if (!preferences) {
    preferences = await this.create({
      user_id: userId,
      'highlights.color_palette': [
        { name: 'Yellow', color: '#FFFF00', category: 'default' },
        { name: 'Green', color: '#00FF00', category: 'default' },
        { name: 'Blue', color: '#00BFFF', category: 'default' },
        { name: 'Orange', color: '#FFA500', category: 'default' },
        { name: 'Pink', color: '#FF69B4', category: 'default' }
      ]
    });
  }
  
  return preferences;
};

userPreferencesSchema.statics.updatePreferences = async function(userId, updates) {
  return this.findOneAndUpdate(
    { user_id: userId },
    { 
      $set: { 
        ...updates,
        last_synced: new Date()
      }
    },
    { new: true, upsert: true, runValidators: true }
  );
};

userPreferencesSchema.statics.resetToDefaults = async function(userId) {
  const defaultPrefs = new this({ user_id: userId });
  return this.findOneAndUpdate(
    { user_id: userId },
    defaultPrefs.toObject(),
    { new: true, upsert: true }
  );
};

userPreferencesSchema.statics.exportPreferences = async function(userId) {
  const prefs = await this.findOne({ user_id: userId });
  if (!prefs) return null;
  
  const exported = prefs.toObject();
  delete exported._id;
  delete exported.user_id;
  delete exported.createdAt;
  delete exported.updatedAt;
  delete exported.__v;
  
  return exported;
};

userPreferencesSchema.statics.importPreferences = async function(userId, importData) {
  return this.findOneAndUpdate(
    { user_id: userId },
    { 
      $set: {
        ...importData,
        user_id: userId,
        last_synced: new Date()
      }
    },
    { new: true, upsert: true, runValidators: true }
  );
};

// Pre-save middleware
userPreferencesSchema.pre('save', function(next) {
  this.last_synced = new Date();
  
  // Ensure default color palette exists
  if (this.highlights.color_palette.length === 0) {
    this.highlights.color_palette = [
      { name: 'Yellow', color: '#FFFF00', category: 'default' },
      { name: 'Green', color: '#00FF00', category: 'default' },
      { name: 'Blue', color: '#00BFFF', category: 'default' },
      { name: 'Orange', color: '#FFA500', category: 'default' },
      { name: 'Pink', color: '#FF69B4', category: 'default' }
    ];
  }
  
  next();
});

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

export default UserPreferences;