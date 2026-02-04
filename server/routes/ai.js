import express from 'express';
import { translateText } from '../services/translate.js';
import { detectLanguage } from '../services/detect.js';
import { generateMedicalSummary, generateConversationName } from '../services/openai.js';
import Conversation from '../models/Conversation.js';
import { getClientErrorMessage } from '../utils/safeError.js';

const router = express.Router();

router.post('/detect', (req, res) => {
  try {
    const { text } = req.body;
    const lang = detectLanguage(text || '');
    res.json({ lang });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

router.post('/translate', async (req, res) => {
  try {
    let { text, fromLang, toLang } = req.body;
    text = text || '';
    if (fromLang === 'auto') fromLang = detectLanguage(text) || 'en';
    fromLang = fromLang || 'en';
    toLang = toLang || 'en';
    const translated = await translateText(text, fromLang, toLang);
    res.json({ translated });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

router.post('/summarize/:conversationId', async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.conversationId);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    
    // Generate summary and name in parallel
    const [summary, generatedName] = await Promise.all([
      generateMedicalSummary(conv.messages),
      // Only generate name if not already set
      !conv.name ? generateConversationName(conv.messages) : Promise.resolve(conv.name),
    ]);
    
    conv.summary = summary;
    conv.summaryGeneratedAt = new Date();
    if (generatedName && !conv.name) {
      conv.name = generatedName;
    }
    await conv.save();
    res.json({ summary, name: conv.name });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: getClientErrorMessage(err) });
  }
});

export default router;
