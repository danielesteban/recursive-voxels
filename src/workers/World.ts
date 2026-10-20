import { vec3 } from 'gl-matrix';
import { Physics, PhysicsLayer } from 'compute/Physics';
import { VoxelMesher } from 'compute/VoxelMesher';
import { VoxelPhysics } from 'compute/VoxelPhysics';
import { VoxelVolume } from 'compute/VoxelVolume';
import { BlockType, ChunkSize } from 'compute/WorldConstants';

export type Config = {
  data?: string;
  generator?: string;
  size: vec3;
};

export type Generator = (
  (blockType: typeof BlockType, size: vec3) =>
    (x: number, y: number, z: number) => number
);

export type Operation = (
  {
    op: 'ball';
    position: vec3;
    impulse: vec3;
  }
  | {
    op: 'balls';
    buffer: Float32Array;
  }
  | {
    op: 'chunk';
    buffers: {
      index: Uint16Array<ArrayBuffer>;
      vertices: Float32Array<ArrayBuffer>;
      lightmap: Uint8Array<ArrayBuffer>;
    },
    position: vec3;
  }
  | {
    op: 'update';
    voxel: vec3;
    value: BlockType;
  }
  | {
    op: 'save';
    volume: string;
  }
);

Promise.all([
  Physics.create(),
  new Promise<VoxelVolume>((resolve) => {
    self.onmessage = async ({ data: config }: { data: Config }) => {
      self.onmessage = null;
      const volume = new VoxelVolume(config.size);
      if (config.data) {
        await volume.load(config.data);
      }
      if (config.generator) {
        volume.generate(
          (new Function(`return ${config.generator}`)() as Generator)(BlockType, config.size)
        );
      }
      resolve(volume);
    };
  }),
])
.then(([physics, volume]) => {
  const VolumeSize = volume.getSize();
  const VolumeChunks = vec3.scale(vec3.create(), VolumeSize, 1 / ChunkSize);

  const maxBalls = 32;
  let ballsBuffer: Float32Array | null = new Float32Array(maxBalls * 4);

  const ballBodies = new Map<number, ReturnType<Physics['addBody']>>();
  const chunkBodies = new Map<string, ReturnType<Physics['addBody']>[]>();

  const updateChunk = (position: vec3, updatePhysics: boolean) => {
    const buffers = VoxelMesher(position, volume);
    postMessage({
      op: 'chunk',
      buffers,
      position,
    } satisfies Operation, [buffers.index.buffer, buffers.vertices.buffer]);

    if (!updatePhysics) {
      return;
    }

    const boxes = VoxelPhysics(position, volume);
    const key = `${position[0]}:${position[1]}:${position[2]}`;
    let bodies = chunkBodies.get(key);
    if (bodies) {
      chunkBodies.delete(key);
      for (const body of bodies) {
        physics.removeBody(body);
      }
    }
    if (!boxes.length) {
      return;
    }
    bodies = [];
    chunkBodies.set(key, bodies);
    const shape = physics.getShape({ type: 'voxels', boxes });
    const worldPosition = vec3.scale(vec3.create(), position, ChunkSize);
    for (let z = -1; z <= 1; z++) {
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          const instance = vec3.fromValues(x, y, z);
          vec3.multiply(instance, instance, VolumeSize);
          const body = physics.addBody(
            shape,
            vec3.add(vec3.create(), instance, worldPosition),
            PhysicsLayer.static
          );
          bodies.push(body);      
        }
      }
    }
    shape.Release();
  };

  for (let z = 0; z < VolumeChunks[2]; z++) {
    for (let y = 0; y < VolumeChunks[1]; y++) {
      for (let x = 0; x < VolumeChunks[0]; x++) {
        updateChunk(vec3.fromValues(x, y, z), true);
      }
    }
  }

  let saveTimer = 0;
  const save = async () => {
    const data = await volume.save();
    postMessage({
      op: 'save',
      volume: data,
    } satisfies Operation);
  };

  let ballId = 0;
  self.onmessage = ({ data }: { data: Operation }) => {
    switch (data.op) {
      case 'ball': {
        const { position, impulse } = data;
        let body = ballBodies.get(ballId);
        if (body) {
          physics.setBodyPosition(body, position, true);
        } else {
          const shape = physics.getShape({ type: 'sphere', radius: 0.5 });
          body = physics.addBody(shape, position, PhysicsLayer.dynamic, false);
          ballBodies.set(ballId, body);
        }
        physics.addBodyImpulse(body, impulse);
        ballId = (ballId + 1) % 32;
        break;
      }
      case 'balls': {
        const { buffer } = data;
        ballsBuffer = new Float32Array(buffer.buffer, 0, maxBalls * 4);
        break;
      }
      case 'update': {
        const { voxel, value } = data;
        const affectedChunks = new Set<string>();
        const affectedChunksPhysics = new Set<string>();
        const chunk = vec3.create();
        const position = vec3.create();
        // for (let z = -1; z <= 1; z++) {
        //   for (let y = -1; y <= 1; y++) {
        //     for (let x = -1; x <= 1; x++) { 
        //       volume.wrap(vec3.set(position, voxel[0] + x, voxel[1] + y, voxel[2] + z));
              volume.wrap(vec3.set(position, voxel[0], voxel[1], voxel[2]));
              if (volume.update(affectedChunks, position, value)) {
                vec3.scale(chunk, position, 1 / ChunkSize);
                vec3.floor(chunk, chunk);
                affectedChunksPhysics.add(`${chunk[0]}:${chunk[1]}:${chunk[2]}`);
              }
        //     }
        //   }
        // }
        for (const key of affectedChunks) {
          const p = key.split(':');
          const affectedChunk = vec3.fromValues(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
          updateChunk(affectedChunk, affectedChunksPhysics.has(key));
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 1000);
        break;
      }
    }
  };

  const aux = vec3.create();
  setInterval(() => {
    physics.step();

    {
      let bufferOffset = 0;
      for (const [id, body] of ballBodies.entries()) {
        const pos = body.GetPosition();
        vec3.set(aux, pos.GetX(), pos.GetY(), pos.GetZ());
        let update = false;
        while (aux[0] < 0) { aux[0] += VolumeSize[0]; update = true; }
        while (aux[0] >= VolumeSize[0]) { aux[0] -= VolumeSize[0]; update = true; }
        while (aux[1] < 0) { aux[1] += VolumeSize[1]; update = true; }
        while (aux[1] >= VolumeSize[1]) { aux[1] -= VolumeSize[1]; update = true; }
        while (aux[2] < 0) { aux[2] += VolumeSize[2]; update = true; }
        while (aux[2] >= VolumeSize[2]) { aux[2] -= VolumeSize[2]; update = true; }
        if (update) physics.setBodyPosition(body, aux);
        ballsBuffer?.set([
          id,
          aux[0],
          aux[1],
          aux[2],
        ], bufferOffset);
        bufferOffset += 4;
      }
      if (ballsBuffer) {
        postMessage({
          op: 'balls',
          buffer: ballsBuffer.subarray(0, ballBodies.size * 4),
        } satisfies Operation, [ballsBuffer.buffer]);
        ballsBuffer = null;
      }
    }
  }, 1000 / 60);
});
