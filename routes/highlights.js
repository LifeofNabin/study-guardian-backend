import express from 'express';
import mongoose from 'mongoose';
import Highlight from '../models/Highlight.js';
import Session from '../models/Session.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/highlights
 * @desc    Create a new highlight
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      material_id,
      page_number,
      text,
      color,
      category,
      position,
      surrounding_text
    } = req.body;

    // Validation
    if (!session_id || !material_id || !page_number || !text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: session_id, material_id, page_number, text'
      });
    }

    // Verify session belongs to user
    const session = await Session.findOne({
      _id: session_id,
      user_id: req.user._id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or unauthorized'
      });
    }

    // Create highlight
    const highlight = await Highlight.create({
      user_id: req.user._id,
      session_id,
      material_id,
      page_number,
      text,
      color: color || '#FFFF00',
      category: category || 'general',
      position: position || {},
      surrounding_text: surrounding_text || ''
    });

    res.status(201).json({
      success: true,
      message: 'Highlight created successfully',
      data: highlight
    });

  } catch (error) {
    console.error('Error creating highlight:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create highlight',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/highlights/batch
 * @desc    Create multiple highlights at once
 * @access  Private
 */
router.post('/batch', async (req, res) => {
  try {
    const { highlights } = req.body;

    if (!highlights || !Array.isArray(highlights) || highlights.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid highlights array'
      });
    }

    // Add user_id to each highlight
    const highlightsWithUser = highlights.map(h => ({
      ...h,
      user_id: req.user._id
    }));

    // Insert all highlights
    const createdHighlights = await Highlight.insertMany(highlightsWithUser);

    res.status(201).json({
      success: true,
      message: `${createdHighlights.length} highlights created successfully`,
      data: createdHighlights
    });

  } catch (error) {
    console.error('Error creating batch highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/session/:sessionId
 * @desc    Get all highlights for a session
 * @access  Private
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page, category, color, sortBy = 'page_number' } = req.query;

    // Build query
    const query = {
      session_id: sessionId,
      user_id: req.user._id
    };

    if (page) query.page_number = parseInt(page);
    if (category) query.category = category;
    if (color) query.color = color;

    // Get highlights
    const highlights = await Highlight.find(query)
      .sort(sortBy === 'date' ? { createdAt: -1 } : { page_number: 1, createdAt: 1 });

    res.json({
      success: true,
      count: highlights.length,
      data: highlights
    });

  } catch (error) {
    console.error('Error fetching highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/material/:materialId
 * @desc    Get all highlights for a material across all sessions
 * @access  Private
 */
router.get('/material/:materialId', async (req, res) => {
  try {
    const { materialId } = req.params;
    const { category, color } = req.query;

    const query = {
      material_id: materialId,
      user_id: req.user._id
    };

    if (category) query.category = category;
    if (color) query.color = color;

    const highlights = await Highlight.find(query)
      .sort({ page_number: 1, createdAt: 1 })
      .populate('session_id', 'start_time end_time');

    res.json({
      success: true,
      count: highlights.length,
      data: highlights
    });

  } catch (error) {
    console.error('Error fetching material highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/page/:sessionId/:pageNumber
 * @desc    Get highlights for a specific page
 * @access  Private
 */
router.get('/page/:sessionId/:pageNumber', async (req, res) => {
  try {
    const { sessionId, pageNumber } = req.params;

    const highlights = await Highlight.findByPage(
      sessionId,
      parseInt(pageNumber)
    );

    res.json({
      success: true,
      count: highlights.length,
      data: highlights
    });

  } catch (error) {
    console.error('Error fetching page highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/category/:category
 * @desc    Get all highlights by category
 * @access  Private
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const highlights = await Highlight.findByCategory(req.user._id, category)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Highlight.countDocuments({
      user_id: req.user._id,
      category
    });

    res.json({
      success: true,
      count: highlights.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: highlights
    });

  } catch (error) {
    console.error('Error fetching category highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/search
 * @desc    Search highlights by text
 * @access  Private
 */
router.get('/search', async (req, res) => {
  try {
    const { q, sessionId, materialId, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const query = {
      user_id: req.user._id,
      $or: [
        { text: { $regex: q, $options: 'i' } },
        { notes: { $regex: q, $options: 'i' } },
        { surrounding_text: { $regex: q, $options: 'i' } }
      ]
    };

    if (sessionId) query.session_id = sessionId;
    if (materialId) query.material_id = materialId;

    const highlights = await Highlight.find(query)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('session_id', 'start_time')
      .populate('material_id', 'title');

    res.json({
      success: true,
      count: highlights.length,
      query: q,
      data: highlights
    });

  } catch (error) {
    console.error('Error searching highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search highlights',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/highlights/stats/:sessionId
 * @desc    Get highlight statistics for a session
 * @access  Private
 */
router.get('/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const stats = await Highlight.getStatsByCategory(sessionId);

    const totalHighlights = await Highlight.countDocuments({
      session_id: sessionId,
      user_id: req.user._id
    });

    const colorDistribution = await Highlight.aggregate([
      {
        $match: {
          session_id: mongoose.Types.ObjectId(sessionId),
          user_id: mongoose.Types.ObjectId(req.user._id)
        }
      },
      {
        $group: {
          _id: '$color',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalHighlights,
        byCategory: stats,
        byColor: colorDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching highlight stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/highlights/:id
 * @desc    Update a highlight
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find and verify ownership
    const highlight = await Highlight.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found or unauthorized'
      });
    }

    // Don't allow changing critical fields
    delete updates.user_id;
    delete updates.session_id;
    delete updates.material_id;

    // Update highlight
    Object.assign(highlight, updates);
    await highlight.save();

    res.json({
      success: true,
      message: 'Highlight updated successfully',
      data: highlight
    });

  } catch (error) {
    console.error('Error updating highlight:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update highlight',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/highlights/:id/notes
 * @desc    Add or update notes for a highlight
 * @access  Private
 */
router.put('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const highlight = await Highlight.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found'
      });
    }

    await highlight.addNote(notes);

    res.json({
      success: true,
      message: 'Notes updated successfully',
      data: highlight
    });

  } catch (error) {
    console.error('Error updating notes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notes',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/highlights/:id/category
 * @desc    Update highlight category
 * @access  Private
 */
router.put('/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    const highlight = await Highlight.findOneAndUpdate(
      { _id: id, user_id: req.user._id },
      { category },
      { new: true, runValidators: true }
    );

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: highlight
    });

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/highlights/:id
 * @desc    Delete a highlight
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const highlight = await Highlight.findOneAndDelete({
      _id: id,
      user_id: req.user._id
    });

    if (!highlight) {
      return res.status(404).json({
        success: false,
        message: 'Highlight not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Highlight deleted successfully',
      data: { id }
    });

  } catch (error) {
    console.error('Error deleting highlight:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete highlight',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/highlights/session/:sessionId
 * @desc    Delete all highlights for a session
 * @access  Private
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await Highlight.deleteMany({
      session_id: sessionId,
      user_id: req.user._id
    });

    res.json({
      success: true,
      message: `${result.deletedCount} highlights deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete highlights',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/highlights/export
 * @desc    Export highlights in various formats
 * @access  Private
 */
router.post('/export', async (req, res) => {
  try {
    const { sessionId, materialId, format = 'json', category, color } = req.body;

    const query = { user_id: req.user._id };
    if (sessionId) query.session_id = sessionId;
    if (materialId) query.material_id = materialId;
    if (category) query.category = category;
    if (color) query.color = color;

    const highlights = await Highlight.find(query)
      .sort({ page_number: 1, createdAt: 1 })
      .populate('material_id', 'title')
      .lean();

    let exportData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case 'json':
        exportData = JSON.stringify(highlights, null, 2);
        contentType = 'application/json';
        filename = `highlights_${Date.now()}.json`;
        break;

      case 'csv':
        const csvHeader = 'Page,Text,Category,Color,Notes,Date\n';
        const csvRows = highlights.map(h =>
          `"${h.page_number}","${h.text.replace(/"/g, '""')}","${h.category}","${h.color}","${(h.notes || '').replace(/"/g, '""')}","${h.createdAt}"`
        ).join('\n');
        exportData = csvHeader + csvRows;
        contentType = 'text/csv';
        filename = `highlights_${Date.now()}.csv`;
        break;

      case 'markdown':
        exportData = highlights.map(h =>
          `## Page ${h.page_number} - ${h.category}\n\n` +
          `> ${h.text}\n\n` +
          (h.notes ? `**Notes:** ${h.notes}\n\n` : '') +
          `*Color: ${h.color} | Date: ${new Date(h.createdAt).toLocaleDateString()}*\n\n---\n\n`
        ).join('');
        contentType = 'text/markdown';
        filename = `highlights_${Date.now()}.md`;
        break;

      case 'txt':
        exportData = highlights.map(h =>
          `Page ${h.page_number} [${h.category}]\n` +
          `${h.text}\n` +
          (h.notes ? `Notes: ${h.notes}\n` : '') +
          `---\n\n`
        ).join('');
        contentType = 'text/plain';
        filename = `highlights_${Date.now()}.txt`;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid format. Supported: json, csv, markdown, txt'
        });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exportData);

  } catch (error) {
    console.error('Error exporting highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export highlights',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/highlights/merge
 * @desc    Merge overlapping highlights
 * @access  Private
 */
router.post('/merge', async (req, res) => {
  try {
    const { highlightIds } = req.body;

    if (!highlightIds || highlightIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 highlight IDs are required'
      });
    }

    const highlights = await Highlight.find({
      _id: { $in: highlightIds },
      user_id: req.user._id
    }).sort({ page_number: 1, 'position.y': 1 });

    if (highlights.length < 2) {
      return res.status(404).json({
        success: false,
        message: 'Highlights not found'
      });
    }

    // Merge text and notes
    const mergedText = highlights.map(h => h.text).join(' ');
    const mergedNotes = highlights
      .filter(h => h.notes)
      .map(h => h.notes)
      .join('\n---\n');

    // Create merged highlight
    const mergedHighlight = await Highlight.create({
      user_id: req.user._id,
      session_id: highlights[0].session_id,
      material_id: highlights[0].material_id,
      page_number: highlights[0].page_number,
      text: mergedText,
      notes: mergedNotes || undefined,
      color: highlights[0].color,
      category: highlights[0].category,
      position: highlights[0].position
    });

    // Delete original highlights
    await Highlight.deleteMany({
      _id: { $in: highlightIds },
      user_id: req.user._id
    });

    res.json({
      success: true,
      message: 'Highlights merged successfully',
      data: mergedHighlight
    });

  } catch (error) {
    console.error('Error merging highlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to merge highlights',
      error: error.message
    });
  }
});

export default router;
