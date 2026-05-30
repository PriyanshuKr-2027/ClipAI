/**
 * Caption Renderer Service
 * Formats transcribed word arrays into SubStation Alpha (.ass) subtitle files.
 */

/**
 * Format seconds into ASS timestamp: H:MM:SS.cc
 */
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const cs = Math.floor((secs % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/**
 * Groups an array of word objects into chunks/lines.
 * @param {Array} words - Array of { word, start, end }
 * @param {number} maxWords - Maximum words per line
 * @returns {Array} - Array of { words[], startTime, endTime, text }
 */
function groupWordsIntoLines(words, maxWords = 5) {
  const groups = [];
  for (let i = 0; i < words.length; i += maxWords) {
    const chunk = words.slice(i, i + maxWords);
    groups.push({
      words: chunk,
      startTime: chunk[0].start,
      endTime: chunk[chunk.length - 1].end,
      text: chunk.map(w => w.word).join(' ')
    });
  }
  return groups;
}

/**
 * Generates ASS file content from an array of words.
 * @param {Array} words - Array of { word, start, end }
 * @param {string} stylePreset - Name of the preset (NeonPop, HinglishFire, etc.)
 * @param {number} videoWidth - Width of the video
 * @param {number} videoHeight - Height of the video
 * @returns {string} - Complete ASS file content
 */
function generateASS(words, stylePreset, videoWidth, videoHeight) {
  const groups = groupWordsIntoLines(words, 5);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: NeonPop,Bangers,72,&H0000FFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,10,10,80,1
Style: HinglishFire,Anton,68,&H000055FF,&H00FFFFFF,&H0000008B,&H00000000,1,0,0,0,100,100,0,0,1,4,3,2,10,10,80,1
Style: BoldDevanagari,Noto Sans Devanagari,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,4,0,0,2,10,10,60,1
Style: CleanMinimal,Montserrat,60,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,80,1
Style: ReelBold,Impact,80,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,5,0,2,10,10,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let events = '';
  for (const group of groups) {
    const startStr = formatTime(group.startTime);
    const endStr = formatTime(group.endTime);
    let dialogueText = '';

    // Apply specific tags and formats based on style preset
    if (stylePreset === 'NeonPop' || stylePreset === 'HinglishFire') {
      let lastWordEnd = group.startTime;
      for (let i = 0; i < group.words.length; i++) {
        const w = group.words[i];
        const gap = w.start - lastWordEnd;
        const dur = w.end - w.start;
        
        // Handle gap spaces with karaoke timing
        if (i > 0) {
          if (gap > 0) {
            dialogueText += `{\\k${Math.round(gap * 100)}} `;
          } else {
            dialogueText += ' ';
          }
        }
        
        // Add karaoke tag for the word duration
        dialogueText += `{\\k${Math.round(dur * 100)}}${w.word}`;
        lastWordEnd = w.end;
      }
    } else if (stylePreset === 'CleanMinimal') {
      dialogueText = `{\\fad(150,150)}${group.text}`;
    } else if (stylePreset === 'ReelBold') {
      dialogueText = group.text.toUpperCase();
    } else {
      dialogueText = group.text;
    }

    events += `Dialogue: 0,${startStr},${endStr},${stylePreset},,0,0,0,,${dialogueText}\n`;
  }

  return header + events;
}

module.exports = {
  generateASS,
  groupWordsIntoLines,
  formatTime
};
