import multer from 'multer';
import { FileService } from '../services/fileService';

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = await FileService.ensureUploadDirectory();
      cb(null, uploadDir);
    } catch (error) {
      cb(error, './uploads');
    }
  },
  filename: (req, file, cb) => {
    const filename = FileService.generateFilename(file.originalname);
    cb(null, filename);
  }
});

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});