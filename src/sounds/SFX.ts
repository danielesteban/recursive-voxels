import { mat4, quat, vec3 } from 'gl-matrix';
import BuildSFX from 'sounds/build.mp3';
import ShotSFX from 'sounds/shot.mp3';

export class SFX {
  private static readonly sounds = [
    { key: 'build', url: BuildSFX },
    { key: 'shot', url: ShotSFX },
  ];

  private readonly buffers: Map<string, AudioBuffer> = new Map();
  private context?: AudioContext;

  constructor() {
    this.onFirstInteraction = this.onFirstInteraction.bind(this);
    document.addEventListener('keydown', this.onFirstInteraction);
    document.addEventListener('pointerdown', this.onFirstInteraction);
  }
  
  onFirstInteraction() {
    const { buffers } = this;
    const { sounds } = SFX;
    document.removeEventListener('keydown', this.onFirstInteraction);
    document.removeEventListener('pointerdown', this.onFirstInteraction);
    const context = this.context = new AudioContext();
    sounds.forEach(async ({ key, url }) => {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      buffers.set(key, buffer);
    });
  }

  playAt(
    sound: string,
    position: vec3,
    volume: number = 1,
    detune: number = 0,
    filtering?: BiquadFilterOptions
  ) {
    const { buffers, context } = this;
    const buffer = buffers.get(sound);
    if (!buffer || !context) {
      return;
    }
    const source = new AudioBufferSourceNode(context, { buffer, detune });
    const gain = new GainNode(context, { gain: volume });
    const panner = new PannerNode(context, {
      panningModel: 'HRTF',
      refDistance: 8,
      positionX: position[0],
      positionY: position[1],
      positionZ: position[2],
    });
    source.connect(panner);
    panner.connect(gain);
    let filter: BiquadFilterNode | undefined;
    if (filtering) {
      filter = new BiquadFilterNode(context, filtering);
      gain.connect(filter);
      filter.connect(context.destination);
    } else {
      gain.connect(context.destination);
    }
    source.onended = () => {
      source.disconnect(panner);
      panner.disconnect(gain);
      if (filter) {
        filter.disconnect(context.destination);
      } else {
        gain.disconnect(context.destination);
      }
    };
    source.start(context.currentTime);
  }

  private static readonly aux1 = vec3.create();
  private static readonly aux2 = quat.create();
  private static readonly aux3 = vec3.create();
  private static readonly aux4 = vec3.create();
  private static readonly aux5 = vec3.create();
  updateListener(delta: number, transform: mat4) {
    const { context } = this;
    const { aux1: position, aux2: rotation, aux3: scale, aux4: forward, aux5: up } = SFX;
    if (!context) {
      return;
    }
    const { listener } = context;
    const time = context.currentTime + delta;
    mat4.decompose(rotation, position, scale, transform);
    vec3.transformQuat(forward, vec3.set(forward, 0, 0, -1), rotation);
		vec3.transformQuat(up, vec3.set(up, 0, 1, 0), rotation);
    if (listener.positionX) {
      listener.positionX.linearRampToValueAtTime(position[0], time);
      listener.positionY.linearRampToValueAtTime(position[1], time);
      listener.positionZ.linearRampToValueAtTime(position[2], time);
      listener.forwardX.linearRampToValueAtTime(forward[0], time);
      listener.forwardY.linearRampToValueAtTime(forward[1], time);
      listener.forwardZ.linearRampToValueAtTime(forward[2], time);
      listener.upX.linearRampToValueAtTime(up[0], time);
      listener.upY.linearRampToValueAtTime(up[1], time);
      listener.upZ.linearRampToValueAtTime(up[2], time);
    } else {
      listener.setPosition(position[0], position[1], position[2]);
			listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
    }
  }
}
