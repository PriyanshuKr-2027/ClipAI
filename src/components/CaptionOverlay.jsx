import React from 'react';
import { useEditorStore } from '../store/editorStore';

export default function CaptionOverlay({ captionGroups, currentTime = 0, stylePreset }) {
  const store = useEditorStore();
  const activeStyle = stylePreset || store.selectedStyle || 'NeonPop';
  const customStyle = store.captionStyle || { fontSize: 28, color: '#ffffff', position: 'bottom' };
  const groups = captionGroups || store.captionGroups || [];

  // Find active caption group
  const activeGroup = groups.find(
    (g) => currentTime >= g.startTime && currentTime <= g.endTime
  );

  if (!activeGroup) return null;

  // Render words with appropriate style
  const renderWord = (word, index) => {
    const isActive = currentTime >= word.start && currentTime <= word.end;
    const fontSizeStyle = `${customStyle.fontSize || 32}px`;
    const baseColor = customStyle.color || '#ffffff';

    switch (activeStyle) {
      case 'NeonPop':
        return (
          <span
            key={index}
            className="transition-all duration-100 mx-1.5"
            style={{
              fontFamily: "'Bangers', sans-serif",
              fontSize: fontSizeStyle,
              color: isActive ? '#FFE000' : baseColor,
              textShadow: isActive
                ? '0 0 10px rgba(255, 224, 0, 0.8), 2px 2px 0px #000'
                : '2px 2px 0px #000',
              WebkitTextStroke: '1.5px black',
            }}
          >
            {word.word}
          </span>
        );

      case 'HinglishFire':
        return (
          <span
            key={index}
            className="inline-block transition-all duration-150 mx-1.5 font-bold"
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: fontSizeStyle,
              transform: isActive ? 'scale(1.18)' : 'scale(1.0)',
              color: isActive ? '#FF8800' : baseColor,
              textShadow: isActive
                ? '0 0 15px rgba(255, 136, 0, 0.9), 3px 3px 0px #330000'
                : '3px 3px 0px #330000',
              WebkitTextStroke: '2px #330000',
            }}
          >
            {word.word}
          </span>
        );

      case 'BoldDevanagari':
        return (
          <span
            key={index}
            className={`transition-colors duration-150 mx-1 font-bold ${
              isActive ? 'text-[#00f5c4]' : ''
            }`}
            style={{
              fontFamily: "'Noto Sans Devanagari', sans-serif",
              fontSize: fontSizeStyle,
              color: isActive ? '#00f5c4' : baseColor,
            }}
          >
            {word.word}
          </span>
        );

      case 'CleanMinimal':
        return (
          <span
            key={index}
            className="transition-colors duration-200 mx-1 font-semibold"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontSize: fontSizeStyle,
              color: isActive ? '#7c5cfc' : baseColor,
              textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {word.word}
          </span>
        );

      case 'ReelBold':
        return (
          <span
            key={index}
            className={`inline-block mx-1.5 uppercase font-black ${
              isActive ? 'active-shake' : ''
            }`}
            style={{
              fontFamily: 'Impact, Arial Black, sans-serif',
              fontSize: fontSizeStyle,
              color: isActive ? '#00d4ff' : baseColor,
              WebkitTextStroke: '2.5px #000000',
              textShadow: '3px 3px 0px #000000',
            }}
          >
            {word.word}
          </span>
        );

      default:
        return (
          <span
            key={index}
            className="mx-1 font-bold"
            style={{
              fontSize: fontSizeStyle,
              color: isActive ? '#7c5cfc' : baseColor,
            }}
          >
            {word.word}
          </span>
        );
    }
  };

  const isDevanagari = activeStyle === 'BoldDevanagari';

  // Position style overrides
  let positionStyle = { bottom: '15%' };
  if (customStyle.position === 'middle') {
    positionStyle = { top: '50%', transform: 'translateY(-50%)' };
  } else if (customStyle.position === 'top') {
    positionStyle = { top: '15%' };
  }

  return (
    <div
      className="absolute left-0 right-0 flex justify-center px-4 pointer-events-none select-none z-30"
      style={positionStyle}
    >
      <div
        className={`flex flex-wrap justify-center items-center text-center max-w-[90%] transition-opacity duration-150 ${
          isDevanagari ? 'bg-black/70 px-4 py-2 rounded-xl border border-white/10 backdrop-blur-sm' : ''
        }`}
      >
        {activeGroup.words && activeGroup.words.length > 0 ? (
          activeGroup.words.map((w, i) => renderWord(w, i))
        ) : (
          <span
            className="font-bold text-3xl"
            style={{
              fontSize: `${customStyle.fontSize || 32}px`,
              color: customStyle.color || '#ffffff',
            }}
          >
            {activeGroup.text}
          </span>
        )}
      </div>
    </div>
  );
}
