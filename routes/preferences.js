import express from 'express';
import UserPreferences from '../models/UserPreferences.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   GET /api/preferences
 * @desc    Get user preferences (creates default if not exists)
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const preferences = await UserPreferences.getOrCreate(req.user._id);

    res.json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/', async (req, res) => {
  try {
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.user_id;
    delete updates.createdAt;
    delete updates.updatedAt;
    delete updates.__v;

    const preferences = await UserPreferences.updatePreferences(
      req.user._id,
      updates
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferences
    });

  } catch (error) {
    console.error('Error updating preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/preferences
 * @desc    Partially update specific preference fields
 * @access  Private
 */
router.patch('/', async (req, res) => {
  try {
    const updates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: {
          ...updates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: preferences
    });

  } catch (error) {
    console.error('Error patching preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/reading
 * @desc    Get reading preferences only
 * @access  Private
 */
router.get('/reading', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('reading');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.reading
    });

  } catch (error) {
    console.error('Error fetching reading preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reading preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/reading
 * @desc    Update reading preferences
 * @access  Private
 */
router.put('/reading', async (req, res) => {
  try {
    const readingUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          reading: readingUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Reading preferences updated',
      data: preferences.reading
    });

  } catch (error) {
    console.error('Error updating reading preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update reading preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/display
 * @desc    Get display preferences
 * @access  Private
 */
router.get('/display', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('display');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.display
    });

  } catch (error) {
    console.error('Error fetching display preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch display preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/display
 * @desc    Update display preferences
 * @access  Private
 */
router.put('/display', async (req, res) => {
  try {
    const displayUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          display: displayUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Display preferences updated',
      data: preferences.display
    });

  } catch (error) {
    console.error('Error updating display preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update display preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/theme
 * @desc    Get theme settings (combined display + accessibility)
 * @access  Private
 */
router.get('/theme', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    const themeSettings = preferences.getThemeSettings();

    res.json({
      success: true,
      data: themeSettings
    });

  } catch (error) {
    console.error('Error fetching theme settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch theme settings',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/theme/dark-mode
 * @desc    Toggle dark mode
 * @access  Private
 */
router.put('/theme/dark-mode', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled field must be a boolean'
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          'display.dark_mode': enabled,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: `Dark mode ${enabled ? 'enabled' : 'disabled'}`,
      data: { dark_mode: preferences.display.dark_mode }
    });

  } catch (error) {
    console.error('Error toggling dark mode:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle dark mode',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/highlights
 * @desc    Get highlight preferences and color palette
 * @access  Private
 */
router.get('/highlights', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('highlights');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.highlights
    });

  } catch (error) {
    console.error('Error fetching highlight preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highlight preferences',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/preferences/highlights/colors
 * @desc    Add a custom highlight color
 * @access  Private
 */
router.post('/highlights/colors', async (req, res) => {
  try {
    const { name, color, category = 'custom' } = req.body;

    if (!name || !color) {
      return res.status(400).json({
        success: false,
        message: 'Name and color are required'
      });
    }

    // Validate hex color format
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid color format. Use hex format like #FF5733'
      });
    }

    const preferences = await UserPreferences.findOne({ user_id: req.user._id });
    
    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    await preferences.addHighlightColor(name, color, category);

    res.json({
      success: true,
      message: 'Color added successfully',
      data: preferences.highlights.color_palette
    });

  } catch (error) {
    console.error('Error adding highlight color:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add color',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/preferences/highlights/colors/:color
 * @desc    Remove a highlight color from palette
 * @access  Private
 */
router.delete('/highlights/colors/:color', async (req, res) => {
  try {
    const { color } = req.params;

    const preferences = await UserPreferences.findOne({ user_id: req.user._id });
    
    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    await preferences.removeHighlightColor(color);

    res.json({
      success: true,
      message: 'Color removed successfully',
      data: preferences.highlights.color_palette
    });

  } catch (error) {
    console.error('Error removing highlight color:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove color',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/study
 * @desc    Get study session preferences
 * @access  Private
 */
router.get('/study', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('study');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.study
    });

  } catch (error) {
    console.error('Error fetching study preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/study/pomodoro
 * @desc    Get Pomodoro timer configuration
 * @access  Private
 */
router.get('/study/pomodoro', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    const pomodoroConfig = preferences.getPomodoroConfig();

    res.json({
      success: true,
      data: pomodoroConfig
    });

  } catch (error) {
    console.error('Error fetching Pomodoro config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Pomodoro configuration',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/study/pomodoro
 * @desc    Update Pomodoro timer settings
 * @access  Private
 */
router.put('/study/pomodoro', async (req, res) => {
  try {
    const { enabled, work_duration, short_break, long_break } = req.body;

    const updates = {};
    if (enabled !== undefined) updates['study.pomodoro_enabled'] = enabled;
    if (work_duration !== undefined) updates['study.pomodoro_work_duration'] = work_duration;
    if (short_break !== undefined) updates['study.pomodoro_short_break'] = short_break;
    if (long_break !== undefined) updates['study.pomodoro_long_break'] = long_break;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          ...updates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Pomodoro settings updated',
      data: preferences.getPomodoroConfig()
    });

  } catch (error) {
    console.error('Error updating Pomodoro settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update Pomodoro settings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/webcam
 * @desc    Get webcam and privacy preferences
 * @access  Private
 */
router.get('/webcam', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('webcam');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.webcam
    });

  } catch (error) {
    console.error('Error fetching webcam preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webcam preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/webcam
 * @desc    Update webcam preferences
 * @access  Private
 */
router.put('/webcam', async (req, res) => {
  try {
    const webcamUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          webcam: webcamUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Webcam preferences updated',
      data: preferences.webcam
    });

  } catch (error) {
    console.error('Error updating webcam preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update webcam preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/webcam/toggle
 * @desc    Toggle webcam monitoring on/off
 * @access  Private
 */
router.put('/webcam/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled field must be a boolean'
      });
    }

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          'webcam.enabled': enabled,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: `Webcam monitoring ${enabled ? 'enabled' : 'disabled'}`,
      data: { enabled: preferences.webcam.enabled }
    });

  } catch (error) {
    console.error('Error toggling webcam:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle webcam',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/notifications
 * @desc    Get notification preferences
 * @access  Private
 */
router.get('/notifications', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('notifications');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.notifications
    });

  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.put('/notifications', async (req, res) => {
  try {
    const notificationUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          notifications: notificationUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: preferences.notifications
    });

  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/notifications/check/:type
 * @desc    Check if a specific notification type should be shown
 * @access  Private
 */
router.get('/notifications/check/:type', async (req, res) => {
  try {
    const { type } = req.params;

    const preferences = await UserPreferences.findOne({ user_id: req.user._id });

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    const shouldShow = preferences.shouldShowNotification(type);

    res.json({
      success: true,
      data: {
        type,
        shouldShow,
        isQuietHours: preferences.isQuietHours()
      }
    });

  } catch (error) {
    console.error('Error checking notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check notification settings',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/ai
 * @desc    Get AI feature preferences
 * @access  Private
 */
router.get('/ai', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('ai');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.ai
    });

  } catch (error) {
    console.error('Error fetching AI preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/ai
 * @desc    Update AI feature preferences
 * @access  Private
 */
router.put('/ai', async (req, res) => {
  try {
    const aiUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          ai: aiUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'AI preferences updated',
      data: preferences.ai
    });

  } catch (error) {
    console.error('Error updating AI preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update AI preferences',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/preferences/export
 * @desc    Export user preferences
 * @access  Private
 */
router.post('/export', async (req, res) => {
  try {
    const exported = await UserPreferences.exportPreferences(req.user._id);

    if (!exported) {
      return res.status(404).json({
        success: false,
        message: 'No preferences found to export'
      });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="preferences_${Date.now()}.json"`);
    res.send(JSON.stringify(exported, null, 2));

  } catch (error) {
    console.error('Error exporting preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export preferences',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/preferences/import
 * @desc    Import user preferences from JSON
 * @access  Private
 */
router.post('/import', async (req, res) => {
  try {
    const importData = req.body;

    if (!importData || typeof importData !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid import data'
      });
    }

    const preferences = await UserPreferences.importPreferences(
      req.user._id,
      importData
    );

    res.json({
      success: true,
      message: 'Preferences imported successfully',
      data: preferences
    });

  } catch (error) {
    console.error('Error importing preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import preferences',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/preferences/reset
 * @desc    Reset preferences to default values
 * @access  Private
 */
router.post('/reset', async (req, res) => {
  try {
    const preferences = await UserPreferences.resetToDefaults(req.user._id);

    res.json({
      success: true,
      message: 'Preferences reset to defaults',
      data: preferences
    });

  } catch (error) {
    console.error('Error resetting preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset preferences',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/preferences/accessibility
 * @desc    Get accessibility preferences
 * @access  Private
 */
router.get('/accessibility', async (req, res) => {
  try {
    const preferences = await UserPreferences.findOne({ user_id: req.user._id })
      .select('accessibility');

    if (!preferences) {
      return res.status(404).json({
        success: false,
        message: 'Preferences not found'
      });
    }

    res.json({
      success: true,
      data: preferences.accessibility
    });

  } catch (error) {
    console.error('Error fetching accessibility preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch accessibility preferences',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/preferences/accessibility
 * @desc    Update accessibility preferences
 * @access  Private
 */
router.put('/accessibility', async (req, res) => {
  try {
    const accessibilityUpdates = req.body;

    const preferences = await UserPreferences.findOneAndUpdate(
      { user_id: req.user._id },
      { 
        $set: { 
          accessibility: accessibilityUpdates,
          last_synced: new Date()
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Accessibility preferences updated',
      data: preferences.accessibility
    });

  } catch (error) {
    console.error('Error updating accessibility preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update accessibility preferences',
      error: error.message
    });
  }
});

export default router;
