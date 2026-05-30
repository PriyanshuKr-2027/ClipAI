import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Upload,
  MoreHorizontal, Edit3, Trash2, 
  Film, Scissors, Subtitles,
  Youtube, Globe, Link, Download
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import * as api from '../services/api';

export default function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Recent');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);

  // YouTube / Web Link import states
  const [importSource, setImportSource] = useState('local');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytProgress, setYtProgress] = useState(0);
  const [isProcessingYt, setIsProcessingYt] = useState(false);
  const [processingYtStatus, setProcessingYtStatus] = useState('');

  const setProject = useEditorStore(s => s.setProject);
  const setVideo = useEditorStore(s => s.setVideo);
  const saveProject = useEditorStore(s => s.saveProject);

  const queryParams = new URLSearchParams(location.search);
  const requestedMode = queryParams.get('mode') || 'editor';

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('clipai_projects') || '[]');
      setProjects(stored);
    } catch (e) {
      console.error(e);
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const result = await api.uploadVideo(file, (pct) => setUploadProgress(pct));
      const newId = crypto.randomUUID();
      const info = { duration: result.duration, width: result.width, height: result.height, size: result.size };

      setVideo(result.filePath, result.videoUrl, info, result.filename);
      setProject(newId, file.name, requestedMode);
      saveProject(); // Wait until Zustand state settles, but Zustand is synchronous so this works.

      if (requestedMode === 'caption') navigate('/editor');
      else if (requestedMode === 'clips') navigate('/clips');
      else navigate('/editor');
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleYoutubeImport = async (streamOnly) => {
    if (!youtubeUrl.trim()) return;
    setIsProcessingYt(true);
    setYtProgress(0);
    setProcessingYtStatus(streamOnly ? 'Resolving YouTube stream URL...' : 'Initializing download...');

    try {
      const result = await api.downloadYoutube(youtubeUrl, streamOnly, (pct) => {
        setYtProgress(pct);
        setProcessingYtStatus(`Downloading... ${pct}%`);
      });

      if (!streamOnly) {
        setProcessingYtStatus('Probing downloaded video...');
      } else {
        setProcessingYtStatus('Probing direct stream metadata...');
      }

      const newId = crypto.randomUUID();
      const info = { 
        duration: result.duration, 
        width: result.width, 
        height: result.height, 
        size: result.size 
      };

      setVideo(result.filePath, result.videoUrl, info, result.filename);
      setProject(newId, result.filename.replace('.mp4', ''), requestedMode);
      saveProject();

      if (requestedMode === 'caption') navigate('/editor');
      else if (requestedMode === 'clips') navigate('/clips');
      else navigate('/editor');
    } catch (err) {
      console.error("YouTube import failed:", err);
      alert("YouTube import failed: " + err.message);
    } finally {
      setIsProcessingYt(false);
      setYtProgress(0);
      setProcessingYtStatus('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleOpen = (proj) => {
    useEditorStore.getState().loadProjectState(proj);
    
    if (proj.mode === 'caption') navigate('/editor');
    else if (proj.mode === 'clips') navigate('/clips');
    else navigate('/editor');
  };

  const handleRenameSave = (id) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const updated = projects.map(p => p.id === id ? { ...p, name: editName, lastEdited: Date.now() } : p);
    setProjects(updated);
    localStorage.setItem('clipai_projects', JSON.stringify(updated));
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    localStorage.setItem('clipai_projects', JSON.stringify(updated));
    setDeleteConfirmId(null);
    try {
      await fetch('http://localhost:3001/api/files/cleanup', { method: 'DELETE' });
    } catch (e) {}
  };

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h${m}m` : `${m}m`;
  };

  const timeAgo = (ts) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 3600) return 'Just now';
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  let displayedProjects = projects.filter(p => {
    if (filter !== 'All' && p.mode.toLowerCase() !== filter.toLowerCase()) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  displayedProjects.sort((a, b) => {
    if (sort === 'Recent') return b.lastEdited - a.lastEdited;
    if (sort === 'Name') return a.name.localeCompare(b.name);
    if (sort === 'Size') return (b.metadata?.size || 0) - (a.metadata?.size || 0);
    return 0;
  });

  return (
    <div className="min-h-screen pt-14 px-6 pb-10 flex flex-col items-center">
      {/* TOP BAR */}
      <div className="fixed top-0 left-0 right-0 h-[52px] glass-panel rounded-none border-b glass-border z-50 flex items-center justify-between px-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white hover:text-accent transition-colors">
          <ArrowLeft size={18} />
          <span className="font-semibold text-lg">Projects</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="h-8 px-4 rounded-full bg-gradient-to-r from-[#7c5cfc] to-[#9b7dff] text-white text-sm font-medium shadow-glow-sm hover:opacity-90 transition-opacity flex items-center gap-2">
          + Import Video
        </button>
      </div>
      
      <div className="w-full max-w-6xl mt-4">
        {/* SEARCH + FILTER ROW */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="glass-input w-full h-10 pl-9 pr-3 text-sm"
            />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)} className="glass-input h-10 px-3 text-sm w-36 cursor-pointer">
            <option value="All">All Modes</option>
            <option value="caption">Caption</option>
            <option value="clips">Clipping</option>
            <option value="editor">Editor</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className="glass-input h-10 px-3 text-sm w-36 cursor-pointer">
            <option value="Recent">Recent</option>
            <option value="Name">Name</option>
            <option value="Size">Size</option>
          </select>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-4 justify-center">
          <button 
            onClick={() => setImportSource('local')} 
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
              importSource === 'local' 
                ? 'bg-[#7c5cfc]/15 border-[#7c5cfc] text-white shadow-glow-sm' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Upload size={13} />
            Local File
          </button>
          <button 
            onClick={() => setImportSource('youtube')} 
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
              importSource === 'youtube' 
                ? 'bg-[#7c5cfc]/15 border-[#7c5cfc] text-white shadow-glow-sm' 
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Youtube size={13} />
            YouTube / Web URL
          </button>
        </div>

        {importSource === 'local' ? (
          /* IMPORT CARD */
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="glass-card border-dashed border-2 border-white/10 hover:border-[#7c5cfc]/40 hover:bg-white/5 transition-all p-6 rounded-2xl flex items-center gap-4 cursor-pointer mb-8 group relative overflow-hidden"
          >
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska" />
            
            {isUploading && (
              <div className="absolute inset-0 bg-[#060608]/80 backdrop-blur flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] transition-all" style={{width: `${uploadProgress}%`}} />
                  </div>
                  <span className="text-sm font-mono text-white/70">Uploading... {Math.round(uploadProgress)}%</span>
                </div>
              </div>
            )}

            <div className="w-[52px] h-[52px] glass-card rounded-xl flex items-center justify-center text-[#7c5cfc] group-hover:scale-110 transition-transform shadow-glow-sm">
              <Upload size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[16px] text-white">Import New Video</h3>
              <p className="text-white/55 text-[14px] mt-0.5">MP4 · MOV · AVI · MKV — up to 4GB</p>
            </div>
            <button className="h-9 px-5 rounded-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] text-white text-sm font-medium opacity-90 group-hover:opacity-100 transition-opacity shadow-glow-sm">
              Browse →
            </button>
          </div>
        ) : (
          /* YOUTUBE IMPORT CARD */
          <div className="glass-card border border-white/10 p-6 rounded-2xl flex flex-col gap-4 mb-8 relative overflow-hidden">
            {isProcessingYt && (
              <div className="absolute inset-0 bg-[#060608]/85 backdrop-blur-md flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-t-[#7c5cfc] border-r-transparent border-b-[#7c5cfc] border-l-transparent animate-spin" />
                  </div>
                  {!processingYtStatus.includes('Downloading') ? (
                    <span className="text-sm font-semibold text-white/80 animate-pulse">{processingYtStatus}</span>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] transition-all" style={{width: `${ytProgress}%`}} />
                      </div>
                      <span className="text-xs font-mono text-[#00f5c4]">{processingYtStatus}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <Youtube size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-white">Import from YouTube or Web link</h3>
                <p className="text-white/40 text-[11px] mt-0.5">Works with YouTube videos, shorts, and direct stream URLs</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="Paste link here (e.g., https://www.youtube.com/watch?v=...)" 
                value={youtubeUrl} 
                onChange={e => setYoutubeUrl(e.target.value)}
                disabled={isProcessingYt}
                className="glass-input flex-1 h-11 px-4 text-sm focus:border-accent"
              />
              
              <div className="flex gap-2">
                <button 
                  onClick={() => handleYoutubeImport(false)}
                  disabled={isProcessingYt || !youtubeUrl.trim()}
                  className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#7c5cfc] to-[#9b7dff] text-white text-xs font-bold shadow-glow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Download size={13} />
                  Download & Edit
                </button>
                <button 
                  onClick={() => handleYoutubeImport(true)}
                  disabled={isProcessingYt || !youtubeUrl.trim()}
                  className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Globe size={13} />
                  Stream Directly
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 text-white font-semibold">
          All Projects ({displayedProjects.length})
        </div>

        {/* PROJECTS GRID */}
        {displayedProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center glass-panel rounded-3xl">
            <Upload size={48} className="text-white/20 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No projects yet</h3>
            <p className="text-white/50 mb-6 text-sm">Import your first video to get started</p>
            <button onClick={() => fileInputRef.current?.click()} className="h-10 px-6 rounded-full bg-gradient-to-r from-[#7c5cfc] to-[#9b7dff] text-white font-medium shadow-glow-sm hover:opacity-90 transition-opacity">
              + Import Video
            </button>
          </div>
        ) : (
          <motion.div 
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            {displayedProjects.map(p => {
              const modeColor = p.mode === 'caption' ? 'text-[#7c5cfc] bg-[#7c5cfc]/15' : 
                                p.mode === 'clips' ? 'text-[#00d4ff] bg-[#00d4ff]/15' : 
                                'text-[#00f5c4] bg-[#00f5c4]/15';
              const ModeIcon = p.mode === 'caption' ? Subtitles : p.mode === 'clips' ? Scissors : Film;

              return (
                <motion.div
                  key={p.id}
                  variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                  whileHover={{ scale: 1.02, y: -3 }}
                  className="glass-card rounded-2xl overflow-hidden cursor-pointer flex flex-col group relative"
                  onClick={() => handleOpen(p)}
                >
                  <div className="aspect-video relative bg-black/40">
                    <img src={p.metadata?.thumbUrl || 'https://via.placeholder.com/400x225/12121a/333344?text='} className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 right-2 glass-card px-1.5 py-0.5 rounded text-[10px] font-mono text-white/80 backdrop-blur-md">
                      {formatDuration(p.metadata?.duration)}
                    </div>
                    
                    {/* Menu button */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button 
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }}
                        className="w-7 h-7 glass-card flex items-center justify-center text-white hover:bg-white/10 rounded-lg shadow-xl"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {openMenuId === p.id && (
                        <>
                          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                          <div className="absolute top-8 right-0 glass-panel shadow-2xl p-1 rounded-xl w-32 flex flex-col z-30" onClick={e => e.stopPropagation()}>
                            <button onClick={() => { setEditingId(p.id); setEditName(p.name); setOpenMenuId(null); }} className="text-[13px] font-medium text-white hover:bg-white/10 p-2 rounded-lg text-left flex items-center gap-2 transition-colors">
                              <Edit3 size={14}/> Rename
                            </button>
                            <button onClick={() => { setDeleteConfirmId(p.id); setOpenMenuId(null); }} className="text-[13px] font-medium text-[#ff4d6a] hover:bg-white/10 p-2 rounded-lg text-left flex items-center gap-2 transition-colors">
                              <Trash2 size={14}/> Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3 flex flex-col gap-1">
                    {editingId === p.id ? (
                      <input
                        autoFocus
                        className="glass-input h-7 px-2 text-[13px] font-semibold w-full"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onBlur={() => handleRenameSave(p.id)}
                        onKeyDown={e => e.key === 'Enter' && handleRenameSave(p.id)}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div className="font-semibold text-[13px] text-white truncate">{p.name || 'Untitled'}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${modeColor}`}>
                        {p.mode}
                      </span>
                      <span className="text-white/40 text-[11px]">{timeAgo(p.lastEdited)}</span>
                    </div>
                    <div className="text-[11px] text-white/40 mt-1 truncate">
                      {p.metadata?.progress || 'Ready to edit'}
                    </div>
                  </div>

                  <div className="p-2 pt-0 flex gap-2 items-center">
                    <button className="glass-card flex-1 h-8 text-[12px] font-medium text-white/80 hover:text-white transition-colors">
                      Open
                    </button>
                    <div className="w-8 h-8 glass-card flex items-center justify-center text-white/60">
                      <ModeIcon size={14} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#060608]/80 backdrop-blur-sm z-[100] flex items-center justify-center"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-2xl max-w-sm w-full m-4 border-white/20"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
              <p className="text-white/60 text-sm mb-6">Are you sure you want to delete this project? This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={() => handleDelete(deleteConfirmId)} className="px-5 py-2 rounded-xl bg-[#ff4d6a]/20 text-[#ff4d6a] font-medium hover:bg-[#ff4d6a]/30 transition-colors text-sm shadow-[0_0_15px_rgba(255,77,106,0.2)]">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
