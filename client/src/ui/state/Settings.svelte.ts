const storageKey = 'recursive-voxels:settings';
const storageVersion = 1
const initial = {
  fov: 75,
  muteSFX: false,
  renderDistance: 512,
  resolution: 1,
};
const stored = localStorage.getItem(storageKey);
if (stored) {
  try {
    let data = JSON.parse(stored);
    if (
      data.version !== storageVersion
      || typeof data.fov !== 'number'
      || typeof data.muteSFX !== 'boolean'
      || typeof data.renderDistance !== 'number'
      || typeof data.resolution !== 'number'
    ) {
      throw new Error('Unsupported settings version');
    }
    initial.fov = data.fov;
    initial.muteSFX = data.muteSFX;
    initial.renderDistance = data.renderDistance;
    initial.resolution = data.resolution;
  } catch (e) {}
}
const persist = () => {
  localStorage.setItem(storageKey, JSON.stringify({
    fov,
    muteSFX,
    renderDistance,
    resolution,
    version: storageVersion,
  }));
};

let fov = $state(initial.fov);
let onFov = $state<(() => void) | null>(null);
let muteSFX = $state(initial.muteSFX);
let onMuteSFX = $state<(() => void) | null>(null);
let renderDistance = $state(initial.renderDistance);
let onRenderDistance = $state<(() => void) | null>(null);
let resolution = $state(initial.resolution);
let onResolution = $state<(() => void) | null>(null);

export const Settings = {
  get fov() { return fov },
  set fov(value) {
    fov = value;
    persist();
    onFov?.();
  },
  get onFov() { return onFov },
  set onFov(value) { onFov = value },
  get muteSFX() { return muteSFX },
  set muteSFX(value) {
    muteSFX = value;
    persist();
    onMuteSFX?.();
  },
  get onMuteSFX() { return onMuteSFX },
  set onMuteSFX(value) { onMuteSFX = value },
  get renderDistance() { return renderDistance },
  set renderDistance(value) {
    renderDistance = value;
    persist();
    onRenderDistance?.();
  },
  get onRenderDistance() { return onRenderDistance },
  set onRenderDistance(value) { onRenderDistance = value },
  get resolution() { return resolution },
  set resolution(value) {
    resolution = value;
    persist();
    onResolution?.();
  },
  get onResolution() { return onResolution },
  set onResolution(value) { onResolution = value },
};
