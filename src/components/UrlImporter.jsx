import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Download, AlertTriangle, Link } from 'lucide-react';
import * as api from '../services/api';

const platformEndpoints = {
  youtube: '/api/import/ytdlp',
  x: '/api/import/ytdlp',
  tiktok: '/api/import/ytdlp',
  reddit: '/api/import/ytdlp',
  instagram: '/api/import/instagram',
  playwright: '/api/import/playwright'
};

const platformBadges = {
  youtube: {
    label: 'YouTube',
    bg: 'bg-[#FF0000]/10 border-[#FF0000]/25 text-[#FF0000]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M23.498 6.163c-.272-.98-1.04-1.755-2.008-2.03C19.703 3.62 12 3.62 12 3.62s-7.703 0-9.49.512c-.967.275-1.736 1.05-2.008 2.03C0 7.973 0 12 0 12s0 4.027.502 5.837c.272.98 1.04 1.755 2.008 2.03C4.297 20.38 12 20.38 12 20.38s7.703 0 9.49-.513c.968-.274 1.736-1.05 2.008-2.03C24 16.027 24 12 24 12s0-4.027-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    )
  },
  instagram: {
    label: 'Instagram',
    bg: 'bg-gradient-to-r from-[#833ab4]/15 via-[#fd1d1d]/15 to-[#fcb045]/15 border-[#fd1d1d]/25 text-[#fd1d1d]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current fill-none stroke-[2.5]">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    )
  },
  x: {
    label: 'X (Twitter)',
    bg: 'bg-black/40 border-white/20 text-white',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },
  tiktok: {
    label: 'TikTok',
    bg: 'bg-black/40 border-white/20 text-white',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.02 1.62 4.17 1.22 1.32 2.97 2.09 4.77 2.23v3.88c-1.89-.09-3.72-.8-5.08-2.11-.11-.11-.21-.22-.31-.34V14.5c.02 2.3-.9 4.54-2.58 6.09A9.13 9.13 0 0 1 9 23c-2.42-.02-4.73-1.07-6.27-2.94a9.26 9.26 0 0 1-1.7-7.79A9.13 9.13 0 0 1 5.56 6.38a9.23 9.23 0 0 1 8.87.56V11.2a5.2 5.2 0 0 0-4.46-.72c-1.2.33-2.22 1.15-2.76 2.26A5.28 5.28 0 0 0 7 14.5c.01 1.45.68 2.82 1.8 3.69a5.19 5.19 0 0 0 6.64-.32 5.22 5.22 0 0 0 1.08-5.37V.02z"/>
      </svg>
    )
  },
  reddit: {
    label: 'Reddit',
    bg: 'bg-[#FF4500]/10 border-[#FF4500]/25 text-[#FF4500]',
    icon: (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
        <path d="M24 11.5c0-1.65-1.35-3-3-3-.96 0-1.86.48-2.42 1.24-1.64-1-3.85-1.64-6.23-1.72l1.24-3.92 3.65.77c.12 1.02 1 1.8 2.07 1.8 1.15 0 2.1-0.94 2.1-2.1s-0.95-2.1-2.1-2.1c-1.02 0-1.88.73-2.07 1.7l-3.99-.84c-.21-.04-.42.09-.48.3l-1.4 4.41c-2.43.04-4.69.69-6.37 1.71-.56-.74-1.44-1.21-2.43-1.21-1.65 0-3 1.35-3 3 0 1.17.68 2.18 1.66 2.67-.06.33-.09.68-.09 1.03 0 4.14 4.93 7.5 11 7.5s11-3.36 11-7.5c0-.35-.03-.7-.09-1.03.98-.49 1.66-1.5 1.66-2.67zM7.5 13c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zm9 6c-1.83 1.83-5.17 1.83-7 0-.19-.2-.19-.51 0-.71.2-.2.51-.2.71 0 1.43 1.43 4.14 1.43 5.58 0 .2-.2.51-.2.71 0 .2.2.2.51 0 .71zm-.5-3c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      </svg>
    )
  },
  playwright: {
    label: 'Web Page',
    bg: 'bg-white/5 border-white/10 text-white/60',
    icon: <Globe size={14} />
  }
};

function detectPlatform(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return 'youtube';
  }
  if (lowerUrl.includes('instagram.com')) {
    return 'instagram';
  }
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) {
    return 'x';
  }
  if (lowerUrl.includes('tiktok.com')) {
    return 'tiktok';
  }
  if (lowerUrl.includes('reddit.com')) {
    return 'reddit';
  }
  return 'playwright';
}

