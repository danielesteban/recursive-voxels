import type { vec3 } from 'gl-matrix';
import { Ball } from 'objects/Ball';
import { Chunk } from 'objects/Chunk';
import { RecursiveInstances } from 'compute/RecursiveInstances';
import { VoxelLightmap } from 'compute/VoxelLightmap';
import { BlockType, VolumeSize } from 'compute/WorldConstants';
import { GeneratorEscher } from 'compute/WorldGeneration';
import type { Renderer } from 'render/Renderer';
import type { Config, Operation } from 'workers/World';
import Worker from 'workers/World?worker';

export class World {
  private readonly balls = new Map<number, Ball>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly instances: RecursiveInstances;
  private readonly lightmap: VoxelLightmap;
  private readonly renderer: Renderer;
  private readonly worker: Worker;

  constructor(renderer: Renderer) {
    this.instances = new RecursiveInstances(renderer, VolumeSize);
    this.lightmap = new VoxelLightmap(renderer, VolumeSize);
    this.renderer = renderer;
    this.worker = new Worker();
    this.worker.onmessage = this.onWorkerMessage.bind(this);
    this.worker.postMessage({
      generator: GeneratorEscher,
      size: VolumeSize,
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

  private onWorkerMessage({ data }: { data: Operation }) {
    const { balls, chunks, instances, lightmap, renderer } = this;
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
    }
  }
}
