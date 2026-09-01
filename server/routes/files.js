import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../db.js';
import { resolveStoragePath } from './system.js';

// Clean filename generator - preserves exact original filename without random hashes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const rootDir = resolveStoragePath();
    const subfolder = req.query.folder || req.body.folder || '';
    const targetDir = path.join(rootDir, subfolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const rootDir = resolveStoragePath();
    const subfolder = req.query.folder || req.body.folder || '';
    const targetDir = path.join(rootDir, subfolder);
    
    // Sanitize filename while preserving exact user filename
    let cleanName = path.basename(file.originalname).replace(/[^a-zA-Z0-9.\-_ ()]/g, '_');
    if (!cleanName) cleanName = 'file_' + Date.now() + path.extname(file.originalname);

    let finalPath = path.join(targetDir, cleanName);
    let counter = 1;
    const ext = path.extname(cleanName);
    const base = path.basename(cleanName, ext);

    // Append (1), (2) if file already exists instead of ugly random hashes
    while (fs.existsSync(finalPath)) {
      cleanName = `${base} (${counter})${ext}`;
      finalPath = path.join(targetDir, cleanName);
      counter++;
    }

    cb(null, cleanName);
  }
});

const upload = multer({ storage });
const router = express.Router();

// Helper to format actual POSIX file permissions
function getPosixPermissions(stats) {
  const isDir = stats.isDirectory() ? 'd' : '-';
  const mode = stats.mode;
  const owner = (mode & 0o400 ? 'r' : '-') + (mode & 0o200 ? 'w' : '-') + (mode & 0o100 ? 'x' : '-');
  const group = (mode & 0o040 ? 'r' : '-') + (mode & 0o020 ? 'w' : '-') + (mode & 0o010 ? 'x' : '-');
  const others = (mode & 0o004 ? 'r' : '-') + (mode & 0o002 ? 'w' : '-') + (mode & 0o001 ? 'x' : '-');
  return `${isDir}${owner}${group}${others}`;
}

// Helper to build a recursive file tree structure with real permissions
function buildFileTree(dirPath, relativePath = '') {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  return entries.map(entry => {
    const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    const fullPath = path.join(dirPath, entry.name);

    try {
      const stats = fs.statSync(fullPath);
      const permissions = getPosixPermissions(stats);

      if (entry.isDirectory()) {
        const children = buildFileTree(fullPath, entryRelPath);
        return {
          id: entryRelPath,
          name: entry.name,
          path: entryRelPath,
          isDir: true,
          type: 'folder',
          size: stats.size,
          permissions,
          uploadDate: stats.mtime.toISOString(),
          itemCount: children.length,
          children
        };
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        let fileType = 'other';
        if (['.mp4', '.mkv', '.webm', '.avi', '.mov'].includes(ext)) fileType = 'video';
        else if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext)) fileType = 'audio';
        else if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) fileType = 'image';

        return {
          id: entryRelPath,
          name: entry.name,
          originalname: entry.name,
          filename: entry.name,
          path: entryRelPath,
          size: stats.size,
          type: fileType,
          isDir: false,
          permissions,
          uploadDate: stats.mtime.toISOString(),
          url: `/uploads/${entryRelPath}`
        };
      }
    } catch (e) {
      return null;
    }
  }).filter(Boolean);
}

// Get list of storage files (tree or list format)
router.get('/', (req, res) => {
  const storageDir = resolveStoragePath();
  const dbMedia = db.get('media') || [];

  try {
    if (fs.existsSync(storageDir)) {
      const tree = buildFileTree(storageDir);

      const getFlatFiles = (nodes) => {
        let acc = [];
        nodes.forEach(node => {
          if (node.isDir) {
            acc = acc.concat(getFlatFiles(node.children || []));
          } else {
            acc.push(node);
          }
        });
        return acc;
      };

      const flatFiles = getFlatFiles(tree);
      flatFiles.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

      if (req.query.format === 'tree') {
        return res.json({ tree, flatFiles });
      }
      return res.json(flatFiles);
    }
  } catch (err) {
    console.error('[FILES] Error reading storage directory:', err);
  }

  res.json(dbMedia);
});

