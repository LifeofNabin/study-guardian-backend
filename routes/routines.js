// FILE PATH: backend/routes/routines.js
// ✅ COMPLETE VERSION: Fixed GET routes to return PDF information
import express from 'express';
import Routine from '../models/Routine.js';
import Session from '../models/Session.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// -----------------------------------------------------------
// MULTER CONFIGURATION for PDF uploads (existing - for rooms)
// -----------------------------------------------------------
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.resolve(process.cwd(), 'uploads', 'pdfs');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const uniqueName = `${file.fieldname}-${uniqueSuffix}${extension}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// -----------------------------------------------------------
// ✅ MULTER CONFIGURATION FOR ROUTINE BULK UPLOADS
// -----------------------------------------------------------
const routineStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.resolve(process.cwd(), 'uploads', 'routines');
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const uniqueName = `routine-${uniqueSuffix}${extension}`;
    cb(null, uniqueName);
  },
});

const routineUpload = multer({
  storage: routineStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// =======================================================================
// ✅ BULK UPLOAD PDFs FOR STUDY MATERIALS
// =======================================================================
router.post(
  '/upload-pdfs',
  authenticateToken,
  requireRole('student'),
  routineUpload.array('pdfs', 3),
  async (req, res, next) => {
    try {
      console.log('📤 Uploading routine PDFs:', req.files?.length || 0);

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'No files uploaded' 
        });
      }

      const files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: `/uploads/routines/${file.filename}`,
        url: `/uploads/routines/${file.filename}`,
        size: file.size
      }));

      console.log('✅ Routine PDFs uploaded successfully:', files.length);

      res.json({ 
        success: true, 
        files,
        message: `${files.length} PDF(s) uploaded successfully`
      });

    } catch (error) {
      console.error('❌ Error uploading routine PDFs:', error);
      
      if (req.files) {
        for (const file of req.files) {
          try {
            await fs.unlink(file.path);
          } catch (unlinkError) {
            console.error('Failed to clean up file:', unlinkError);
          }
        }
      }
      
      res.status(500).json({ 
        success: false,
        message: 'Failed to upload PDFs',
        error: error.message 
      });
    }
  }
);

// =======================================================================
// ✅ UPLOAD PDF FOR A SPECIFIC SUBJECT
// =======================================================================
router.post(
  '/:id/upload-subject-pdf',
  authenticateToken,
  requireRole('student'),
  upload.single('pdf'),
  async (req, res, next) => {
    try {
      const { id: routineId } = req.params;
      const { subject_name } = req.body;

      console.log('📤 Upload subject PDF request:', { routineId, subject_name, hasFile: !!req.file });

      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No PDF file was uploaded.' });
      }

      if (!subject_name) {
        await fs.unlink(req.file.path);
        return res.status(400).json({ success: false, message: 'Subject name is required.' });
      }

      const routine = await Routine.findOne({
        _id: routineId,
        student_id: req.user.id,
      });

      if (!routine) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ success: false, message: 'Routine not found.' });
      }

      const subject = routine.subjects.find(s => s.name === subject_name);
      if (!subject) {
        await fs.unlink(req.file.path);
        return res.status(404).json({ success: false, message: 'Subject not found in this routine.' });
      }

      // Delete old PDF if exists
      if (subject.pdf_path) {
        try {
          const oldPath = path.resolve(process.cwd(), subject.pdf_path.replace(/^\//, ''));
          await fs.unlink(oldPath);
          console.log(`🗑️ Deleted old PDF: ${oldPath}`);
        } catch (err) {
          console.error(`Could not delete old PDF: ${err.message}`);
        }
      }

      // ✅ Update subject with new PDF info
      subject.pdf_path = `/uploads/pdfs/${req.file.filename}`;
      subject.pdf_name = req.file.originalname;
      subject.has_pdf = true; // ✅ Set flag
      
      await routine.save();

      console.log('✅ PDF uploaded successfully for subject:', subject_name);
      console.log('📄 PDF path:', subject.pdf_path);

      res.status(200).json({
        success: true,
        message: `PDF successfully uploaded for subject: ${subject_name}`,
        routine,
      });
    } catch (error) {
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          console.error('Failed to clean up uploaded file:', unlinkError);
        }
      }
      console.error('❌ Error in subject PDF upload route:', error);
      next(error);
    }
  }
);

// -----------------------------------------------------------
// ✅ FIXED: GET ALL ROUTINES - Returns complete subject data with PDFs
// -----------------------------------------------------------
router.get('/', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const routines = await Routine.find({ student_id: req.user.id })
      .sort({ created_at: -1 })
      .lean();
    
    // ✅ Ensure PDF flags are set correctly for each subject
    const routinesWithPDFFlags = routines.map(routine => ({
      ...routine,
      subjects: (routine.subjects || []).map(subject => ({
        ...subject,
        has_pdf: !!(subject.pdf_path || subject.pdf_name), // ✅ Compute has_pdf flag
        pdf_url: subject.pdf_path // ✅ Add pdf_url alias
      }))
    }));

    console.log('✅ Fetched routines with PDF data:', routinesWithPDFFlags.length);
    
    res.json({ 
      success: true, 
      count: routinesWithPDFFlags.length, 
      routines: routinesWithPDFFlags 
    });
  } catch (error) {
    console.error('❌ Error fetching routines:', error);
    next(error);
  }
});

// -----------------------------------------------------------
// ✅ FIXED: GET SINGLE ROUTINE - Returns complete subject data with PDFs
// -----------------------------------------------------------
router.get('/:id', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const routine = await Routine.findOne({
      _id: req.params.id,
      student_id: req.user.id,
    }).lean();

    if (!routine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    // ✅ Ensure PDF flags are set correctly for each subject
    const routineWithPDFFlags = {
      ...routine,
      subjects: (routine.subjects || []).map(subject => ({
        ...subject,
        has_pdf: !!(subject.pdf_path || subject.pdf_name), // ✅ Compute has_pdf flag
        pdf_url: subject.pdf_path // ✅ Add pdf_url alias
      }))
    };

    console.log('✅ Fetched routine with PDF data:', routineWithPDFFlags._id);

    res.json({ success: true, routine: routineWithPDFFlags });
  } catch (error) {
    console.error('❌ Error fetching routine:', error);
    next(error);
  }
});

// -----------------------------------------------------------
// CREATE ROUTINE
// -----------------------------------------------------------
router.post('/', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const { title, subjects, totalDuration } = req.body;

    if (!title || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Title and at least one subject are required.' });
    }

    const newRoutine = new Routine({
      student_id: req.user.id,
      title,
      type: req.body.type,
      start_date: req.body.start_date,
      end_date: req.body.end_date,
      subjects: subjects.map(s => ({
        name: s.name,
        target_hours: s.target_hours,
        has_pdf: false // ✅ Initialize as false
      })),
      times: req.body.times,
      days_of_week: req.body.days_of_week,
      totalDuration: req.body.totalDuration
    });

    const savedRoutine = await newRoutine.save();
    
    console.log('✅ Created routine:', savedRoutine._id);
    
    res.status(201).json({ success: true, routine: savedRoutine });
  } catch (error) {
    console.error('❌ Error creating routine:', error);
    next(error);
  }
});

// -----------------------------------------------------------
// UPDATE ROUTINE
// -----------------------------------------------------------
router.put('/:id', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const routine = await Routine.findOneAndUpdate(
      { _id: req.params.id, student_id: req.user.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!routine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    console.log('✅ Updated routine:', routine._id);

    res.json({ success: true, message: 'Routine updated successfully', routine });
  } catch (error) {
    console.error('❌ Error updating routine:', error);
    next(error);
  }
});

// -----------------------------------------------------------
// DELETE ROUTINE
// -----------------------------------------------------------
router.delete('/:id', authenticateToken, requireRole('student'), async (req, res, next) => {
  try {
    const routine = await Routine.findOneAndDelete({
      _id: req.params.id,
      student_id: req.user.id,
    });

    if (!routine) {
      return res.status(404).json({ success: false, message: 'Routine not found' });
    }

    // Clean up all associated PDFs
    const filesToDelete = [];

    if (routine.pdf_path) {
      filesToDelete.push(routine.pdf_path);
    }

    routine.subjects.forEach(subject => {
      if (subject.pdf_path) {
        filesToDelete.push(subject.pdf_path);
      }
    });

    for (const filePath of filesToDelete) {
      try {
        const fullPath = path.resolve(process.cwd(), filePath.replace(/^\//, ''));
        await fs.unlink(fullPath);
        console.log(`🗑️ Deleted file: ${fullPath}`);
      } catch (err) {
        console.log(`File not found or already deleted: ${filePath}`);
      }
    }

    console.log('✅ Deleted routine:', req.params.id);

    res.json({ success: true, message: 'Routine and associated files deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting routine:', error);
    next(error);
  }
});

export default router;