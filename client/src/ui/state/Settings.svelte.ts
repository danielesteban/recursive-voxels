const storageKey = 'recursive-voxels:settings';
const storageVersion = 1
const initial = {
  fov: 75,
  resolution: 1,
};
const stored = localStorage.getItem(storageKey);
if (stored) {
  try {
    let data = JSON.parse(stored);
    if (
      data.version !== storageVersion
      || typeof data.fov !== 'number'
      || typeof data.resolution !== 'number'
    ) {
      throw new Error('Unsupported settings version');
    }
    initial.fov = data.fov;
    initial.resolution = data.resolution;
  } catch (e) {}
}
const persist = () => {
  localStorage.setItem(storageKey, JSON.stringify({
    fov,
    resolution,
    version: storageVersion,
  }));
};

let fov = $state(initial.fov);
let onFov = $state<(() => void) | null>(null);
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
  get resolution() { return resolution },
  set resolution(value) {
    resolution = value;
    persist();
    onResolution?.();
  },
  get onResolution() { return onResolution },
  set onResolution(value) { onResolution = value },
};
