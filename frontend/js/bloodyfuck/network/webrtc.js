/**
 * WebRTC peer helper for future multiplayer avatar sync.
 */
export class WebRTCChannel {
  constructor() {
    /** @type {RTCPeerConnection|null} */
    this.pc = null;
    /** @type {RTCDataChannel|null} */
    this.dc = null;
    /** @param {unknown} _msg */
    this.onMessage = (_msg) => {};
  }

  async createOffer() {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.dc = this.pc.createDataChannel('bf-avatar');
    this._wire();
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /** @param {RTCSessionDescriptionInit} offer */
  async acceptOffer(offer) {
    this.pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    this.pc.ondatachannel = (ev) => { this.dc = ev.channel; this._wire(); };
    await this.pc.setRemoteDescription(offer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /** @param {RTCSessionDescriptionInit} answer */
  async setAnswer(answer) {
    await this.pc?.setRemoteDescription(answer);
  }

  _wire() {
    if (!this.dc) return;
    this.dc.onmessage = (ev) => {
      try { this.onMessage(JSON.parse(String(ev.data))); } catch { /* ignore */ }
    };
  }

  /** @param {unknown} payload */
  send(payload) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(payload));
    }
  }

  close() {
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
  }
}

/** Future AI integration surface */
export const AIInterfaces = {
  /** @type {(url: string)=>Promise<Response>} */
  connectLocalLLM: async (url) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
  /** ONNX / transformers.js hooks */
  emotionFromText: (text) => ({ anger: text.includes('!') ? 0.5 : 0.1, pain: 0, fear: 0 }),
};
