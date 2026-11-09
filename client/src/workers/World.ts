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
    };
    position: vec3;
  }
  | {
    op: 'player';
    position: vec3;
  }
  | {
    op: 'playerMovement';
    movement: vec3;
  }
  | {
    op: 'update';
    voxel: vec3;
    value: BlockType;
  }
  | {
    op: 'undo';
  }
  | {
    op: 'redo';
  }
  | {
    op: 'save';
    volume: string;
  }
  | {
    op: 'sfx';
    sound: string;
    position: vec3;
    volume?: number;
    detune?: number;
    filter?: BiquadFilterOptions;
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

  const player = {
    body: physics.addBody({
      allowRotation: false,
      gravityFactor: 0,
      layer: PhysicsLayer.dynamic,
      mass: 1000,
      position: vec3.create(),
      shape: physics.getShape({ type: 'sphere', radius: 0.5 }),
    }),
    movement: vec3.create(),
    velocity: vec3.create(),
  };

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
          const body = physics.addBody({
            layer: PhysicsLayer.static,
            position: vec3.add(vec3.create(), instance, worldPosition),
            shape,
          });
          bodies.push(body);      
        }
      }
    }
    shape.Release();
  };

  const aux = vec3.create();
  const wrapBody = (body: ReturnType<Physics['addBody']>) => {
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
    return aux;
  };

  let saveTimer = 0;
  const save = async () => {
    const data = await volume.save();
    postMessage({
      op: 'save',
      volume: data,
    } satisfies Operation);
  };

  const targets = Array.from({ length: 3 * 3 * 3 }, () => vec3.create());
  const playSFX = (sfx: {
    sound: string;
    position: vec3;
    volume?: number;
    detune?: number;
    filter?: BiquadFilterOptions;
  }) => {
    for (let i = 0, z = -1; z <= 1; z++) {
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++, i++) {
          const target = targets[i];
          vec3.set(target, x, y, z);
          vec3.multiply(target, target, VolumeSize);
          vec3.add(target, target, sfx.position);
        }
      }
    }
    const playerPosition = player.body.GetPosition();
    vec3.set(aux, playerPosition.GetX(), playerPosition.GetY(), playerPosition.GetZ());
    targets.sort((a, b) => vec3.sqrDist(a, aux) - vec3.sqrDist(b, aux));
    postMessage({
      op: 'sfx',
      ...sfx,
      position: targets[0],
    } satisfies Operation);
  };

  const contactSfxPosition = vec3.create();
  const playContactSFX = (body: ReturnType<Physics['addBody']>, force: number) => {
    const position = body.GetPosition();
    vec3.set(contactSfxPosition, position.GetX(), position.GetY(), position.GetZ());
    playSFX({
      sound: 'shot',
      position: contactSfxPosition,
      volume: (1 - Math.sqrt(1 - Math.min(force / 10000, 1))) * 0.1,
      detune: Math.random() * 2000,
    });
  };

  const lastContactSFX = new Map<number, number>();
  physics.setOnContact((body1, body2, impulses) => {
    const time = performance.now() / 1000;
    let force = 0;
    for (let i = 0, l = impulses.size(); i < l; i++) {
      force += impulses.at(i);
    }
    if (
      force < 1000
      || Math.max(
        lastContactSFX.get(body1.GetID().GetIndexAndSequenceNumber()) || 0,
        lastContactSFX.get(body2.GetID().GetIndexAndSequenceNumber()) || 0
      ) >= time - 0.2
    ) {
      return;
    }

    if (body1.IsDynamic() && body1 !== player.body) {
      playContactSFX(body1, force);
    } else if (body2.IsDynamic() && body2 !== player.body) {
      playContactSFX(body2, force);
    }

    body1.IsDynamic() && lastContactSFX.set(body1.GetID().GetIndexAndSequenceNumber(), time);
    body2.IsDynamic() && lastContactSFX.set(body2.GetID().GetIndexAndSequenceNumber(), time);
  });

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
        volume.wrap(position);
        let body = ballBodies.get(ballId);
        if (body) {
          physics.setBodyPosition(body, position, true);
        } else {
          body = physics.addBody({
            allowSleeping: false,
            layer: PhysicsLayer.dynamic,
            position,
            shape: physics.getShape({ type: 'sphere', radius: 0.5 }),
          });
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
      case 'playerMovement': {
        const { movement } = data;
        vec3.copy(player.movement, movement);
        break;
      }
      case 'update':
      case 'undo':
      case 'redo': {
        const affectedChunks = new Set<string>();
        let update: { position: vec3; value: number };
        switch (data.op) {
          case 'update': {
            const { voxel, value } = data;
            const position = volume.wrap(vec3.set(vec3.create(), voxel[0], voxel[1], voxel[2]));
            if (!volume.update(affectedChunks, position, value)) {
              return;
            }
            update = { position, value };
            break;
          }
          case 'undo': {
            const op = volume.undo(affectedChunks);
            if (!op) {
              return;
            }
            update = { position: op.position, value: op.undo };
            break;
          }
          case 'redo': {
            const op = volume.redo(affectedChunks);
            if (!op) {
              return;
            }
            update = { position: op.position, value: op.redo };
            break;
          }
        }
        const affectedChunk = vec3.create();
        const updatedChunk = vec3.scale(vec3.create(), update.position, 1 / ChunkSize);
        vec3.floor(updatedChunk, updatedChunk);
        for (const key of affectedChunks) {
          const p = key.split(':');
          vec3.set(affectedChunk, parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
          updateChunk(affectedChunk, vec3.exactEquals(affectedChunk, updatedChunk));
        }
        playSFX({
          sound: 'build',
          position: vec3.add(vec3.create(), update.position, vec3.fromValues(0.5, 0.5, 0.5)),
          detune: (Math.random() - 0.5) * 1000,
          filter: { type: update.value !== BlockType.air ? 'lowpass': 'highpass', frequency: 1000 + Math.random() * 1000 },
        });
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 1000);
        break;
      }
    }
  };

  let lastTick = performance.now() / 1000;
  setInterval(() => {
    const time = performance.now() / 1000;
    const delta = Math.min(time - lastTick, 1 / 30);
    lastTick = time;

    const damp = Math.exp(-20 * delta);
    vec3.scale(player.velocity, player.velocity, damp);
    vec3.scaleAndAdd(player.velocity, player.velocity, player.movement, 1 - damp);
    physics.setBodyLinearVelocity(player.body, player.velocity);

    physics.step(delta);

    {
      let bufferOffset = 0;
      for (const [id, body] of ballBodies.entries()) {
        const position = wrapBody(body);
        ballsBuffer?.set([
          id,
          position[0],
          position[1],
          position[2],
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
    {
      const position = wrapBody(player.body);
      postMessage({
        op: 'player',
        position,
      } satisfies Operation);
    }
  }, 1000 / 60);
});
