import { vec3 } from 'gl-matrix';
import { BlockType, ChunkSize } from '@shared/WorldConstants';
import { GeneratorEscher } from '@shared/WorldGeneration';
import { Ball } from 'objects/Ball';
import { Chunk } from 'objects/Chunk';
import { Player } from 'objects/Player';
import { RecursiveInstances } from 'compute/RecursiveInstances';
import { VoxelLightmap } from 'compute/VoxelLightmap';
import type { Renderer } from 'render/Renderer';
import type { Config, Init, Operation } from 'workers/World';
import Worker from 'workers/World?worker';

export class World {
  private static readonly storageKey = `recursive-voxels:volume`;

  private readonly balls = new Map<number, Ball>();
  private readonly chunks = new Map<string, Chunk>();
  private readonly peers = new Map<string, Player>();
  private instances?: RecursiveInstances;
  private lightmap?: VoxelLightmap;
  private readonly player = vec3.create();
  private readonly renderer: Renderer;
  private readonly size = vec3.create();
  private worker?: Worker;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
  }

  destroy() {
    const { balls, chunks, instances, lightmap, peers, renderer, worker } = this;
    for (const ball of balls.values()) {
      renderer.removeObject(ball);
    }
    balls.clear();
    for (const chunk of chunks.values()) {
      renderer.removeObject(chunk);
    }
    chunks.clear();
    for (const peer of peers.values()) {
      renderer.removeObject(peer);
    }
    peers.clear();
    instances?.destroy();
    delete this.instances;
    lightmap?.destroy();
    delete this.lightmap;
    worker?.terminate();
    delete this.worker;
  }

  animate() {
    const { instances } = this;
    instances?.update();
  }

  init(server?: string) {
    const { renderer } = this;
    this.destroy();
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker();
      worker.onmessage = ({ data }: { data: Init }) => {
        if (!data.config || data.error) {
          reject(new Error(data.error));
          return;
        }
        const { config } = data;
        worker.onmessage = this.onWorkerMessage.bind(this);
        this.instances = new RecursiveInstances(renderer, config.size);
        this.lightmap = new VoxelLightmap(renderer, config.size);
        vec3.copy(this.size, config.size);
        this.worker = worker;
        resolve();
      };
      if (server) {
        worker.postMessage({
          server,
        } satisfies Config);
      } else {
        const stored = localStorage.getItem(World.storageKey);
        worker.postMessage((
          stored ? {
            data: stored,
          } : {
            generator: GeneratorEscher,
            size: vec3.scale(vec3.create(), vec3.fromValues(4, 4, 4), ChunkSize),
          }
        ) satisfies Config);
      }
    });
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

  setPlayerMovement(direction: vec3, movement: vec3) {
    const { worker } = this;
    worker?.postMessage({
      op: 'playerMovement',
      direction,
      movement,
    } satisfies Operation);
  }

  shootBall(position: vec3, impulse: vec3) {
    const { worker } = this;
    worker?.postMessage({
      op: 'ball',
      position,
      impulse,
    } satisfies Operation);
  }

  update(voxel: vec3, value: BlockType) {
    const { worker } = this;
    worker?.postMessage({
      op: 'update',
      voxel,
      value,
    } satisfies Operation);
  }

  undo() {
    const { worker } = this;
    worker?.postMessage({
      op: 'undo',
    } satisfies Operation);
  }

  redo() {
    const { worker } = this;
    worker?.postMessage({
      op: 'redo',
    } satisfies Operation);
  }

  pauseSimulation() {
    const { worker } = this;
    worker?.postMessage({
      op: 'pauseSimulation',
    } satisfies Operation);
  }

  resumeSimulation() {
    const { worker } = this;
    worker?.postMessage({
      op: 'resumeSimulation',
    } satisfies Operation);
  }

  private onWorkerMessage({ data }: { data: Operation }) {
    const { balls, chunks, instances, lightmap, peers, player, renderer, worker } = this;
    switch (data.op) {
      case 'balls': {
        const { buffer } = data;
        for (let i = 0, l = buffer.length; i < l; i += 4) {
          let ball = balls.get(buffer[i]);
          if (!ball) {
            ball = new Ball(renderer, instances!, lightmap!);
            balls.set(buffer[i], ball);
            renderer.addObject(ball);
          }
          ball.position = buffer.subarray(i + 1, i + 4);
        }
        worker!.postMessage({
          op: 'balls',
          buffer,
        } satisfies Operation, [buffer.buffer]);
        break;
      }
      case 'chunk': {
        const { buffers, position } = data;
        lightmap!.update(position, buffers.lightmap);
        const key = `${position[0]}:${position[1]}:${position[2]}`;
        let chunk = chunks.get(key);
        if (chunk) {
          chunks.delete(key);
          renderer.removeObject(chunk);
        }
        if (!buffers.index.length) {
          return;
        }
        chunk = new Chunk(renderer, buffers, instances!, position);
        chunks.set(key, chunk);
        renderer.addObject(chunk);
        break;
      }
      case 'peer': {
        const { id, position, direction } = data;
        let peer = peers.get(id);
        if (!peer) {
          peer = new Player(renderer, instances!, lightmap!, position, direction);
          peers.set(id, peer);
          renderer.addObject(peer);
        }
        peer.update(position, direction);
        break;
      }
      case 'peerDisconnected': {
        const { id } = data;
        if (peers.has(id)) {
          renderer.removeObject(peers.get(id)!);
          peers.delete(id);
        }
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
      case 'disconnected':
        // @dani @incomplete
        // Notify user with a dialog
        this.destroy();
        break;
    }
  }
}
