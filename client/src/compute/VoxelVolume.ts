import { vec3 } from 'gl-matrix';
import { BlockType, ChunkSize, isLight, isOpaque, MaxLight } from '@shared/WorldConstants';

export class VoxelVolume {
  private static readonly lightNeighbors: vec3[] = [
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(-1, 0, 0),
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 0, -1),
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(0, -1, 0),
  ];

  private readonly data: ArrayBuffer;
  private readonly size: vec3;
  private readonly encoder: {
    canvas: OffscreenCanvas;
    ctx: OffscreenCanvasRenderingContext2D;
    pixels: ImageData;
  };
  private readonly history: {
    undo: { position: vec3; undo: number; redo: number }[];
    redo: { position: vec3; undo: number; redo: number }[];
  } = {
    undo: [],
    redo: [],
  };

  constructor(size: vec3) {
    this.data = new ArrayBuffer(size[0] * size[1] * size[2] * 2);
    this.size = size;

    const encoderSize = Math.ceil(Math.sqrt((size[0] * size[1] * size[2]) / 3));
    const encoderCanvas = new OffscreenCanvas(encoderSize, encoderSize);
    this.encoder = {
      canvas: encoderCanvas,
      ctx: encoderCanvas.getContext('2d')!,
      pixels: new ImageData(encoderCanvas.width, encoderCanvas.height),
    };
  }

  generate(generator: (x: number, y: number, z: number) => number) {
    const { data, size } = this;
    const lightQueue: Int16Array[] = [];
    for (let i = 0, z = 0; z < size[2]; z++) {
      for (let y = 0; y < size[1]; y++) {
        for (let x = 0; x < size[0]; x++, i += 2) {
          const value = generator(x, y, z);
          const voxel = new Uint8Array(data, i, 2);
          voxel[0] = value;
          if (isLight(value)) {
            voxel[1] = MaxLight;
            lightQueue.push(new Int16Array([x, y, z]));
          }
        }
      }
    }
    this.floodLight(new Set(), lightQueue);
  }
  
  // @dani @incomplete
  // This should prolly be the same
  // regardless of it's encoded or not.
  // But for that it should be encoded just with zLib
  // Instead of the PNG encoding.
  async load(buffer: Uint8Array) {
    const { data, size } = this;
    const lightQueue: Int16Array[] = [];
    for (let i = 0, z = 0; z < size[2]; z++) {
      for (let y = 0; y < size[1]; y++) {
        for (let x = 0; x < size[0]; x++, i++) {
          const value = buffer[i];
          const voxel = new Uint8Array(data, i * 2, 2);
          voxel[0] = value;
          if (isLight(value)) {
            voxel[1] = MaxLight;
            lightQueue.push(new Int16Array([x, y, z]));
          }
        }
      }
    }
    this.floodLight(new Set(), lightQueue);
  }

  async loadEncoded(encoded: string) {
    const { data, encoder, size } = this;
    const res = await fetch(`data:image/png;base64,` + encoded);
    const blob = await res.blob();
    const image = await createImageBitmap(blob);
    encoder.ctx.drawImage(image, 0, 0);
    image.close();
    const pixels = encoder.ctx.getImageData(0, 0, encoder.canvas.width, encoder.canvas.height);
    const lightQueue: Int16Array[] = [];
    for (let i = 0, p = 0, z = 0; z < size[2]; z++) {
      for (let y = 0; y < size[1]; y++) {
        for (let x = 0; x < size[0]; x++, i += 2, p++) {
          const value = pixels.data[p];
          if (p % 4 === 2) p++;
          const voxel = new Uint8Array(data, i, 2);
          voxel[0] = value;
          if (isLight(value)) {
            voxel[1] = MaxLight;
            lightQueue.push(new Int16Array([x, y, z]));
          }
        }
      }
    }
    this.floodLight(new Set(), lightQueue);
  }

  async save() {
    const { data, encoder } = this;
    for (let i = 0, p = 0, l = data.byteLength; i < l; i += 2, p++) {
      encoder.pixels.data[p] = new Uint8Array(data, i, 2)[0];
      if (p % 4 === 2) {
        p++;
        encoder.pixels.data[p] = 255;
      }
    }
    encoder.ctx.putImageData(encoder.pixels, 0, 0);
    const blob = await encoder.canvas.convertToBlob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject();
      reader.onload = () => resolve((reader.result as string).substring('data:image/png;base64,'.length));
      reader.readAsDataURL(blob);
    });
  }

  getSize(): Readonly<vec3> {
    const { size } = this;
    return size;
  }

  sample(position: vec3) {
    const { data, size } = this;
    return new Uint8Array(data, (position[2] * size[1] * size[0] + position[1] * size[0] + position[0]) * 2, 2);
  }

  private static readonly aux1 = vec3.create();
  update(affected: Set<string>, position: vec3, value: BlockType, addToHistory = true) {
    const { history } = this;
    const { aux1: neighborPosition, lightNeighbors } = VoxelVolume;
    const voxel = this.sample(position);
    const current = voxel[0];
    if (current === value) {
      return false;
    }
    voxel[0] = value;
    this.expandAffectedChunks(affected, position);
    if (isLight(current)) {
      const level = voxel[1];
      voxel[1] = 0;
      this.removeLight(affected, [new RemoveLightQueueEntry(position, level)]);
    }
    if (!isOpaque(current) && isOpaque(value) && voxel[1] !== 0) {
      const level = voxel[1];
      voxel[1] = 0;
      this.removeLight(affected, [new RemoveLightQueueEntry(position, level)]);
    }
    if (isLight(value)) {
      voxel[1] = MaxLight;
      this.floodLight(affected, [new Int16Array(position)]);
    }
    if (!isOpaque(value) && isOpaque(current)) {
      const queue: Int16Array[] = [];
      for (const offset of lightNeighbors) {
        this.wrap(vec3.add(neighborPosition, position, offset));
        const neighbor = this.sample(neighborPosition);
        if (neighbor[1] !== 0) {
          queue.push(new Int16Array(neighborPosition));
        }
      }
      this.floodLight(affected, queue);
    }
    if (addToHistory) {
      history.undo.push({ position, undo: current, redo: value });
      history.redo.length = 0;
    }
    return true;
  }

  undo(affected: Set<string>) {
    const { history } = this;
    const update = history.undo.pop();
    if (!update) {
      return;
    }
    history.redo.push(update);
    this.update(affected, update.position, update.undo, false);
    return update;
  }

  redo(affected: Set<string>) {
    const { history } = this;
    const update = history.redo.pop();
    if (!update) {
      return;
    }
    history.undo.push(update);
    this.update(affected, update.position, update.redo, false);
    return update;
  }

  wrap(position: vec3) {
    const { size } = this;
    while (position[0] < 0) position[0] += size[0];
    while (position[0] >= size[0]) position[0] -= size[0];
    while (position[1] < 0) position[1] += size[1];
    while (position[1] >= size[1]) position[1] -= size[1];
    while (position[2] < 0) position[2] += size[2];
    while (position[2] >= size[2]) position[2] -= size[2];
    return position;
  }
  
  private static readonly aux2 = vec3.create();
  private floodLight(affected: Set<string>, queue: Int16Array[]) {
    const { aux2: neighborPosition, lightNeighbors } = VoxelVolume;
    const next: Int16Array[] = [];
    for (const entry of queue) {
      const level = this.sample(entry)[1];
      if (level === 0) {
        continue;
      }
      const nextLevel = level - 1;
      for (const offset of lightNeighbors) {
        this.wrap(vec3.add(neighborPosition, entry, offset));
        const neighbor = this.sample(neighborPosition);
        if (isOpaque(neighbor[0]) || neighbor[1] >= nextLevel) {
          continue;
        }
        neighbor[1] = nextLevel;
        this.expandAffectedChunks(affected, neighborPosition);
        next.push(new Int16Array(neighborPosition));
      }
    }
    queue.length = 0;
    if (next.length) {
      this.floodLight(affected, next);
    }
  }

  private static readonly aux3 = vec3.create();
  private removeLight(affected: Set<string>, queue: RemoveLightQueueEntry[]) {
    const { aux3: neighborPosition, lightNeighbors } = VoxelVolume;
    const next: RemoveLightQueueEntry[] = [];
    const flood: Int16Array[] = [];
    for (const entry of queue) {
      for (const offset of lightNeighbors) {
        this.wrap(vec3.add(neighborPosition, entry.position, offset));
        const neighbor = this.sample(neighborPosition);
        if (isOpaque(neighbor[0]) || neighbor[1] === 0) {
          continue;
        }
        if (neighbor[1] < entry.level) {
          const level = neighbor[1];
          neighbor[1] = 0;
          next.push(new RemoveLightQueueEntry(neighborPosition, level));
          this.expandAffectedChunks(affected, neighborPosition);
        } else {
          flood.push(new Int16Array(neighborPosition));
        }
      }
    }
    queue.length = 0;
    if (next.length) {
      this.removeLight(affected, next);
    }
    if (flood.length) {
      this.floodLight(affected, flood);
    }
  }

  private static readonly aux4 = vec3.create();
  private static readonly aux5 = vec3.create();
  private expandAffectedChunks(affectedChunks: Set<string>, position: vec3) {
    const { aux4: chunk, aux5: neighbor } = VoxelVolume;
    for (let z = -1; z <= 1; z++) {
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          this.wrap(vec3.set(neighbor, position[0] + x, position[1] + y, position[2] + z));
          vec3.scale(chunk, neighbor, 1 / ChunkSize);
          vec3.floor(chunk, chunk);
          affectedChunks.add(`${chunk[0]}:${chunk[1]}:${chunk[2]}`);
        }
      }
    }
  }
}

class RemoveLightQueueEntry {
  private readonly data: ArrayBuffer;

  constructor(position: vec3, level: number) {
    this.data = new ArrayBuffer(7);
    new Int16Array(this.data, 0, 3).set(position);
    new Uint8Array(this.data, 6, 1)[0] = level;
  }

  get position(): Readonly<Int16Array> {
    const { data } = this;
    return new Int16Array(data, 0, 3);
  }

  get level() {
    const { data } = this;
    return new Uint8Array(data, 6, 1)[0];
  }
}
