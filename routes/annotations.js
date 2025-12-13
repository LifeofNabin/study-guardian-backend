import express from 'express';
import mongoose from 'mongoose';
import Annotation from '../models/Annotation.js';
import Session from '../models/Session.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/annotations
 * @desc    Create a new annotation
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const {
      session_id,
      material_id,
      page_number,
      content,
      type,
      position,
      tags,
      color,
      surrounding_text,
      priority,
      related_highlights
    } = req.body;

    // Validation
    if (!session_id || !material_id || !page_number || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: session_id, material_id, page_number, content'
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

    // Create annotation
    const annotation = await Annotation.create({
      user_id: req.user._id,
      session_id,
      material_id,
      page_number,
      content,
      type: type || 'note',
      position: position || { x: 0, y: 0, width: 200, height: 100 },
      tags: tags || [],
      color: color || '#FFD700',
      surrounding_text: surrounding_text || '',
      priority: priority || 'medium',
      related_highlights: related_highlights || []
    });

    res.status(201).json({
      success: true,
      message: 'Annotation created successfully',
      data: annotation
    });

  } catch (error) {
    console.error('Error creating annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create annotation',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/annotations/batch
 * @desc    Create multiple annotations at once
 * @access  Private
 */
router.post('/batch', async (req, res) => {
  try {
    const { annotations } = req.body;

    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid annotations array'
      });
    }

    // Add user_id to each annotation
    const annotationsWithUser = annotations.map(a => ({
      ...a,
      user_id: req.user._id
    }));

    // Insert all annotations
    const createdAnnotations = await Annotation.insertMany(annotationsWithUser);

    res.status(201).json({
      success: true,
      message: `${createdAnnotations.length} annotations created successfully`,
      data: createdAnnotations
    });

  } catch (error) {
    console.error('Error creating batch annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/session/:sessionId
 * @desc    Get all annotations for a session
 * @access  Private
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { page, type, tag, resolved, sortBy = 'page_number' } = req.query;

    // Build query
    const query = {
      session_id: sessionId,
      user_id: req.user._id
    };

    if (page) query.page_number = parseInt(page);
    if (type) query.type = type;
    if (tag) query.tags = tag;
    if (resolved !== undefined) query.is_resolved = resolved === 'true';

    // Determine sort order
    let sort = {};
    switch (sortBy) {
      case 'date':
        sort = { createdAt: -1 };
        break;
      case 'priority':
        sort = { priority: -1, createdAt: -1 };
        break;
      case 'type':
        sort = { type: 1, page_number: 1 };
        break;
      default:
        sort = { page_number: 1, createdAt: 1 };
    }

    // Get annotations
    const annotations = await Annotation.find(query)
      .sort(sort)
      .populate('related_highlights', 'text color category');

    res.json({
      success: true,
      count: annotations.length,
      data: annotations
    });

  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/page/:sessionId/:pageNumber
 * @desc    Get annotations for a specific page
 * @access  Private
 */
router.get('/page/:sessionId/:pageNumber', async (req, res) => {
  try {
    const { sessionId, pageNumber } = req.params;

    const annotations = await Annotation.findByPage(
      sessionId,
      parseInt(pageNumber)
    ).populate('related_highlights', 'text color');

    res.json({
      success: true,
      count: annotations.length,
      data: annotations
    });

  } catch (error) {
    console.error('Error fetching page annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch page annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/type/:type
 * @desc    Get all annotations by type
 * @access  Private
 */
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const annotations = await Annotation.findByType(req.user._id, type)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('session_id', 'start_time material_id')
      .populate('material_id', 'title');

    const total = await Annotation.countDocuments({
      user_id: req.user._id,
      type
    });

    res.json({
      success: true,
      count: annotations.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: annotations
    });

  } catch (error) {
    console.error('Error fetching type annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/tag/:tag
 * @desc    Search annotations by tag
 * @access  Private
 */
router.get('/tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 50 } = req.query;

    const annotations = await Annotation.searchByTag(req.user._id, tag)
      .limit(parseInt(limit))
      .populate('session_id', 'start_time')
      .populate('material_id', 'title');

    res.json({
      success: true,
      count: annotations.length,
      tag,
      data: annotations
    });

  } catch (error) {
    console.error('Error searching annotations by tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/unresolved
 * @desc    Get all unresolved annotations
 * @access  Private
 */
router.get('/unresolved', async (req, res) => {
  try {
    const { type, priority } = req.query;

    let annotations = await Annotation.getUnresolved(req.user._id)
      .populate('session_id', 'start_time')
      .populate('material_id', 'title');

    // Additional filtering
    if (type) {
      annotations = annotations.filter(a => a.type === type);
    }
    if (priority) {
      annotations = annotations.filter(a => a.priority === priority);
    }

    res.json({
      success: true,
      count: annotations.length,
      data: annotations
    });

  } catch (error) {
    console.error('Error fetching unresolved annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unresolved annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/search
 * @desc    Search annotations by content
 * @access  Private
 */
router.get('/search', async (req, res) => {
  try {
    const { q, sessionId, materialId, type, limit = 50 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const query = {
      user_id: req.user._id,
      content: { $regex: q, $options: 'i' }
    };

    if (sessionId) query.session_id = sessionId;
    if (materialId) query.material_id = materialId;
    if (type) query.type = type;

    const annotations = await Annotation.find(query)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('session_id', 'start_time')
      .populate('material_id', 'title');

    res.json({
      success: true,
      count: annotations.length,
      query: q,
      data: annotations
    });

  } catch (error) {
    console.error('Error searching annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/stats/:sessionId
 * @desc    Get annotation statistics for a session
 * @access  Private
 */
router.get('/stats/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const stats = await Annotation.getStatsByType(req.user._id);

    const totalAnnotations = await Annotation.countDocuments({
      session_id: sessionId,
      user_id: req.user._id
    });

    const resolved = await Annotation.countDocuments({
      session_id: sessionId,
      user_id: req.user._id,
      is_resolved: true
    });

    const byPriority = await Annotation.aggregate([
      {
        $match: {
          session_id: mongoose.Types.ObjectId(sessionId),
          user_id: mongoose.Types.ObjectId(req.user._id)
        }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const topTags = await Annotation.aggregate([
      {
        $match: {
          session_id: mongoose.Types.ObjectId(sessionId),
          user_id: mongoose.Types.ObjectId(req.user._id)
        }
      },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        total: totalAnnotations,
        resolved,
        unresolved: totalAnnotations - resolved,
        byType: stats,
        byPriority,
        topTags
      }
    });

  } catch (error) {
    console.error('Error fetching annotation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/:id
 * @desc    Get a single annotation by ID
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const annotation = await Annotation.findOne({
      _id: id,
      user_id: req.user._id
    })
      .populate('related_highlights', 'text color category page_number')
      .populate('session_id', 'start_time end_time')
      .populate('material_id', 'title');

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found'
      });
    }

    res.json({
      success: true,
      data: annotation
    });

  } catch (error) {
    console.error('Error fetching annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch annotation',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/annotations/:id
 * @desc    Update an annotation
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find and verify ownership
    const annotation = await Annotation.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found or unauthorized'
      });
    }

    // Don't allow changing critical fields
    delete updates.user_id;
    delete updates.session_id;
    delete updates.material_id;

    // Update annotation
    Object.assign(annotation, updates);
    await annotation.save();

    res.json({
      success: true,
      message: 'Annotation updated successfully',
      data: annotation
    });

  } catch (error) {
    console.error('Error updating annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update annotation',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/annotations/:id/resolve
 * @desc    Toggle annotation resolved status
 * @access  Private
 */
router.put('/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;

    const annotation = await Annotation.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found'
      });
    }

    await annotation.toggleResolved();

    res.json({
      success: true,
      message: `Annotation marked as ${annotation.is_resolved ? 'resolved' : 'unresolved'}`,
      data: annotation
    });

  } catch (error) {
    console.error('Error toggling resolved status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update annotation',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/annotations/:id/tags
 * @desc    Add a tag to annotation
 * @access  Private
 */
router.put('/:id/tags', async (req, res) => {
  try {
    const { id } = req.params;
    const { tag } = req.body;

    if (!tag) {
      return res.status(400).json({
        success: false,
        message: 'Tag is required'
      });
    }

    const annotation = await Annotation.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found'
      });
    }

    await annotation.addTag(tag);

    res.json({
      success: true,
      message: 'Tag added successfully',
      data: annotation
    });

  } catch (error) {
    console.error('Error adding tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add tag',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/annotations/:id/tags/:tag
 * @desc    Remove a tag from annotation
 * @access  Private
 */
router.delete('/:id/tags/:tag', async (req, res) => {
  try {
    const { id, tag } = req.params;

    const annotation = await Annotation.findOne({
      _id: id,
      user_id: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found'
      });
    }

    await annotation.removeTag(tag);

    res.json({
      success: true,
      message: 'Tag removed successfully',
      data: annotation
    });

  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove tag',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/annotations/:id/priority
 * @desc    Update annotation priority
 * @access  Private
 */
router.put('/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    if (!priority || !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid priority. Must be: low, medium, or high'
      });
    }

    const annotation = await Annotation.findOneAndUpdate(
      { _id: id, user_id: req.user._id },
      { priority },
      { new: true, runValidators: true }
    );

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found'
      });
    }

    res.json({
      success: true,
      message: 'Priority updated successfully',
      data: annotation
    });

  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update priority',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/annotations/:id
 * @desc    Delete an annotation
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const annotation = await Annotation.findOneAndDelete({
      _id: id,
      user_id: req.user._id
    });

    if (!annotation) {
      return res.status(404).json({
        success: false,
        message: 'Annotation not found or unauthorized'
      });
    }

    res.json({
      success: true,
      message: 'Annotation deleted successfully',
      data: { id }
    });

  } catch (error) {
    console.error('Error deleting annotation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete annotation',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/annotations/session/:sessionId
 * @desc    Delete all annotations for a session
 * @access  Private
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await Annotation.deleteMany({
      session_id: sessionId,
      user_id: req.user._id
    });

    res.json({
      success: true,
      message: `${result.deletedCount} annotations deleted successfully`,
      deletedCount: result.deletedCount
    });

  } catch (error) {
    console.error('Error deleting annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete annotations',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/annotations/export
 * @desc    Export annotations in various formats
 * @access  Private
 */
router.post('/export', async (req, res) => {
  try {
    const { sessionId, materialId, format = 'json', type, resolved } = req.body;

    const query = { user_id: req.user._id };
    if (sessionId) query.session_id = sessionId;
    if (materialId) query.material_id = materialId;
    if (type) query.type = type;
    if (resolved !== undefined) query.is_resolved = resolved;

    const annotations = await Annotation.find(query)
      .sort({ page_number: 1, createdAt: 1 })
      .populate('material_id', 'title')
      .lean();

    let exportData;
    let contentType;
    let filename;

    switch (format.toLowerCase()) {
      case 'json':
        exportData = JSON.stringify(annotations, null, 2);
        contentType = 'application/json';
        filename = `annotations_${Date.now()}.json`;
        break;

      case 'csv':
        const csvHeader = 'Page,Type,Content,Tags,Priority,Resolved,Date\n';
        const csvRows = annotations.map(a =>
          `"${a.page_number}","${a.type}","${a.content.replace(/"/g, '""')}","${a.tags.join(', ')}","${a.priority}","${a.is_resolved}","${a.createdAt}"`
        ).join('\n');
        exportData = csvHeader + csvRows;
        contentType = 'text/csv';
        filename = `annotations_${Date.now()}.csv`;
        break;

      case 'markdown':
        exportData = annotations.map(a =>
          `## Page ${a.page_number} - ${a.type.toUpperCase()}\n\n` +
          `${a.content}\n\n` +
          (a.tags.length ? `**Tags:** ${a.tags.join(', ')}\n` : '') +
          `**Priority:** ${a.priority} | **Status:** ${a.is_resolved ? '✅ Resolved' : '⏳ Unresolved'}\n\n` +
          `*Date: ${new Date(a.createdAt).toLocaleDateString()}*\n\n---\n\n`
        ).join('');
        contentType = 'text/markdown';
        filename = `annotations_${Date.now()}.md`;
        break;

      case 'txt':
        exportData = annotations.map(a =>
          `Page ${a.page_number} [${a.type}] - ${a.priority.toUpperCase()} PRIORITY\n` +
          `${a.content}\n` +
          (a.tags.length ? `Tags: ${a.tags.join(', ')}\n` : '') +
          `Status: ${a.is_resolved ? 'Resolved' : 'Unresolved'}\n` +
          `---\n\n`
        ).join('');
        contentType = 'text/plain';
        filename = `annotations_${Date.now()}.txt`;
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
    console.error('Error exporting annotations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export annotations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/annotations/user/summary
 * @desc    Get user's overall annotation summary
 * @access  Private
 */
router.get('/user/summary', async (req, res) => {
  try {
    const total = await Annotation.countDocuments({ user_id: req.user._id });
    const resolved = await Annotation.countDocuments({ 
      user_id: req.user._id, 
      is_resolved: true 
    });

    const byType = await Annotation.getStatsByType(req.user._id);

    const recentAnnotations = await Annotation.find({ user_id: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('material_id', 'title');

    const allTags = await Annotation.aggregate([
      { $match: { user_id: mongoose.Types.ObjectId(req.user._id) } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    res.json({
      success: true,
      data: {
        total,
        resolved,
        unresolved: total - resolved,
        byType,
        recentAnnotations,
        topTags: allTags
      }
    });

  } catch (error) {
    console.error('Error fetching user summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary',
      error: error.message
    });
  }
});

export default router;
