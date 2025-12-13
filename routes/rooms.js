// FILE PATH: backend/routes/rooms.js
// --- PASTE THIS ENTIRE, COMPLETE FILE ---

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import Room from '../models/Room.js';
import Session from '../models/Session.js';
import User from '../models/User.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';
import { sendRoomInvitation } from '../services/emailService.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/* =========================================================
   CREATE ROOM 
   ========================================================= */
router.post('/', authenticateToken, requireRole('teacher'), [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('subject').optional().trim(),
    body('start_time').optional().trim(),
    body('end_time').optional().trim(),
], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const code = await Room.generateUniqueCode();
        const { title, subject, start_time, end_time } = req.body;
        const room = new Room({ title, code, teacher_id: req.user._id, settings: { allow_student_pdfs: true, require_webcam: true, auto_end_sessions: false } });
        if (subject) room.subject = subject;
        if (start_time) room.start_time = start_time;
        if (end_time) room.end_time = end_time;
        if (req.files && req.files.pdf) {
            const pdf = req.files.pdf;
            if (!pdf.mimetype.includes('pdf')) return res.status(400).json({ message: 'Only PDF files allowed' });
            const uploadDir = path.join(__dirname, '..', 'uploads', 'pdfs');
            await fs.mkdir(uploadDir, { recursive: true });
            const filename = `${room._id || Date.now()}_${pdf.name}`;
            const filepath = path.join(uploadDir, filename);
            await pdf.mv(filepath);
            room.pdf_path = `/uploads/pdfs/${filename}`;  ;
            room.pdf_name = pdf.name;
            room.pdf_uploaded_at = new Date();
        }
        await room.save();
        res.status(201).json({ message: 'Room created successfully', room });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   GET ALL ROOMS
   ========================================================= */
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let rooms;
    if (req.user.role === 'teacher') {
      rooms = await Room.find({ teacher_id: req.user._id }).populate('allowed_students', 'name email').sort({ createdAt: -1 });
    } else {
      rooms = await Room.find({ allowed_students: req.user._id, is_active: true }).populate('teacher_id', 'name email').sort({ createdAt: -1 });
    }
    res.json({ rooms });
  } catch (error) {
    next(error);
  }
});

/* =========================================================
   GET ROOM DETAILS
   ========================================================= */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('teacher_id', 'name email')
      .populate('allowed_students', 'name email');
    if (!room) return res.status(404).json({ message: 'Room not found' });

    // ======================================================================
    // FIX: Replaced the custom method with a more reliable direct array check.
    // This directly checks if the user's ID is in the list of allowed students
    // after it has been populated, fixing the 403 Forbidden error.
    // ======================================================================
    const isStudentInRoom = room.allowed_students.some(student => student._id.toString() === req.user._id.toString());

    if (req.user.role === 'student' && !isStudentInRoom) {
      return res.status(403).json({ message: 'Access denied. You are not a member of this room.' });
    }
    if (req.user.role === 'teacher' && room.teacher_id._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied. You are not the teacher for this room.' });
    }
    
    res.json({ success: true, room });
  } catch (error) {
    next(error);
  }
});

/* =========================================================
   UPDATE ROOM
   ========================================================= */