export default function UrlImporter({ onImportComplete }) {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  // Parse platform on input change
  useEffect(() => {
    setPlatform(detectPlatform(url));
  }, [url]);

  // Connect local WebSocket listener for active imports
  useEffect(() => {
    if (isImporting && currentJobId) {
      const wsUrl = `ws://${window.location.hostname || 'localhost'}:3001`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'download' && data.jobId === currentJobId) {
            setProgress({
              percent: data.percent || 0,
              speed: data.speed,
              eta: data.eta
            });
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }
  }, [isImporting, currentJobId]);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!platform || isImporting) return;

    setIsImporting(true);
    setError(null);
    setProgress({ percent: 0, speed: null, eta: null });

    const endpoint = platformEndpoints[platform];

    try {
      const res = await fetch(`${api.BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        const errPayload = await res.json().catch(() => ({}));
        throw new Error(errPayload.error || `Download request failed: ${res.status}`);
      }

      const importData = await res.json();
      setCurrentJobId(importData.jobId);

      // Perform ffprobe metadata mapping
      const videoInfo = await api.getVideoInfo(importData.filePath);
      const filename = importData.filePath.split(/[\\/]/).pop();

      // Trigger success callback
      if (onImportComplete) {
        onImportComplete({
          filePath: importData.filePath,
          videoUrl: importData.videoUrl,
          videoInfo,
          filename,
          importSource: platform
        });
      }

      // Reset
      setUrl('');
      setIsImporting(false);
      setProgress(null);
      setCurrentJobId(null);
    } catch (err) {
      console.error('Import failed:', err);
      setError(err.message || 'Failed to import video.');
      setIsImporting(false);
      setProgress(null);
      setCurrentJobId(null);
    }
  };

  const badgeConfig = platformBadges[platform];
  const isValidUrl = /^https?:\/\//i.test(url);

  return (
    <div className="glass-panel bg-[#0d0d12]/95 border border-white/5 rounded-2xl p-6 shadow-2xl w-full">
      <form onSubmit={handleImport} className="flex flex-col gap-4">
        {/* URL Input field */}
        <div className="relative flex flex-col">
          <label className="text-[13px] text-white/50 font-bold uppercase tracking-wider block mb-2">Import from Link</label>
          <div className="relative flex items-center">
            <div className="absolute left-4 text-white/40">
              <Link size={16} />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isImporting}
              placeholder="Paste YouTube, TikTok, Reddit, Instagram, or any video link..."
              className="w-full h-12 pl-11 pr-24 rounded-full border border-white/10 bg-white/5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all font-body"
            />
            <button
              type="submit"
              disabled={!isValidUrl || isImporting}
              className="absolute right-1.5 h-9 px-6 bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold rounded-full hover:opacity-90 transition-opacity disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 shadow-glow"
            >
              <Download size={13} />
              Import
            </button>
          </div>
        </div>

        {/* Animated Platform Badge */}
        <AnimatePresence>
          {platform && badgeConfig && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="flex items-center"
            >
              <div className={`px-3 py-1.5 rounded-full border text-xs font-bold font-body flex items-center gap-2 ${badgeConfig.bg}`}>
                {badgeConfig.icon}
                {badgeConfig.label}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Downloading Progress Bar */}
        <AnimatePresence>
          {isImporting && progress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden flex flex-col gap-2 mt-2"
            >
              <div className="w-full bg-white/10 h-2.5 rounded-full overflow-hidden relative">
                <motion.div
                  className="h-full bg-gradient-to-r from-accent to-accent-2 shimmer"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ ease: 'easeOut', duration: 0.2 }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-white/60 font-body px-1">
                <span>Downloading video stream...</span>
                <span className="font-mono font-bold text-accent">
                  {progress.percent.toFixed(0)}%
                  {progress.speed ? ` · ${progress.speed}` : ''}
                  {progress.eta ? ` · ~${progress.eta} remaining` : ''}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="flex items-start gap-3 bg-[#ff4d6a]/10 border border-[#ff4d6a]/20 p-4 rounded-xl text-xs text-[#ff4d6a] mt-2 font-body"
            >
              <div className="mt-0.5 flex-shrink-0">
                <AlertTriangle size={15} />
              </div>
              <div>
                <p className="font-bold mb-0.5">Import Failed</p>
                <p className="text-[#ff4d6a]/80 leading-relaxed mb-1.5">{error}</p>
                <p className="text-white/40">Suggestion: Try using yt-dlp directly for this platform.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
