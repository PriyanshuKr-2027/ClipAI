import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, CornerUpLeft, CornerUpRight, 
  Subtitles, Scissors, Film, 
  Trash2, Edit3, ArrowRight, Play, Layers, Wand2,
  Upload, Globe, CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import * as api from '../services/api';
import UrlImporter from '../components/UrlImporter';

function StatusItem({ title, active, instructions }) {
  return (
    <div className={`p-3 rounded-xl border flex gap-3 items-start transition-all ${
      active 
        ? 'bg-[#10b981]/5 border-[#10b981]/15 text-[#10b981]' 
        : 'bg-white/5 border-white/5 text-white/40'
    }`}>
      <div className="mt-0.5 flex-shrink-0">
        {active ? (
          <CheckCircle2 size={15} className="text-[#10b981]" />
        ) : (
          <AlertCircle size={15} className="text-white/30" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-bold ${active ? 'text-white' : 'text-white/40'}`}>{title}</div>
        {!active && (
          <p className="text-[10px] text-white/35 mt-1 leading-relaxed">{instructions}</p>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Projects states
  const [projects, setProjects] = useState([]);
  const [recentFiles, setRecentFiles] = useState([]);
  
  // Tab states
  const queryParams = new URLSearchParams(window.location.search);
  const initialTab = queryParams.get('tab') === 'import' ? 'import' : 'upload';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // System Status States
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusData, setStatusData] = useState(null);

  // Store actions
  const setProject = useEditorStore(s => s.setProject);
  const setVideo = useEditorStore(s => s.setVideo);
  const setImportSource = useEditorStore(s => s.setImportSource);
  const saveProject = useEditorStore(s => s.saveProject);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);

  // Load projects, recent files, and system status on mount
  useEffect(() => {
    try {
      const storedProjects = JSON.parse(localStorage.getItem('clipai_projects') || '[]');
      storedProjects.sort((a, b) => b.lastEdited - a.lastEdited);
      setProjects(storedProjects);

      const storedFiles = JSON.parse(localStorage.getItem('recentFiles') || '[]');
      setRecentFiles(storedFiles);
    } catch (e) {
      console.error(e);
    }

    // Load System status
    fetch('http://localhost:3001/api/status')
      .then(res => res.json())
      .then(data => setStatusData(data))
      .catch(err => console.error('Failed to load system status:', err));
  }, []);

  const handleCreate = (mode) => {
    navigate(`/projects?mode=${mode}`);
  };

  const handleImportComplete = (videoData) => {
    setVideo(videoData.filePath, videoData.videoUrl, videoData.videoInfo, videoData.filename);
    setImportSource(videoData.importSource);
    
    // Save to recent files list in localStorage
    const recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
    const newRecent = {
      id: crypto.randomUUID(),
      name: videoData.filename,
      filePath: videoData.filePath,
      videoUrl: videoData.videoUrl,
      importSource: videoData.importSource,
      lastEdited: Date.now(),
      metadata: {
        duration: videoData.videoInfo?.duration || 0,
        width: videoData.videoInfo?.width || 0,
        height: videoData.videoInfo?.height || 0
      }
    };
    const filtered = recent.filter(r => r.filePath !== videoData.filePath);
    filtered.unshift(newRecent);
    localStorage.setItem('recentFiles', JSON.stringify(filtered.slice(0, 10)));
    
    setProject(newRecent.id, videoData.filename.replace(/\.[^/.]+$/, ""), 'editor');
    saveProject();
    navigate('/editor');
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
      setImportSource('file');

      // Save to recent files list in localStorage
      const recent = JSON.parse(localStorage.getItem('recentFiles') || '[]');
      const newRecent = {
        id: newId,
        name: file.name,
        filePath: result.filePath,
        videoUrl: result.videoUrl,
        importSource: 'file',
        lastEdited: Date.now(),
        metadata: {
          duration: result.duration,
          width: result.width,
          height: result.height
        }
      };
      
      const filtered = recent.filter(r => r.filePath !== result.filePath);
      filtered.unshift(newRecent);
      localStorage.setItem('recentFiles', JSON.stringify(filtered.slice(0, 10)));
      setRecentFiles(filtered.slice(0, 10));

      setProject(newId, file.name.replace(/\.[^/.]+$/, ""), 'editor');
      saveProject();
      navigate('/editor');
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
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

  const handleSelectRecentFile = (file) => {
    setVideo(file.filePath, file.videoUrl, file.metadata || {}, file.name);
    setImportSource(file.importSource);
    setProject(file.id, file.name.replace(/\.[^/.]+$/, ""), 'editor');
    saveProject();
    navigate('/editor');
  };

  const getSourceDotClass = (source) => {
    switch (source) {
      case 'youtube': return 'bg-[#FF0000]';
      case 'instagram': return 'bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045]';
      case 'x': return 'bg-white';
      case 'tiktok': return 'bg-white';
      case 'reddit': return 'bg-[#FF4500]';
      case 'playwright': return 'bg-[#9b7dff]';
      default: return 'bg-[#3b82f6]'; // local file
    }
  };

  const recentProjects = projects.slice(0, 4);
  const continueEditing = projects.slice(0, 5);

  const formatDuration = (secs) => {
    if (!secs) return '0s';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const timeAgo = (ts) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 3600) return 'Just now';
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    return `${Math.floor(diff/86400)}d ago`;
  };

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen w-full flex flex-col pt-14 pb-12 bg-[#060609]">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-[56px] glass-panel rounded-none border-b glass-border z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-tight text-white select-none">
            <span className="gradient-text mr-2">✦</span>ClipAI
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveProject} className="glass-card w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white transition-colors" title="Save">
            <Save size={16} />
          </button>
          <button onClick={undo} className="glass-card w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white transition-colors" title="Undo">
            <CornerUpLeft size={16} />
          </button>
          <button onClick={redo} className="glass-card w-8 h-8 flex items-center justify-center hover:bg-white/10 text-white transition-colors" title="Redo">
            <CornerUpRight size={16} />
          </button>
        </div>
      </div>

      {/* Hero Section - Feature Cards */}
      <div className="max-w-5xl mx-auto w-full mt-10 px-6">
        <motion.div 
          initial="hidden" animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
        >
          {/* Caption */}
          <motion.div 
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            onClick={() => handleCreate('caption')}
            className="glass-card p-6 flex flex-col gap-3 cursor-pointer group border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center text-[#7c5cfc] shadow-[0_0_10px_rgba(124,92,252,0.35)]">
              <Subtitles size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-white">Caption</h3>
              <p className="text-white/55 text-[14px] mt-1 line-clamp-2">Auto-gen captions with AI styling and word-level karaoke.</p>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-[#7c5cfc]/15 text-[#7c5cfc] font-semibold">AI Powered</span>
            </div>
          </motion.div>

          {/* Clipping */}
          <motion.div 
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            onClick={() => handleCreate('clips')}
            className="glass-card p-6 flex flex-col gap-3 cursor-pointer group border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center text-[#00d4ff] shadow-[0_0_10px_rgba(0,212,255,0.35)]">
              <Scissors size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-white">Clipping</h3>
              <p className="text-white/55 text-[14px] mt-1 line-clamp-2">AI Shorts Generator for viral social media content.</p>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-[#00d4ff]/15 text-[#00d4ff] font-semibold">Auto Shorts</span>
            </div>
          </motion.div>

          {/* Editor */}
          <motion.div 
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            onClick={() => handleCreate('editor')}
            className="glass-card p-6 flex flex-col gap-3 cursor-pointer group border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center text-[#00f5c4] shadow-[0_0_10px_rgba(0,245,196,0.35)]">
              <Film size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-white">Editor</h3>
              <p className="text-white/55 text-[14px] mt-1 line-clamp-2">Full Editor Workspace with multi-track timeline.</p>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-[#00f5c4]/15 text-[#00f5c4] font-semibold">Full Control</span>
            </div>
          </motion.div>

          {/* Transition Clone */}
          <motion.div 
            variants={cardVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            onClick={() => navigate('/transitions')}
            className="glass-card p-6 flex flex-col gap-3 cursor-pointer group border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-12 h-12 glass-card rounded-xl flex items-center justify-center text-[#00f5c4] shadow-[0_0_10px_rgba(0,245,196,0.35)]">
              <Wand2 size={24} />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-white">Transition Clone</h3>
              <p className="text-white/55 text-[14px] mt-1 line-clamp-2">Clone any trending transition — paste a Reel link, drop your photos</p>
            </div>
            <div className="mt-auto pt-2">
              <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded bg-[#00f5c4]/15 text-[#00f5c4] font-semibold">Clone Reels</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* IMPORT TABS & WORKSPACE */}
      <div className="max-w-4xl mx-auto w-full mt-10 px-6">
        {/* Tab switch buttons */}
        <div className="flex gap-8 border-b border-white/5 mb-6 justify-center">
          <button 
            onClick={() => setActiveTab('upload')} 
            className="pb-3 text-xs font-bold uppercase tracking-wider relative transition-colors duration-200"
            style={{ color: activeTab === 'upload' ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
          >
            Upload File
            {activeTab === 'upload' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f97316]" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab('import')} 
            className="pb-3 text-xs font-bold uppercase tracking-wider relative transition-colors duration-200"
            style={{ color: activeTab === 'import' ? '#ffffff' : 'rgba(255,255,255,0.4)' }}
          >
            Import from URL
            {activeTab === 'import' && (
              <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#f97316]" />
            )}
          </button>
        </div>

        {/* Tab content panels */}
        <div className="w-full relative min-h-[160px]">
          <AnimatePresence mode="wait">
            {activeTab === 'upload' ? (
              <motion.div
                key="upload-tab"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {/* Upload drag & drop zone */}
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="glass-card border-dashed border-2 border-white/10 hover:border-accent/40 hover:bg-white/5 transition-all p-8 rounded-2xl flex items-center gap-4 cursor-pointer relative overflow-hidden group shadow-lg"
                >
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska" />
                  
                  {isUploading && (
                    <div className="absolute inset-0 bg-[#060608]/90 backdrop-blur-sm flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-48 h-2.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-accent to-accent-2 transition-all" style={{width: `${uploadProgress}%`}} />
                        </div>
                        <span className="text-xs font-mono text-white/70">Uploading video file... {Math.round(uploadProgress)}%</span>
                      </div>
                    </div>
                  )}

                  <div className="w-[52px] h-[52px] glass-card rounded-xl flex items-center justify-center text-accent group-hover:scale-110 transition-transform shadow-glow-sm">
                    <Upload size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-[16px] text-white font-body">Import local video file</h3>
                    <p className="text-white/40 text-[12px] mt-0.5 font-body">Drag & drop or browse MP4 · MOV · AVI · MKV</p>
                  </div>
                  <button className="h-9 px-5 rounded-full bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold transition-opacity shadow-glow-sm">
                    Browse →
                  </button>
                </div>

                {/* Recent Files listing */}
                <div className="mt-8">
                  {recentFiles.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[12px] text-white/40 font-bold uppercase tracking-wider block mb-2 select-none">Recent Files</h4>
                      {recentFiles.map((file) => (
                        <div 
                          key={file.id} 
                          onClick={() => handleSelectRecentFile(file)}
                          className="glass-card p-3 flex items-center gap-4 hover:bg-white/5 transition-colors group cursor-pointer border-white/5"
                        >
                          <div className="w-[56px] h-[40px] rounded-lg overflow-hidden bg-white/5 flex-shrink-0 relative flex items-center justify-center text-white/20">
                            <Play size={14} />
                            {/* Dot badge overlay */}
                            <div 
                              className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-[#060609] ${getSourceDotClass(file.importSource)}`} 
                              title={`Source: ${file.importSource}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0 font-body">
                            <div className="font-semibold text-[14px] text-white truncate">{file.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-white/35 text-[11px]">
                              <span className="capitalize">{file.importSource === 'file' ? 'Local File' : file.importSource}</span>
                              <span>·</span>
                              <span>{formatDuration(file.metadata?.duration)}</span>
                              <span>·</span>
                              <span>{timeAgo(file.lastEdited)}</span>
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity pr-2 text-white/55 hover:text-white text-xs font-bold flex items-center gap-1 font-body">
                            Open <ArrowRight size={13}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="import-tab"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                <UrlImporter onImportComplete={handleImportComplete} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="max-w-4xl mx-auto w-full mt-10 px-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-[15px] text-white select-none">Recent Projects</h2>
          <button className="text-white/40 text-xs hover:text-white transition-colors" onClick={() => navigate('/projects')}>View All →</button>
        </div>
        
        {recentProjects.length === 0 ? (
          <div className="text-white/30 text-xs italic py-2">No recent projects</div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentProjects.map((p) => {
              const modeColor = p.mode === 'caption' ? 'text-[#7c5cfc] bg-[#7c5cfc]/15' : 
                                p.mode === 'clips' ? 'text-[#00d4ff] bg-[#00d4ff]/15' : 
                                'text-[#00f5c4] bg-[#00f5c4]/15';
              return (
                <div key={p.id} onClick={() => navigate(`/projects`)} className="glass-card p-3 flex items-center gap-4 hover:bg-white/5 transition-colors group cursor-pointer border-white/5">
                  <div className="w-[56px] h-[40px] rounded-lg overflow-hidden bg-gradient-to-br from-white/10 to-white/5 flex-shrink-0 relative">
                    <img src={p.metadata?.thumbUrl || 'https://via.placeholder.com/56x40/12121a/333344?text='} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0 font-body">
                    <div className="font-semibold text-[14px] text-white truncate">{p.name || 'Untitled Project'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${modeColor}`}>
                        {p.mode}
                      </span>
                      <span className="text-white/35 text-[11px]">{formatDuration(p.metadata?.duration)}</span>
                      <span className="text-white/35 text-[11px]">·</span>
                      <span className="text-white/35 text-[11px]">{timeAgo(p.lastEdited)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pr-2 font-body">
                    <button className="text-white/30 hover:text-white p-1" title="Rename" onClick={e => e.stopPropagation()}><Edit3 size={15}/></button>
                    <button className="text-white/30 hover:text-[#ff4d6a] p-1" title="Delete" onClick={e => e.stopPropagation()}><Trash2 size={15}/></button>
                    <button className="text-white/55 hover:text-white text-xs font-bold flex items-center gap-1 pl-2 transition-colors">
                      Open <ArrowRight size={13}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Continue Editing */}
      {continueEditing.length > 0 && (
        <div className="max-w-4xl mx-auto w-full mt-10 px-6">
          <h2 className="font-semibold text-[15px] text-white mb-4 select-none">Continue Editing</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {continueEditing.map(p => (
              <div key={p.id} onClick={() => navigate('/projects')} className="glass-card p-3 rounded-xl flex flex-col w-[200px] flex-shrink-0 group cursor-pointer hover:bg-white/5 transition-colors border-white/5">
                <div className="aspect-video rounded-lg overflow-hidden relative mb-3 bg-black/40">
                  <img src={p.metadata?.thumbUrl || 'https://via.placeholder.com/200x112/12121a/333344?text='} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                    <Play className="text-white opacity-80 group-hover:opacity-100" fill="currentColor" size={24} />
                  </div>
                </div>
                <div className="font-semibold text-[13px] text-white truncate font-body">{p.name || 'Untitled Project'}</div>
                <div className="text-[11px] text-white/40 mt-1 mb-3 font-body">
                  {p.mode === 'caption' ? 'Caption' : p.mode === 'clips' ? 'Clips' : 'Editing'} · {p.metadata?.progress || 'In Progress'}
                </div>
                <button className="w-full h-8 rounded-xl bg-gradient-to-r from-accent to-accent-2 text-white text-xs font-bold opacity-90 group-hover:opacity-100 transition-opacity shadow-glow-sm">
                  Continue →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Dependency Status card collapsible */}
      <div className="max-w-4xl mx-auto w-full mt-12 px-6">
        <div className="glass-panel border-white/5 bg-[#0d0d12]/90 rounded-2xl overflow-hidden shadow-2xl">
          <button 
            type="button"
            onClick={() => setIsStatusOpen(!isStatusOpen)}
            className="w-full p-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors font-body focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${statusData ? 'bg-[#10b981]' : 'bg-white/20 animate-pulse'}`} />
              <span className="font-semibold text-xs uppercase tracking-wider">System Dependency Status</span>
            </div>
            <div className="text-white/40">
              {isStatusOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </button>

          <AnimatePresence>
            {isStatusOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="border-t border-white/5 p-5 bg-[#08080c]/50 flex flex-col gap-4 font-body"
              >
                {statusData ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Groq API */}
                    <StatusItem 
                      title="Groq Whisper API"
                      active={statusData.groqConfigured}
                      instructions="Groq API key not set. Set GROQ_API_KEY in server .env to enable fast cloud transcription."
                    />
                    {/* Faster Whisper */}
                    <StatusItem 
                      title="Faster-Whisper (Local Fallback)"
                      active={statusData.features?.fasterWhisper}
                      instructions="Faster-Whisper is not configured. Install faster-whisper package in backend environment."
                    />
                    {/* Librosa */}
                    <StatusItem 
                      title="Librosa Beat Detection"
                      active={statusData.features?.librosa}
                      instructions="Librosa package is missing. Install librosa in backend python virtualenv for beat alignment."
                    />
                    {/* Scene Detection */}
                    <StatusItem 
                      title="Scene Detection (PySceneDetect)"
                      active={statusData.features?.scenedetect}
                      instructions="PySceneDetect is missing. Install scenedetect package in python virtualenv."
                    />
                    {/* Face Detection */}
                    <StatusItem 
                      title="Face Detection (InsightFace)"
                      active={statusData.features?.insightface}
                      instructions="InsightFace is missing. Install insightface package in python virtualenv for smart cropping."
                    />
                  </div>
                ) : (
                  <div className="text-white/40 text-xs text-center py-2 animate-pulse">Loading dependency check data...</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
