import { vec3 } from 'gl-matrix';
import { Ball } from 'objects/Ball';
import { Chunk } from 'objects/Chunk';
import { RecursiveInstances } from 'compute/RecursiveInstances';
import { VoxelLightmap } from 'compute/VoxelLightmap';
import { BlockType, ChunkSize } from 'compute/WorldConstants';
import { GeneratorEscher } from 'compute/WorldGeneration';
import type { Renderer } from 'render/Renderer';
import type { Config, Operation } from 'workers/World';
import Worker from 'workers/World?worker';

export class World {
  private static readonly storageKey = `recursive-voxels:volume:v1`;

  private readonly balls = new Map<number, Ball>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly instances: RecursiveInstances;
  private readonly lightmap: VoxelLightmap;
  private readonly player = vec3.create();
  private readonly renderer: Renderer;
  private readonly size: vec3;
  private readonly worker: Worker;

  constructor(renderer: Renderer) {
    const size = vec3.scale(vec3.create(), vec3.fromValues(4, 4, 4), ChunkSize);
    this.instances = new RecursiveInstances(renderer, size);
    this.lightmap = new VoxelLightmap(renderer, size);
    this.renderer = renderer;
    this.size = size;
    this.worker = new Worker();
    this.worker.onmessage = this.onWorkerMessage.bind(this);
    const stored = localStorage.getItem(World.storageKey);
    this.worker.postMessage({
      ...(stored ? { data: stored } : { generator: GeneratorEscher }),
      size,
    } satisfies Config);
  }

  destroy() {
    const { instances, lightmap, worker } = this;
    instances.destroy();
    lightmap.destroy();
    worker.terminate();
  }

  animate() {
    const { instances } = this;
    instances.update();
  }

  getChunks(): Chunk[] {
    const { chunks } = this;
    return Array.from(chunks.values());
  }

  getPlayer(): Readonly<vec3> {
    return this.player;
  }

  getSize(): Readonly<vec3> {
    return this.size;
  }

  setPlayerMovement(movement: vec3) {
    const { worker } = this;
    worker.postMessage({
      op: 'playerMovement',
      movement,
    } satisfies Operation);
  }

  shootBall(position: vec3, impulse: vec3) {
    const { worker } = this;
    worker.postMessage({
      op: 'ball',
      position,
      impulse,
    } satisfies Operation);
  }

  update(voxel: vec3, value: BlockType) {
    const { worker } = this;
    worker.postMessage({
      op: 'update',
      voxel,
      value,
    } satisfies Operation);
  }

  undo() {
    const { worker } = this;
    worker.postMessage({
      op: 'undo',
    } satisfies Operation);
  }

  redo() {
    const { worker } = this;
    worker.postMessage({
      op: 'redo',
    } satisfies Operation);
  }

  private onWorkerMessage({ data }: { data: Operation }) {
    const { balls, chunks, instances, lightmap, player, renderer, worker } = this;
    switch (data.op) {
      case 'balls': {
        const { buffer } = data;
        for (let i = 0, l = buffer.length; i < l; i += 4) {
          let ball = balls.get(buffer[i]);
          if (!ball) {
            ball = new Ball(renderer, instances, lightmap);
            balls.set(buffer[i], ball);
            renderer.addObject(ball);
          }
          ball.position = buffer.subarray(i + 1, i + 4);
        }
        worker.postMessage({
          op: 'balls',
          buffer,
        } satisfies Operation, [buffer.buffer]);
        break;
      }
      case 'chunk': {
        const { buffers, position } = data;
        lightmap.update(position, buffers.lightmap);
        const key = `${position[0]}:${position[1]}:${position[2]}`;
        let chunk = chunks.get(key);
        if (chunk) {
          chunks.delete(key);
          renderer.removeObject(chunk);
        }
        if (!buffers.index.length) {
          return;
        }
        chunk = new Chunk(renderer, buffers, instances, position);
        chunks.set(key, chunk);
        renderer.addObject(chunk);
        break;
      }
      case 'player': {
        const { position } = data;
        vec3.copy(player, position);
        break;
      }
      case 'save': {
        const { volume } = data;
        localStorage.setItem(World.storageKey, volume);
        break;
      }
      case 'sfx': {
        const { sound, position, volume, detune, filter } = data;
        renderer.getSFX().playAt(sound, position, volume, detune, filter);
        break;
      }
    }
  }
}
