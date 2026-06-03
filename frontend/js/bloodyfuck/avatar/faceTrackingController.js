/**
 * MediaPipe Face Landmarker → head rotation + blendshapes.
 * Gracefully no-ops when CDN script unavailable.
 */
export class FaceTrackingController {
  /** @param {import('./blendshapeController.js').BlendshapeController} blend */
  constructor(blend) {
    this.blend = blend;
    this.enabled = false;
    this.landmarker = null;
    this.video = null;
    /** @type {number|null} */
    this.raf = null;
  }

  async init() {
    try {
      const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm');
      const { FaceLandmarker, FilesetResolver } = vision;
      const files = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      this.landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      this.video = document.createElement('video');
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.width = 320;
      this.video.height = 240;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320 }, audio: false });
      this.video.srcObject = stream;
      await this.video.play();
      this.enabled = true;
      this._loop();
    } catch {
      this.enabled = false;
    }
  }

  _loop = () => {
    if (!this.enabled || !this.landmarker || !this.video) return;
    const result = this.landmarker.detectForVideo(this.video, performance.now());
    if (result.faceLandmarks?.[0]) {
      const lm = result.faceLandmarks[0];
      const upper = lm[10];
      const lower = lm[152];
      const left = lm[234];
      const right = lm[454];
      const mouthOpen = Math.min(1, Math.hypot(upper.x - lower.x, upper.y - lower.y) * 8);
      const yaw = (left.z - right.z) * 2;
      const pitch = (upper.y - lower.y) * 0.5;
      this.blend.root.rotation.y = yaw * 0.4;
      this.blend.root.rotation.x = pitch * 0.2;
      this.blend.setValues({ mouthOpen, browDown: 0, blink: 0 });
    }
    this.raf = requestAnimationFrame(this._loop);
  };

  dispose() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.video?.srcObject) {
      /** @type {MediaStream} */ (this.video.srcObject).getTracks().forEach((t) => t.stop());
    }
    this.enabled = false;
  }
}
