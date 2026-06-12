import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, History, X, Loader2, AlertCircle } from 'lucide-react';
import AIPromptDiff from './AIPromptDiff';

const HISTORY_KEY = 'clipai_prompt_history';
const MAX_HISTORY = 12;

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

const shakeVariants = {
  idle: { x: 0 },
  shake: {
    x: [0, -8, 8, -6, 6, -3, 3, 0],
    transition: { duration: 0.45, ease: 'easeInOut' },
  },
};

const slideUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
};

export default function AIPromptBar({ onActionsConfirmed, currentState = {} }) {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingActions, setPendingActions] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef(null);
  const historyRef = useRef(null);

  // Close history dropdown on outside click
  useEffect(() => {
    if (!showHistory) return;
    function handler(e) {
      if (historyRef.current && !historyRef.current.contains(e.target)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHistory]);

  const triggerShake = () => setShakeKey((k) => k + 1);

  const handleSubmit = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isProcessing) return;

    setIsProcessing(true);
    setError(null);
    setPendingActions(null);

    try {
      const res = await fetch('http://localhost:3001/api/prompt/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptText: text, currentState }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      if (!data.actions || data.actions.length === 0) {
        throw new Error("Couldn't understand that request. Try rephrasing.");
      }

      setPendingActions(data.actions);
      setDescription(data.description || '');
    } catch (err) {
      setError(err.message);
      triggerShake();
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, isProcessing, currentState]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setShowHistory(false);
      handleCancel();
    }
  };

  const handleConfirm = () => {
    if (!pendingActions) return;

    // Save to history (deduplicated, newest first)
    const text = inputText.trim();
    if (text) {
      const next = [text, ...history.filter((h) => h !== text)].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
    }

    onActionsConfirmed?.(pendingActions);
    setPendingActions(null);
    setDescription('');
    setInputText('');
    setError(null);
  };

  const handleCancel = () => {
    setPendingActions(null);
    setDescription('');
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const pickHistory = (item) => {
    setInputText(item);
    setShowHistory(false);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(item.length, item.length);
    }, 30);
  };

  const clearHistory = (e) => {
    e.stopPropagation();
    setHistory([]);
    saveHistory([]);
    setShowHistory(false);
  };

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      className="w-full flex flex-col gap-2"
    >
      <AnimatePresence mode="wait">
        {pendingActions ? (
          /* ── Diff preview ─────────────────────────────── */
          <motion.div key="diff" variants={slideUp} initial="hidden" animate="visible" exit="exit">
            <AIPromptDiff
              actions={pendingActions}
              description={description}
              beforeState={currentState}
              afterState={{}}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          </motion.div>
        ) : (
          /* ── Input row ────────────────────────────────── */
          <motion.div key="input" variants={slideUp} initial="hidden" animate="visible" exit="exit">
            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5 mb-2"
                >
                  <AlertCircle size={11} className="flex-shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 ml-1">
                    <X size={11} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input container */}
            <motion.div
              key={shakeKey}
              variants={shakeVariants}
              animate={shakeKey > 0 ? 'shake' : 'idle'}
              className="relative"
            >
              <div className={`
                flex items-center gap-2 rounded-xl px-3 h-10
                bg-[#0e0e16]/90 border transition-all duration-200
                ${isProcessing
                  ? 'border-orange-500/40 shadow-[0_0_16px_rgba(255,100,0,0.15)]'
                  : 'border-white/10 focus-within:border-orange-500/50 focus-within:shadow-[0_0_12px_rgba(255,100,0,0.12)]'
                }
              `}>
                {/* Icon */}
                <span className="flex-shrink-0 text-orange-400">
                  {isProcessing
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Zap size={14} />
                  }
                </span>

                {/* Text input */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => { setInputText(e.target.value); setError(null); }}
                  onKeyDown={handleKeyDown}
                  disabled={isProcessing}
                  placeholder="Try: 'remove silences', 'cut on beats', 'translate to Hindi'..."
                  className="
                    flex-1 bg-transparent outline-none text-[12px] text-white/80
                    placeholder:text-white/20 disabled:opacity-50 min-w-0
                  "
                />

                {/* History toggle */}
                {history.length > 0 && (
                  <div className="relative flex-shrink-0" ref={historyRef}>
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      title="Recent prompts"
                      className={`
                        p-1 rounded-md transition-colors
                        ${showHistory
                          ? 'text-orange-400 bg-orange-500/10'
                          : 'text-white/20 hover:text-white/50 hover:bg-white/5'
                        }
                      `}
                    >
                      <History size={13} />
                    </button>

                    {/* History dropdown */}
                    <AnimatePresence>
                      {showHistory && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="
                            absolute bottom-full right-0 mb-2 w-72
                            bg-[#12121e]/98 border border-white/10 rounded-xl shadow-2xl
                            overflow-hidden z-50
                          "
                        >
                          <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                            <span className="text-[10px] text-white/40 uppercase font-semibold tracking-wider">
                              Recent Prompts
                            </span>
                            <button
                              onClick={clearHistory}
                              className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors"
                            >
                              Clear all
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {history.map((item, i) => (
                              <button
                                key={i}
                                onClick={() => pickHistory(item)}
                                className="
                                  w-full text-left px-3 py-2 text-[12px] text-white/60
                                  hover:bg-white/5 hover:text-white transition-colors
                                  border-b border-white/[0.04] last:border-0 truncate
                                "
                              >
                                <Zap size={10} className="inline text-orange-400/60 mr-2 flex-shrink-0" />
                                {item}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Clear input button */}
                {inputText && !isProcessing && (
                  <button
                    onClick={() => { setInputText(''); setError(null); inputRef.current?.focus(); }}
                    className="flex-shrink-0 text-white/20 hover:text-white/50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!inputText.trim() || isProcessing}
                  title="Ctrl+Enter"
                  className="
                    flex-shrink-0 h-6 px-2.5 rounded-lg text-[10px] font-bold
                    bg-orange-500 hover:bg-orange-400 text-white
                    disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all shadow-[0_0_8px_rgba(255,100,0,0.25)]
                  "
                >
                  Run
                </button>
              </div>

              {/* Hint */}
              <p className="text-[9px] text-white/15 mt-1.5 pl-1">
                <kbd className="font-mono">Ctrl+Enter</kbd> to run
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
