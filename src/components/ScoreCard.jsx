import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getScoreLabel } from '../services/viralScore';

export default function ScoreCard({ score = 0, size = 'md' }) {
  const { label, color } = getScoreLabel(score);
  const [displayScore, setDisplayScore] = useState('0.0');

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1200; // 1.2s count up animation
    
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = easeProgress * score;
      
      setDisplayScore(current.toFixed(1));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [score]);

  // Size configurations
  const sizes = {
    sm: {
      width: 48,
      r: 19,
      strokeWidth: 3.5,
      scoreClass: 'text-[11px] font-black',
      labelClass: 'text-[10px] font-semibold mt-1',
    },
    md: {
      width: 72,
      r: 29,
      strokeWidth: 5,
      scoreClass: 'text-[16px] font-black',
      labelClass: 'text-[12px] font-bold mt-1.5',
    },
    lg: {
      width: 96,
      r: 39,
      strokeWidth: 6.5,
      scoreClass: 'text-[22px] font-black',
      labelClass: 'text-[14px] font-bold mt-2',
    }
  };

  const config = sizes[size] || sizes.md;
  const center = config.width / 2;
  const circumference = 2 * Math.PI * config.r;
  const targetOffset = circumference * (1 - score / 10);

  const glowStyle = score >= 8.5 ? {
    filter: `drop-shadow(0 0 6px ${color}80)`
  } : {};

  return (
    <div className="flex flex-col items-center justify-center font-body select-none">
      {/* Circle Container */}
      <div 
        className="relative flex items-center justify-center"
        style={{ width: config.width, height: config.width, ...glowStyle }}
      >
        <svg 
          width={config.width} 
          height={config.width} 
          className="absolute inset-0"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={config.r}
            fill="transparent"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={config.strokeWidth}
          />
          {/* Animated progress circle */}
          <motion.circle
            cx={center}
            cy={center}
            r={config.r}
            fill="transparent"
            stroke={color}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ type: 'spring', stiffness: 60, damping: 14, delay: 0.1 }}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </svg>

        {/* Center Score Number */}
        <div 
          className="z-10 flex items-center justify-center font-mono leading-none"
          style={{ color }}
        >
          <span className={config.scoreClass}>
            {displayScore}
          </span>
        </div>
      </div>

      {/* Under Label */}
      <div 
        className={`${config.labelClass} uppercase tracking-wider transition-colors duration-300`}
        style={{ color }}
      >
        {label}
      </div>
    </div>
  );
}
