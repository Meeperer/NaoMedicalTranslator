import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['doctor', 'patient'], required: true },
  content: { type: String, default: '' },
  translatedContent: { type: String, default: '' },
  sourceLanguage: { type: String, default: 'en' },
  targetLanguage: { type: String, default: 'en' },
  type: { type: String, enum: ['text', 'audio'], default: 'text' },
  audioUrl: { type: String },
  audioDuration: { type: Number },
  timestamp: { type: Date, default: Date.now },
});

const conversationSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  doctorLanguage: { type: String, default: 'en' },
  patientLanguage: { type: String, default: 'es' },
  messages: [messageSchema],
  summary: { type: String },
  summaryGeneratedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

conversationSchema.index({ createdAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
