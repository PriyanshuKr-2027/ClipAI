import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Save, CornerUpLeft, CornerUpRight, 
  Subtitles, Scissors, Film, 
  Trash2, Edit3, ArrowRight, Play, Layers, Wand2
} from 'lucide-react';
import { useEditorStore } from '../store/editorStore';

export default function Home() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  
  const saveProject = useEditorStore(s => s.saveProject);
  const undo = useEditorStore(s => s.undo);
  const redo = useEditorStore(s => s.redo);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('clipai_projects') || '[]');
      stored.sort((a, b) => b.lastEdited - a.lastEdited);
      setProjects(stored);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleCreate = (mode) => {
    navigate(`/projects?mode=${mode}`);
  };

  const recentProjects = projects.slice(0, 4);
  const continueEditing = projects.slice(0, 5);

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

  const cardVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="min-h-screen w-full flex flex-col pt-14 pb-10">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 h-[56px] glass-panel rounded-none border-b glass-border z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="font-display font-bold text-xl tracking-tight text-white">
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

      {/* Recent Projects */}
      <div className="max-w-4xl mx-auto w-full mt-10 px-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-[16px] text-white">Recent Projects</h2>
          <button className="text-white/55 text-sm hover:text-white transition-colors" onClick={() => navigate('/projects')}>View All →</button>
        </div>
        
        {recentProjects.length === 0 ? (
          <div className="text-white/30 text-sm italic">No recent projects</div>
        ) : (
          <div className="flex flex-col gap-2">
            {recentProjects.map((p) => {
              const modeColor = p.mode === 'caption' ? 'text-[#7c5cfc] bg-[#7c5cfc]/15' : 
                                p.mode === 'clips' ? 'text-[#00d4ff] bg-[#00d4ff]/15' : 
                                'text-[#00f5c4] bg-[#00f5c4]/15';
              return (
                <div key={p.id} onClick={() => navigate(`/projects`)} className="glass-card p-3 flex items-center gap-4 hover:bg-white/5 transition-colors group cursor-pointer">
                  <div className="w-[56px] h-[40px] rounded-lg overflow-hidden bg-gradient-to-br from-white/10 to-white/5 flex-shrink-0 relative">
                    <img src={p.metadata?.thumbUrl || 'https://via.placeholder.com/56x40/12121a/333344?text='} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[14px] text-white truncate">{p.name || 'Untitled Project'}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded font-semibold ${modeColor}`}>
                        {p.mode}
                      </span>
                      <span className="text-white/30 text-[12px]">{formatDuration(p.metadata?.duration)}</span>
                      <span className="text-white/30 text-[12px]">·</span>
                      <span className="text-white/30 text-[12px]">{timeAgo(p.lastEdited)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                    <button className="text-white/30 hover:text-white p-1" title="Rename" onClick={e => e.stopPropagation()}><Edit3 size={16}/></button>
                    <button className="text-white/30 hover:text-[#ff4d6a] p-1" title="Delete" onClick={e => e.stopPropagation()}><Trash2 size={16}/></button>
                    <button className="text-white/55 hover:text-white text-sm flex items-center gap-1 pl-2 transition-colors">
                      Open <ArrowRight size={14}/>
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
          <h2 className="font-semibold text-[16px] text-white mb-4">Continue Editing</h2>
          <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
            {continueEditing.map(p => (
              <div key={p.id} onClick={() => navigate('/projects')} className="glass-card p-3 rounded-xl flex flex-col w-[200px] flex-shrink-0 group cursor-pointer hover:bg-white/5 transition-colors">
                <div className="aspect-video rounded-lg overflow-hidden relative mb-3 bg-black/40">
                  <img src={p.metadata?.thumbUrl || 'https://via.placeholder.com/200x112/12121a/333344?text='} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
                    <Play className="text-white opacity-80 group-hover:opacity-100" fill="currentColor" size={24} />
                  </div>
                </div>
                <div className="font-semibold text-[13px] text-white truncate">{p.name || 'Untitled Project'}</div>
                <div className="text-[12px] text-white/55 mt-1 mb-3">
                  {p.mode === 'caption' ? 'Caption' : p.mode === 'clips' ? 'Clips' : 'Editing'} · {p.metadata?.progress || 'In Progress'}
                </div>
                <button className="w-full h-8 rounded-xl bg-gradient-to-r from-[#7c5cfc] to-[#00d4ff] text-white text-sm font-medium opacity-90 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_rgba(124,92,252,0.35)]">
                  Continue →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
