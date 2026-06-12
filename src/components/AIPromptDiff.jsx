import React from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Minus, ArrowRight } from 'lucide-react';

/** Map action keys to readable labels and diff extractors */
function buildDiffLines(actions, beforeState, afterState) {
  const lines = [];

  for (const a of actions) {
    switch (a.action) {
      case 'set_caption_style':
        lines.push({
          label: 'Caption Style',
          before: beforeState.selectedStyle || '—',
          after: a.params?.style || afterState.selectedStyle || '—',
          type: 'change',
        });
        break;

      case 'set_font_size':
        lines.push({
          label: 'Font Size',
          before: `${beforeState.fontSize || 28}px`,
          after: `${a.params?.size || afterState.fontSize || 28}px`,
          type: 'change',
        });
        break;

      case 'translate_captions':
        lines.push({
          label: 'Caption Language',
          before: beforeState.language || 'en',
          after: a.params?.targetLang || afterState.language || 'hi',
          type: 'change',
        });
        break;

      case 'remove_silence':
        lines.push({
          label: 'Silence Removal',
          before: 'Off',
          after: `${beforeState.silenceCount != null ? `${beforeState.silenceCount} silences removed` : 'Enabled'}`,
          type: 'action',
        });
        break;

      case 'beat_sync_cuts':
        lines.push({
          label: 'Beat Sync',
          before: 'Off',
          after: 'Cuts snapped to beats',
          type: 'action',
        });
        break;

      case 'set_speed':
        lines.push({
          label: 'Playback Speed',
          before: `${beforeState.speed || 1}×`,
          after: `${a.params?.multiplier || 1}×`,
          type: 'change',
        });
        break;

      case 'trim_start':
        lines.push({
          label: 'Trim Start',
          before: '0s',
          after: `−${a.params?.seconds}s`,
          type: 'change',
        });
        break;

      case 'trim_end':
        lines.push({
          label: 'Trim End',
          before: `${beforeState.duration ? `${beforeState.duration.toFixed(1)}s` : '—'}`,
          after: `−${a.params?.seconds}s from end`,
          type: 'change',
        });
        break;

      case 'make_cinematic':
        lines.push({
          label: 'Color Grade',
          before: 'None',
          after: 'Cinematic',
          type: 'action',
        });
        break;

      case 'add_music':
        lines.push({
          label: 'Background Music',
          before: 'None',
          after: `${a.params?.mood || 'auto'} mood`,
          type: 'action',
        });
        break;

      case 'reframe_to_portrait':
        lines.push({
          label: 'Aspect Ratio',
          before: '16:9 / auto',
          after: '9:16 Portrait',
          type: 'change',
        });
        break;

      case 'set_export_platform':
        lines.push({
          label: 'Export Platform',
          before: beforeState.platform || 'default',
          after: a.params?.platform || 'reels',
          type: 'change',
        });
        break;

      case 'add_zoom':
        lines.push({
          label: 'Zoom Effect',
          before: 'None',
          after: `"${a.params?.word}" → ${a.params?.intensity || 1.3}× punch`,
          type: 'action',
        });
        break;

      case 'auto_edit':
        lines.push({
          label: 'Auto Edit Pipeline',
          before: 'Manual',
          after: 'Full AI edit applied',
          type: 'action',
        });
        break;

      default:
        lines.push({
          label: a.action.replace(/_/g, ' '),
          before: '—',
          after: JSON.stringify(a.params || {}),
          type: 'change',
        });
    }
  }

  return lines;
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const lineVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};

export default function AIPromptDiff({
  actions = [],
  description = '',
  beforeState = {},
  afterState = {},
  onConfirm,
  onCancel,
}) {
  const diffLines = buildDiffLines(actions, beforeState, afterState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="w-full bg-[#0e0e16]/95 border border-orange-500/25 rounded-xl overflow-hidden shadow-[0_0_24px_rgba(255,100,0,0.1)]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-orange-500/5">
        <span className="text-orange-400 text-[10px] font-bold uppercase tracking-widest">
          ⚡ AI Preview
        </span>
        <span className="ml-auto text-[10px] text-white/30 font-mono">
          {actions.length} action{actions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Diff lines */}
      <motion.div
        className="flex flex-col px-3 py-2 gap-1.5 max-h-48 overflow-y-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {diffLines.length === 0 ? (
          <p className="text-white/30 text-xs py-2 text-center">No changes detected</p>
        ) : (
          diffLines.map((line, i) => (
            <motion.div
              key={i}
              variants={lineVariants}
              className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
            >
              {/* Indicator */}
              {line.type === 'action' ? (
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-orange-500/15 flex items-center justify-center">
                  <AlertTriangle size={9} className="text-orange-400" />
                </span>
              ) : (
                <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Check size={9} className="text-green-400" />
                </span>
              )}

              {/* Label */}
              <span className="text-white/40 w-28 flex-shrink-0 font-medium">{line.label}</span>

              {/* Before */}
              <span className="font-mono text-white/30 line-through truncate max-w-[72px]">
                {line.before}
              </span>

              <ArrowRight size={10} className="text-white/20 flex-shrink-0" />

              {/* After */}
              <span className="font-mono text-orange-300 font-semibold truncate flex-1">
                {line.after}
              </span>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Description + Actions */}
      <div className="px-3 py-2.5 border-t border-white/5 bg-white/[0.01] flex items-center gap-2">
        <p className="text-[11px] text-white/40 flex-1 leading-snug line-clamp-2">{description}</p>
        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={onCancel}
            className="h-7 px-3 rounded-lg text-[11px] font-semibold text-white/40 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-7 px-4 rounded-lg text-[11px] font-bold text-white bg-orange-500 hover:bg-orange-400 shadow-[0_0_12px_rgba(255,100,0,0.3)] transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </motion.div>
  );
}
