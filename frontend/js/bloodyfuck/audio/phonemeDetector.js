/**
 * Volume → mouth-open phoneme proxy (local, no server).
 */
export class PhonemeDetector {
  analyze(freqData) {
    if (!freqData?.length) return 0;
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) sum += freqData[i];
    const avg = sum / freqData.length / 255;
    return Math.min(1, Math.pow(avg * 2.2, 0.85));
  }
}
