import { vec3 } from 'gl-matrix';
import { Physics, PhysicsLayer } from 'compute/Physics';
import { VoxelMesher } from 'compute/VoxelMesher';
import { VoxelPhysics } from 'compute/VoxelPhysics';
import { VoxelVolume } from 'compute/VoxelVolume';
import { BlockType, ChunkSize } from 'compute/WorldConstants';

export type Config = {
  generator: string;
  size: vec3;
};

export type Generator = (
  (blockType: typeof BlockType, size: vec3) =>
    (x: number, y: number, z: number) => number
);

export type Operation = (
  {
    op: 'ball',
    position: vec3,
    impulse: vec3,
  }
  | {
    op: 'balls',
    buffer: Float32Array,
  }
  | {
    op: 'chunk',
    buffers: {
      index: Uint16Array<ArrayBuffer>;
      vertices: Float32Array<ArrayBuffer>;
      lightmap: Uint8Array<ArrayBuffer>;
    },
    position: vec3,
  }
  | {
    op: 'update',
    voxel: vec3,
    value: BlockType,
  }
);

Promise.all([
  Physics.create(),
  new Promise<VoxelVolume>((resolve) => {
    self.onmessage = ({ data: { size, generator } }: { data: Config }) => {
      self.onmessage = null;
      resolve(new VoxelVolume(size, (new Function(`return ${generator}`)() as Generator)(BlockType, size)));
    };
  }),
])
.then(([physics, volume]) => {
  const VolumeSize = volume.getSize();
  const VolumeChunks = vec3.scale(vec3.create(), VolumeSize, 1 / ChunkSize);

  const ballBodies = new Map<number, ReturnType<Physics['addBody']>>();
  const chunkBodies = new Map<string, ReturnType<Physics['addBody']>[]>();

  const updateChunk = (position: vec3, updatePhysics: boolean) => {
    const buffers = VoxelMesher(position, volume);
    postMessage({
      op: 'chunk',
      buffers,
      position,
    } satisfies Operation);

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
    if (!buffers.index.length) {
      return;
    }
    const shape = physics.getShape(
      { type: 'voxels', boxes },
    );
    const worldPosition = vec3.scale(vec3.create(), position, ChunkSize);
    bodies = [];
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
    chunkBodies.set(key, bodies);
  };

  for (let z = 0; z < VolumeChunks[2]; z++) {
    for (let y = 0; y < VolumeChunks[1]; y++) {
      for (let x = 0; x < VolumeChunks[0]; x++) {
        updateChunk(vec3.fromValues(x, y, z), true);
      }
    }
  }

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
          body = physics.addBody(shape, position, PhysicsLayer.dynamic);
          ballBodies.set(ballId, body);
        }
        physics.addBodyImpulse(body, impulse);
        ballId = (ballId + 1) % 32;
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
        break;
      }
    }
  };

  setInterval(() => {
    physics.step();

    {
      let bufferOffset = 0;
      const buffer = new Float32Array(ballBodies.size * 4);
      for (const [id, body] of ballBodies.entries()) {
        const pos = body.GetPosition();
        const position = vec3.fromValues(pos.GetX(), pos.GetY(), pos.GetZ());
        let update = false;
        while (position[0] < 0) { position[0] += VolumeSize[0]; update = true; }
        while (position[0] >= VolumeSize[0]) { position[0] -= VolumeSize[0]; update = true; }
        while (position[1] < 0) { position[1] += VolumeSize[1]; update = true; }
        while (position[1] >= VolumeSize[1]) { position[1] -= VolumeSize[1]; update = true; }
        while (position[2] < 0) { position[2] += VolumeSize[2]; update = true; }
        while (position[2] >= VolumeSize[2]) { position[2] -= VolumeSize[2]; update = true; }
        if (update) physics.setBodyPosition(body, position);
        buffer.set([
          id,
          position[0],
          position[1],
          position[2],
        ], bufferOffset);
        bufferOffset += 4;
      }
      postMessage({
        op: 'balls',
        buffer,
      } satisfies Operation);
    }
  }, 1000 / 60);
});
