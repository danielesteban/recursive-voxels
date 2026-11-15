import { vec3 } from 'gl-matrix';
import { BlockType, ChunkSize, type Generator } from '@shared/WorldConstants';
import { Physics, PhysicsLayer, PhysicsMotion } from 'compute/Physics';
import { VoxelMesher } from 'compute/VoxelMesher';
import { VoxelPhysics } from 'compute/VoxelPhysics';
import { VoxelVolume } from 'compute/VoxelVolume';
import { Server } from 'compute/WorldServer';

export type Config = {
  data?: string;
  generator?: string;
  server?: string;
  size?: vec3;
};

export type Init = {
  config?: {
    size: vec3;
  };
  error?: string;
};

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
    op: 'peer';
    id: string;
    position: vec3;
    direction: vec3;
  }
  | {
    op: 'peerDisconnected';
    id: string;
  }
  | {
    op: 'player';
    position: vec3;
  }
  | {
    op: 'playerMovement';
    direction: vec3;
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
  | {
    op: 'pauseSimulation';
  }
  | {
    op: 'resumeSimulation';
  }
  | {
    op: 'disconnected';
  }
);

Promise.all([
  Physics.create(),
  new Promise<{ server?: Server, volume: VoxelVolume }>((resolve, reject) => {
    self.onmessage = async ({ data: config }: { data: Config }) => {
      self.onmessage = null;
      try {
        let data: Uint8Array | string | undefined;
        let size: vec3 = config.size || vec3.scale(vec3.create(), vec3.fromValues(4, 4, 4), ChunkSize);
        let server: Server | undefined;
        if (config.data) {
          const world: { data: string; size: [number, number, number]; version: number } = JSON.parse(config.data);
          if (world.version !== 1) {
            throw new Error("Unsupported world version");
          }
          data = world.data;
          size = vec3.fromValues(world.size[0], world.size[1], world.size[2]);
        }
        if (config.server) {
          server = new Server();
          const world = await server.connect(`world/${config.server}`);
          data = world.data;
          size = vec3.fromValues(world.size!.x!, world.size!.y!, world.size!.z!);
        }
        const volume = new VoxelVolume(size);
        if (data) {
          await volume.load(data);
        }
        if (config.generator) {
          volume.generate(
            (new Function(`return ${config.generator}`)() as Generator)(BlockType, size as [number, number, number])
          );
        }
        resolve({ server, volume });
      } catch (e) {
        reject(e);
      }
    };
  }),
])
.then(([physics, { server, volume }]) => {
  const simulationRate = 1000 / 60; 

  const VolumeSize = volume.getSize();
  const VolumeChunks = vec3.scale(vec3.create(), VolumeSize, 1 / ChunkSize);

  const maxBalls = 32;
  let ballsBuffer: Float32Array | null = new Float32Array(maxBalls * 4);

  const ballBodies = new Map<number, ReturnType<Physics['addBody']>>();
  const chunkBodies = new Map<string, ReturnType<Physics['addBody']>[]>();
  const peers = new Map<string, {
    body: ReturnType<Physics['addBody']>;
    position: vec3;
    direction: vec3;
  }>();

  const player = {
    body: physics.addBody({
      allowRotation: false,
      gravityFactor: 0,
      layer: PhysicsLayer.dynamic,
      mass: 1000,
      position: vec3.create(),
      shape: physics.getShape({ type: 'sphere', radius: 0.5 }),
    }),
    direction: vec3.fromValues(0, 0, -1),
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

  const onUpdate = (affectedChunks: Set<string>, update: { position: vec3; value: number }) => {
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
  };

  let saveTimer = 0;
  const save = async () => {
    postMessage({
      op: 'save',
      volume: await volume.save(),
    } satisfies Operation);
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

  let lastTick = performance.now() / 1000;
  const simulate = () => {
    const time = performance.now() / 1000;
    const delta = Math.min(time - lastTick, 1 / 30);
    lastTick = time;

    const damp = Math.exp(-20 * delta);
    vec3.scale(player.velocity, player.velocity, damp);
    vec3.scaleAndAdd(player.velocity, player.velocity, player.movement, 1 - damp);
    physics.setBodyLinearVelocity(player.body, player.velocity);

    for (const peer of peers.values()) {
      physics.moveKinematic(peer.body, peer.position, delta);
    }

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
      server?.send({
        peer: {
          position: {
            x: position[0],
            y: position[1],
            z: position[2],
          },
          direction: {
            x: player.direction[0],
            y: player.direction[1],
            z: player.direction[2],
          },
        },
      });
    }

    // @dani @incomplete
    // Send all peers into a single message
    for (const [id, peer] of peers.entries()) {
      postMessage({
        op: 'peer',
        id,
        position: peer.position,
        direction: peer.direction,
      } satisfies Operation);
    }
  };

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
        const { direction, movement } = data;
        vec3.copy(player.direction, direction);
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
        onUpdate(affectedChunks, update);
        if (server) {
          server.send({
            update: {
              position: {
                x: update.position[0],
                y: update.position[1],
                z: update.position[2],
              },
              value: update.value,
            },
          });
          return;
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 1000);
        break;
      }
      case 'pauseSimulation':
        clearInterval(simulationInterval);
        break;
      case 'resumeSimulation':
        clearInterval(simulationInterval);
        simulationInterval = setInterval(simulate, simulationRate);
        break;
    }
  };

  server?.setOnDisconnect(() => {
    postMessage({
      op: 'disconnected',
    } satisfies Operation);
  });

  server?.setOnOperation((op) => {
    switch(op.type) {
      case 'peer': {
        let peer = peers.get(op.peer!.id!);
        if (!op.peer!.position || !op.peer!.direction) {
          if (peer) {
            physics.removeBody(peer.body);
            peers.delete(op.peer!.id!);
          }
          postMessage({
            op: 'peerDisconnected',
            id: op.peer!.id!,
          } satisfies Operation);
          return;
        }
        if (!peer) {
          const position = vec3.fromValues(
            op.peer!.position!.x!,
            op.peer!.position!.y!,
            op.peer!.position!.z!
          );
          peer = {
            body: physics.addBody({
              allowRotation: false,
              gravityFactor: 0,
              layer: PhysicsLayer.dynamic,
              mass: 1000,
              motion: PhysicsMotion.kinematic,
              position,
              shape: physics.getShape({ type: 'sphere', radius: 0.5 }),
            }),
            position,
            direction: vec3.create(),
          };
          peers.set(op.peer!.id!, peer);
        }
        vec3.set(
          peer.position,
          op.peer!.position!.x!,
          op.peer!.position!.y!,
          op.peer!.position!.z!
        );
        vec3.set(
          peer.direction,
          op.peer!.direction!.x!,
          op.peer!.direction!.y!,
          op.peer!.direction!.z!
        );
        break;
      }
      case 'update': {
        const affectedChunks = new Set<string>();
        const position = vec3.fromValues(
          op.update!.position!.x!,
          op.update!.position!.y!,
          op.update!.position!.z!
        );
        const value = op.update!.value!;
        if (!volume.update(affectedChunks, position, value, false)) {
          return;
        }
        onUpdate(affectedChunks, { position, value });
        break;
      }
    }
  });

  postMessage({
    config: { size: VolumeSize },
  } satisfies Init);

  for (let z = 0; z < VolumeChunks[2]; z++) {
    for (let y = 0; y < VolumeChunks[1]; y++) {
      for (let x = 0; x < VolumeChunks[0]; x++) {
        updateChunk(vec3.fromValues(x, y, z), true);
      }
    }
  }

  let simulationInterval = setInterval(simulate, simulationRate);
})
.catch((e: Error) => {
  postMessage({
    error: e.message,
  } satisfies Init);
});
