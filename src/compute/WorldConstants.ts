import { vec3 } from 'gl-matrix';

export enum BlockType {
  air,
  solid,
  light,
}

export const ChunkSize = 16;
export const MaxLight = 16;
// @dani @incomplete
// Create this size in the World object
// And pass it down to the World worker on init
// To be able to load Volumes with arbitrary sizes on runtime
export const VolumeSize = vec3.scale(vec3.create(), vec3.fromValues(4, 4, 4), ChunkSize);
