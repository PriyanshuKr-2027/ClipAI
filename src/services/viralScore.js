export function calculateCompositeScore(clip, options = {}) {
  const { llmScore, clipVisualScore, audioEnergyAtClip, faceDetected, hasBeat } = options;
  
  // Weighted composite:
  // LLaMA score: 50% weight (primary signal)
  // CLIP visual: 20% (if available)
  // Audio energy: 15% (average energy during clip)
  // Face detected: +0.5 bonus (faces = engagement)
  // Beat-aligned: +0.3 bonus
  
  let score = llmScore || 5;
  if (clipVisualScore) score = score * 0.8 + clipVisualScore * 2;
  if (audioEnergyAtClip) score = score * 0.85 + audioEnergyAtClip * 1.5;
  if (faceDetected) score = Math.min(10, score + 0.5);
  if (hasBeat) score = Math.min(10, score + 0.3);
  
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

export function getScoreLabel(score) {
  if (score >= 8.5) return { label: 'Viral', color: '#10b981' };
  if (score >= 7.0) return { label: 'Strong', color: '#f97316' };
  if (score >= 5.5) return { label: 'Good', color: '#3b82f6' };
  return { label: 'Weak', color: '#6b7280' };
}
