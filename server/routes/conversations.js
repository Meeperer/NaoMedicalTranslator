import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Conversation from '../models/Conversation.js';
import { translateText } from '../services/translate.js';
import { detectLanguage } from '../services/detect.js';
import { uploadAudio } from '../config/multer.js';
import { getClientErrorMessage } from '../utils/safeError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// List conversations
router.get('/', async (req, res) => {
  try {
    const list = await Conversation.find()
      .sort({ updatedAt: -1 })
      .select('name doctorLanguage patientLanguage summary createdAt updatedAt')
      .limit(100)
      .lean();
    res.json(list);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Create conversation
router.post('/', async (req, res) => {
  try {
    const { doctorLanguage = 'en', patientLanguage = 'es' } = req.body;
    const conv = await Conversation.create({ doctorLanguage, patientLanguage });
    res.status(201).json(conv);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Search conversations (must be before /:id so "search" is not treated as an id)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ results: [] });
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const conversations = await Conversation.find({
      $or: [
        { 'messages.content': regex },
        { 'messages.translatedContent': regex },
      ],
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    const results = conversations.map((c) => {
      const matches = [];
      (c.messages || []).forEach((m, i) => {
        const text = `${m.content || ''} ${m.translatedContent || ''}`;
        if (regex.test(text)) {
          const idx = text.toLowerCase().indexOf(q.toLowerCase());
          const start = Math.max(0, idx - 40);
          const end = Math.min(text.length, idx + q.length + 80);
          matches.push({
            messageIndex: i,
            role: m.role,
            excerpt: (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : ''),
            timestamp: m.timestamp,
          });
        }
      });
      return { conversationId: c._id, createdAt: c.createdAt, matches };
    });
    res.json({ results });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Get one conversation
router.get('/:id', async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Update conversation name
router.patch('/:id', async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const { name } = req.body;
    if (typeof name === 'string') {
      conv.name = name.trim();
      conv.updatedAt = new Date();
      await conv.save();
    }
    res.json({ name: conv.name });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Add text message (and translate)
router.post('/:id/messages', async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const { role, content, fromLang: bodyFromLang, toLang: bodyToLang } = req.body;
    let fromLang = bodyFromLang ?? (role === 'doctor' ? conv.doctorLanguage : conv.patientLanguage);
    if (fromLang === 'auto') fromLang = detectLanguage(content || '') || (role === 'doctor' ? conv.doctorLanguage : conv.patientLanguage);
    const toLang = bodyToLang ?? (role === 'doctor' ? conv.patientLanguage : conv.doctorLanguage);
    const translatedContent = await translateText(content, fromLang, toLang);
    conv.messages.push({
      role,
      content: content || '',
      translatedContent: translatedContent ?? '',
      sourceLanguage: fromLang,
      targetLanguage: toLang,
      type: 'text',
      timestamp: new Date(),
    });
    conv.updatedAt = new Date();
    await conv.save();
    const added = conv.messages[conv.messages.length - 1];
    res.status(201).json(added.toObject ? added.toObject() : added);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

// Upload audio and add as message
router.post('/:id/audio', uploadAudio.single('audio'), async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    const role = req.body.role || 'patient';
    let audioUrl;
    if (process.env.VERCEL && req.file.buffer) {
      const { put } = await import('@vercel/blob');
      const ext = req.file.originalname?.match(/\.[a-z0-9]+$/i)?.[0] || '.webm';
      const blob = await put(`audio-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`, req.file.buffer, { access: 'public' });
      audioUrl = blob.url;
    } else {
      audioUrl = `/uploads/${req.file.filename}`;
    }
    conv.messages.push({
      role,
      content: '',
      translatedContent: '',
      type: 'audio',
      audioUrl,
      audioDuration: Number(req.body.duration) || 0,
      timestamp: new Date(),
    });
    conv.updatedAt = new Date();
    await conv.save();
    const added = conv.messages[conv.messages.length - 1];
    res.status(201).json(added);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

export default router;
