import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isVercel = Boolean(process.env.VERCEL);

// On Vercel use memory (no disk); otherwise disk storage
const uploadDir = path.join(__dirname, '../uploads');
if (!isVercel && !fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `audio-${unique}${path.extname(file.originalname) || '.webm'}`);
  },
});

const storage = isVercel ? multer.memoryStorage() : diskStorage;

export const uploadAudio = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(webm|ogg|mp3|wav|m4a)$/i.test(file.originalname) ||
      file.mimetype?.startsWith('audio/');
    cb(null, !!allowed);
  },
});

const memoryStorage = multer.memoryStorage();
export const uploadFile = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
});
