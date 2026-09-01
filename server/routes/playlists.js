import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Get all playlists
router.get('/', (req, res) => {
  const playlists = db.get('playlists') || [];
  res.json(playlists);
});

// Create a new playlist
router.post('/', (req, res) => {
  const { name, tracks = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Playlist name is required' });

  const playlists = db.get('playlists') || [];
  const newPlaylist = {
    id: 'pl_' + Date.now(),
    name: name.trim(),
    tracks: tracks,
    createdAt: new Date().toISOString()
  };

  playlists.unshift(newPlaylist);
  db.set('playlists', playlists);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('PLAYLISTS_UPDATED', playlists);
  }

  res.json({ success: true, playlist: newPlaylist });
});

// Update playlist (name or tracks re-ordering / additions)
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, tracks } = req.body;

  const playlists = db.get('playlists') || [];
  const index = playlists.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  if (name !== undefined) playlists[index].name = name.trim();
  if (tracks !== undefined) playlists[index].tracks = tracks;
  playlists[index].updatedAt = new Date().toISOString();

  db.set('playlists', playlists);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('PLAYLISTS_UPDATED', playlists);
  }

  res.json({ success: true, playlist: playlists[index] });
});

// Add track to playlist
router.post('/:id/tracks', (req, res) => {
  const { id } = req.params;
  const { track } = req.body;

  if (!track) return res.status(400).json({ error: 'Track is required' });

  const playlists = db.get('playlists') || [];
  const index = playlists.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Playlist not found' });
  }

  const currentTracks = playlists[index].tracks || [];
  // Avoid duplicate track additions
  const exists = currentTracks.some(t => t.id === track.id || t.path === track.path);
  if (!exists) {
    currentTracks.push(track);
    playlists[index].tracks = currentTracks;
    db.set('playlists', playlists);

    if (req.app.get('wssBroadcast')) {
      req.app.get('wssBroadcast')('PLAYLISTS_UPDATED', playlists);
    }
  }

  res.json({ success: true, playlist: playlists[index] });
});

// Delete playlist
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const playlists = db.get('playlists') || [];
  const updatedPlaylists = playlists.filter(p => p.id !== id);

  db.set('playlists', updatedPlaylists);

  if (req.app.get('wssBroadcast')) {
    req.app.get('wssBroadcast')('PLAYLISTS_UPDATED', updatedPlaylists);
  }

  res.json({ success: true, id });
});

export default router;