// Create new subfolder inside storage node
router.post('/folder', (req, res) => {
  const { folderName, parentPath = '' } = req.body;
  if (!folderName) return res.status(400).json({ error: 'Folder name is required' });

  const rootDir = resolveStoragePath();
  const targetDir = path.join(rootDir, parentPath, folderName.trim());

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const mediaList = db.get('media') || [];
    if (req.app.get('wssBroadcast')) {
      req.app.get('wssBroadcast')('MEDIA_UPDATED', mediaList);
    }
    res.json({ success: true, path: path.join(parentPath, folderName.trim()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload file to SD card storage
router.post('/upload', upload.single('mediaFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const { originalname, filename, mimetype, size } = req.file;
  const relFolder = req.query.folder || '';
  const relPath = relFolder ? `${relFolder}/${filename}` : filename;

  let fileType = 'other';
  if (mimetype.startsWith('video/')) fileType = 'video';
  else if (mimetype.startsWith('audio/')) fileType = 'audio';
  else if (mimetype.startsWith('image/')) fileType = 'image';

  const newItem = {
    id: relPath,
    originalname: filename,
    filename,
    path: relPath,
    mimetype,
    size,
    type: fileType,
    uploadDate: new Date().toISOString(),
    url: `/uploads/${relPath}`
  };

  const mediaList = db.get('media') || [];
  mediaList.unshift(newItem);
  db.set('media', mediaList);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('MEDIA_UPDATED', mediaList);
  }

  res.json({ success: true, file: newItem });
});

// Rename file or directory
router.post('/rename', (req, res) => {
  const { oldPath, newName } = req.body;
  if (!oldPath || !newName) {
    return res.status(400).json({ error: 'oldPath and newName are required' });
  }

  const rootDir = resolveStoragePath();
  const decodedOldPath = decodeURIComponent(oldPath);
  const oldFullPath = path.join(rootDir, decodedOldPath);
  
  const parentDir = path.dirname(oldFullPath);
  const newFullPath = path.join(parentDir, newName.trim());
  const newRelPath = path.relative(rootDir, newFullPath);

  if (!fs.existsSync(oldFullPath)) {
    return res.status(404).json({ error: 'File or folder does not exist' });
  }

  try {
    fs.renameSync(oldFullPath, newFullPath);

    // Update media database if applicable
    const mediaList = db.get('media') || [];
    let updated = false;
    mediaList.forEach(item => {
      if (item.path === decodedOldPath || item.id === decodedOldPath) {
        item.path = newRelPath;
        item.filename = newName.trim();
        item.originalname = newName.trim();
        item.id = newRelPath;
        item.url = `/uploads/${newRelPath}`;
        updated = true;
      }
    });

    if (updated) {
      db.set('media', mediaList);
    }

    if (req.app.get('wssBroadcast')) {
      req.app.get('wssBroadcast')('MEDIA_UPDATED', mediaList);
    }

    res.json({ success: true, oldPath: decodedOldPath, newPath: newRelPath, newName: newName.trim() });
  } catch (err) {
    console.error('[FILES] Rename error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Robust Delete File or Directory Endpoint (Handles query params or wildcard paths)
const handleDelete = (req, res) => {
  const targetPath = req.query.path || req.params[0] || req.params.id;
  if (!targetPath) {
    return res.status(400).json({ error: 'No path specified for deletion' });
  }

  const rootDir = resolveStoragePath();
  const decodedPath = decodeURIComponent(targetPath).replace(/^file_|^dir_/, '');
  const fullPath = path.join(rootDir, decodedPath);

  const mediaList = db.get('media') || [];
  const updatedMedia = mediaList.filter(item => item.path !== decodedPath && item.id !== decodedPath && item.filename !== decodedPath);
  db.set('media', updatedMedia);

  if (fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fullPath);
      }
      console.log(`[FILES] Deleted path: ${decodedPath}`);
    } catch (e) {
      console.error('[FILES] Error deleting path:', e);
      return res.status(500).json({ error: 'Failed to delete file/folder: ' + e.message });
    }
  }

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('MEDIA_UPDATED', updatedMedia);
  }

  res.json({ success: true, path: decodedPath });
};

router.delete('/item', handleDelete);
router.delete('/:id', handleDelete);
router.delete('/*', handleDelete);

export default router;