router.put('/:id', authenticateToken, requireRole('teacher'), async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
        const { title, subject, start_time, end_time, is_active } = req.body;
        if (title) room.title = title;
        if (subject) room.subject = subject;
        if (start_time) room.start_time = start_time;
        if (end_time) room.end_time = end_time;
        if (typeof is_active !== 'undefined') room.is_active = is_active;
        await room.save();
        res.json({ message: 'Room updated successfully', room });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   DELETE ROOM
   ========================================================= */
router.delete('/:id', authenticateToken, requireRole('teacher'), async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
        if (room.pdf_path) {
            try { await fs.unlink(room.pdf_path); } catch (error) { console.error('Error deleting PDF:', error); }
        }
        await Room.findByIdAndDelete(req.params.id);
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   JOIN ROOM (Student)
   ========================================================= */
router.post('/join', authenticateToken, requireRole('student'), [body('code').trim().notEmpty()], async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { code } = req.body;
        const room = await Room.findOne({ code, is_active: true });
        if (!room) return res.status(404).json({ message: 'Room not found or inactive' });
        if (room.isStudentAllowed(req.user._id)) return res.status(400).json({ message: 'Already joined this room' });
        room.addStudent(req.user._id);
        await room.save();
        res.json({ message: 'Successfully joined room', room });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   ADD STUDENT (Teacher)
   ========================================================= */
router.post('/:id/add-student', authenticateToken, requireRole('teacher'), [body('studentEmail').isEmail().normalizeEmail()], async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
        const student = await User.findOne({ email: req.body.studentEmail, role: 'student' });
        if (!student) return res.status(404).json({ message: 'Student not found' });
        if (room.isStudentAllowed(student._id)) return res.status(400).json({ message: 'Student already in this room' });
        room.addStudent(student._id);
        await room.save();
        try { await sendRoomInvitation(student.email, room.title, room.code, req.user.name); } catch (emailError) { console.error('Email service unavailable:', emailError); }
        res.json({ message: 'Student added successfully', room });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   REMOVE STUDENT
   ========================================================= */
router.post('/:id/remove-student', authenticateToken, requireRole('teacher'), [body('studentId').notEmpty()], async (req, res, next) => {
    try {
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
        room.removeStudent(req.body.studentId);
        await room.save();
        res.json({ message: 'Student removed successfully', room });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   UPLOAD PDF (After Room Creation)
   ========================================================= */
router.post('/:id/pdf/upload', authenticateToken, requireRole('teacher'), async (req, res, next) => {
    try {
        if (!req.files || !req.files.pdf) return res.status(400).json({ message: 'No PDF file uploaded' });
        const room = await Room.findById(req.params.id);
        if (!room) return res.status(404).json({ message: 'Room not found' });
        if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
        const pdf = req.files.pdf;
        if (!pdf.mimetype.includes('pdf')) return res.status(400).json({ message: 'Only PDF files allowed' });
        const uploadDir = path.join(__dirname, '..', 'uploads', 'pdfs');
        await fs.mkdir(uploadDir, { recursive: true });
        const filename = `${room._id}_${Date.now()}.pdf`;
        const filepath = path.join(uploadDir, filename);
        await pdf.mv(filepath);
        if (room.pdf_path) {
            try { await fs.unlink(room.pdf_path); } catch (error) { console.error('Error deleting old PDF:', error); }
        }
        room.pdf_path = `/uploads/pdfs/${filename}`;;
        room.pdf_name = pdf.name;
        room.pdf_uploaded_at = new Date();
        await room.save();
        if (req.app.get('io')) {
            req.app.get('io').to(room._id.toString()).emit('pdf-uploaded', { roomId: room._id, pdfName: pdf.name });
        }
        res.json({ message: 'PDF uploaded successfully', pdf: { name: pdf.name, size: pdf.size } });
    } catch (error) {
        next(error);
    }
});

/* =========================================================
   GET ROOM PDF (For viewing in student/teacher session)
   ========================================================= */
router.get('/:id/pdf', authenticateToken, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (req.user.role === 'student' && !room.isStudentAllowed(req.user._id)) return res.status(403).json({ message: 'Access denied' });
    if (req.user.role === 'teacher' && room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
    if (!room.pdf_path) return res.status(404).json({ message: 'No PDF uploaded for this room' });
    try {
      await fs.access(room.pdf_path);
    } catch (error) {
      return res.status(404).json({ message: 'PDF file not found on server' });
    }
    res.sendFile(room.pdf_path);
  } catch (error) {
    console.error('Error fetching PDF:', error);
    next(error);
  }
});

/* =========================================================
   GET ROOM STUDENTS (Teacher only)
   ========================================================= */
router.get('/:id/students', authenticateToken, requireRole('teacher'), async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate('allowed_students', 'name email');
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
    res.json({ students: room.allowed_students });
  } catch (error) {
    next(error);
  }
});

/* =========================================================
   GET ROOM METRICS (Teacher only)
   ========================================================= */
router.get('/:id/metrics', authenticateToken, requireRole('teacher'), async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (room.teacher_id.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Access denied' });
    const sessions = await Session.find({ room_id: room._id });
    const metrics = {
      totalStudents: room.allowed_students.length,
      totalSessions: sessions.length,
      averageDuration: sessions.length > 0 ? sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / sessions.length : 0,
      lastSession: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null,
    };
    res.json({ metrics });
  } catch (error) {
    next(error);
  }
});

/* =========================================================
   GET ROOM STATS (All rooms stats for teacher)
   ========================================================= */
router.get('/stats', authenticateToken, requireRole('teacher'), async (req, res, next) => {
  try {
    const rooms = await Room.find({ teacher_id: req.user._id });
    const stats = {
      totalRooms: rooms.length,
      activeRooms: rooms.filter(r => r.is_active).length,
      totalStudents: rooms.reduce((sum, r) => sum + r.allowed_students.length, 0),
      roomsWithPDF: rooms.filter(r => r.pdf_path).length,
    };
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

export default router;