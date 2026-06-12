import React from 'react';
import { useEditorStore } from '../store/editorStore';
import RemotionPreview from './RemotionPreview';

const DEMO_WORDS = [
  { word: "This", start: 0, end: 0.3 },
  { word: "is", start: 0.3, end: 0.5 },
  { word: "your", start: 0.5, end: 0.8 },
  { word: "viral", start: 0.8, end: 1.2 },
  { word: "moment", start: 1.2, end: 1.8 },
  { word: "make", start: 2.0, end: 2.3 },
  { word: "it", start: 2.3, end: 2.5 },
  { word: "count", start: 2.5, end: 3.2 },
];

const STYLES = ['NeonPop', 'HinglishFire', 'BoldDevanagari', 'CleanMinimal', 'ReelBold'];

/**
 * StylePicker provides a list of caption styles with live Remotion player previews.
 */
export default function StylePicker() {
  const store = useEditorStore();
  const selectedStyle = store.selectedStyle || 'NeonPop';

  return (
    <div className="flex flex-col gap-2 w-full">
      <label className="text-[10px] text-white/40 uppercase font-semibold">
        Preset Theme
      </label>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {STYLES.map((styleName) => {
          const isSelected = selectedStyle === styleName;

          return (
            <div
              key={styleName}
              onClick={() => store.setSelectedStyle(styleName)}
              className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0 group"
            >
              {/* Card Container: 9:16 Aspect Ratio, scaled down */}
              <div
                className={`w-[110px] h-[196px] rounded-xl overflow-hidden bg-black relative transition-all border-2 ${
                  isSelected
                    ? 'border-[#ff4400] shadow-[0_0_10px_rgba(255,68,0,0.3)] scale-[1.02]'
                    : 'border-white/10 group-hover:border-white/20'
                }`}
              >
                <RemotionPreview
                  words={DEMO_WORDS}
                  selectedStyle={styleName}
                  currentTime={0}
                  duration={4}
                  videoWidth={1080}
                  videoHeight={1920}
                  width="100%"
                  height="100%"
                  showControls={false}
                  loop={true}
                />
              </div>

              {/* Style name label */}
              <span
                className={`text-[10px] font-bold tracking-wide transition-colors ${
                  isSelected ? 'text-[#ff4400]' : 'text-white/40 group-hover:text-white/80'
                }`}
              >
                {styleName}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
