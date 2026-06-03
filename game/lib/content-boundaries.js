// Hard content boundaries — no device / private-message mechanics in gameplay.

export const DEVICE_BOUNDARY_PROMPT = `
DEVICE BOUNDARY (ABSOLUTE — overrides everything):
- NEVER ask anyone to use, unlock, show, scroll, read, send, or open anything on a phone, tablet, laptop, or any device.
- NEVER mention texts, DMs, messages, sexts, inbox, camera roll, gallery, photos, pics, screenshots, search history, or saved chats.
- NEVER dare anyone to read anything aloud from a screen or share private digital content.
- All dares are in-the-room only: speak, touch, drink, perform — eyes on each other, not a device.`;

const DEVICE_PATTERNS = [
  /\bphone\b/i,
  /\btexts?\b/i,
  /\bsext/i,
  /\bdms?\b/i,
  /\bmessages?\b/i,
  /camera roll/i,
  /\bgallery\b/i,
  /screenshot/i,
  /\binbox\b/i,
  /\bwhatsapp\b/i,
  /\bsnapchat\b/i,
  /\binstagram\b/i,
  /read (your|their|the|a|some|any)[\w\s]{0,30}(aloud|out loud)/i,
  /show (your|their|the|a)[\w\s]{0,20}(pic|photo|screen|message)/i,
  /unlock[\w\s]{0,20}phone/i,
  /go through[\w\s]{0,20}phone/i,
  /scroll (through|your)/i,
  /\bscan (the|your|a) (label|drink|bottle)/i,
  /choose photo/i,
  /take a (pic|photo)/i,
];

export function violatesDeviceBoundary(text) {
  if (!text || typeof text !== 'string') return false;
  return DEVICE_PATTERNS.some((re) => re.test(text));
}

const INCEST_PATTERNS = [
  /fuck (your|my|their) (mom|dad|mother|father|parent)/i,
  /sex with (your|my|their) (mom|dad|mother|father|parent)/i,
  /(mom|dad|mother|father) (sexual|sexually|naked|nude)/i,
];

export function violatesIncestBoundary(text) {
  if (!text || typeof text !== 'string') return false;
  return INCEST_PATTERNS.some((re) => re.test(text));
}

export function sanitizeContent(text, fallback = 'Do it out loud — improvise only, no devices.') {
  if (!text || typeof text !== 'string') return fallback;
  if (violatesDeviceBoundary(text) || violatesIncestBoundary(text)) return fallback;
  return text;
}

export function sanitizeDeviceBoundary(text, fallback = 'Do it out loud — improvise only, no devices.') {
  if (!text || typeof text !== 'string') return fallback;
  if (!violatesDeviceBoundary(text)) return sanitizeIncestOnly(text, fallback);
  return fallback;
}

function sanitizeIncestOnly(text, fallback) {
  if (violatesIncestBoundary(text)) return fallback;
  return text;
}
