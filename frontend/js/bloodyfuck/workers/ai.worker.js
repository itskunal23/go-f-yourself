/** AI worker: emotion state + future LLM hooks. */
let emotion = { anger: 0, pain: 0, fear: 0 };
let tick = 0;

self.onmessage = (ev) => {
  const t0 = performance.now();
  const { type, payload } = ev.data || {};

  if (type === 'pain') {
    emotion.pain = Math.min(1, emotion.pain + (payload?.amount || 0.1));
    emotion.anger = Math.min(1, emotion.anger + 0.05);
  } else if (type === 'tick') {
    tick++;
    emotion.pain *= 0.992;
    emotion.anger *= 0.995;
    emotion.fear = Math.min(1, emotion.pain * 0.6);
  } else if (type === 'llm') {
    // Future: stream tokens from local LLM / transformers.js
    emotion.anger = Math.min(1, emotion.anger + 0.02);
  } else if (type === 'reset') {
    emotion = { anger: 0, pain: 0, fear: 0 };
    tick = 0;
  }

  const latency = performance.now() - t0;
  self.postMessage({ type: 'state', emotion: { ...emotion }, tick, latency });
};
