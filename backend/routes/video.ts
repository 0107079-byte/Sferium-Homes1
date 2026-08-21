/**
 * Express router for video metadata extraction and stream resolution
 */

import { Router } from 'express';
import { extractVideoId } from '../../src/utils/extractVideoId';
import { normalizeUrl } from '../../src/utils/normalizeUrl';

export const videoRouter = Router();

// GET /api/video/info?url=...
videoRouter.get('/info', async (req, res) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing required query parameter "url"' });
  }

  const normalized = normalizeUrl(rawUrl);
  const parsed = extractVideoId(normalized);

  if (!parsed) {
    return res.status(400).json({
      error: 'Unsupported or invalid video URL',
      supported: ['youtube', 'vk', 'rutube'],
    });
  }

  let title = 'Видео';
  let duration = 0;
  let thumbnail = '';

  // Fetch oEmbed or metadata if available
  try {
    if (parsed.platform === 'youtube') {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(normalized)}&format=json`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title || title;
        thumbnail = data.thumbnail_url || `https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg`;
      } else {
        thumbnail = `https://img.youtube.com/vi/${parsed.id}/hqdefault.jpg`;
      }
    } else if (parsed.platform === 'rutube') {
      const oembedRes = await fetch(`https://rutube.ru/api/oembed/?url=${encodeURIComponent(normalized)}&format=json`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title || title;
        thumbnail = data.thumbnail_url || '';
        duration = data.duration || 0;
      }
    }
  } catch (e) {
    console.warn('[video/info] Failed to fetch oembed metadata:', e);
  }

  return res.json({
    success: true,
    url: normalized,
    platform: parsed.platform,
    id: parsed.id,
    embedUrl: parsed.embedUrl,
    title,
    thumbnail,
    duration,
  });
});

// GET /api/video/resolve?url=...
videoRouter.get('/resolve', (req, res) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) {
    return res.status(400).json({ error: 'Missing query param "url"' });
  }

  const normalized = normalizeUrl(rawUrl);
  const parsed = extractVideoId(normalized);

  if (!parsed) {
    return res.status(400).json({ error: 'Invalid or unsupported video URL' });
  }

  return res.json({
    url: normalized,
    platform: parsed.platform,
    id: parsed.id,
    embedUrl: parsed.embedUrl,
  });
});

export default videoRouter;
