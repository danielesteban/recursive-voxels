import { deflate, inflate } from 'node:zlib';
import { notFound, tooManyRequests } from '@hapi/boom';
import { type NextFunction, type Request, type Response } from 'express';
import { matchedData, param } from 'express-validator';
import { v4 as uuid } from 'uuid';
import { type WebSocket } from 'ws';
import { Operation, World as WorldMessage } from '@shared/Protocol';
import { BlockType, type Generator, MaxPeers } from '@shared/WorldConstants';
import { GeneratorEscher } from '@shared/WorldGeneration';
import { checkValidationResult } from 'core/ErrorHandler';
import { World as WorldModel } from 'models';

class World {
  private readonly id: string;
  private data: Uint8Array = null!;
  private loading?: Promise<void>;
  private readonly peers: (
    WebSocket
    & {
      id: string;
      isAlive: boolean;
      position: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
    })[] = [];
  private saveTimer?: NodeJS.Timeout;
  private saving?: Promise<void>;
  private size: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  constructor(id: string) {
    this.id = id;
  }

  async addPeer(ws: WebSocket) {
    if (this.loading) {
      await this.loading;
    } else if (!this.data) {
      this.loading = WorldModel
        .findById(this.id)
        .select('data size')
        .lean()
        .then(async (world) => {
          if (!world) {
            throw notFound();
          }
          this.data = await new Promise((resolve, reject) => {
            inflate(Buffer.from(world.data.buffer), (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(new Uint8Array(data));
            });
          });
          this.size = world.size;
          delete this.loading;
        });
      await this.loading;
    }
    const compressedData = await new Promise<Uint8Array>((resolve, reject) => {
      deflate(this.data, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    if (ws.readyState !== ws.OPEN) {
      return;
    }
    const { data, peers, size } = this;
    if (peers.length >= MaxPeers) {
      throw tooManyRequests();
    }
    const peer = ws as unknown as typeof this.peers[0];
    peer.id = uuid();
    peer.isAlive = true;
    peer.position = { x: 0, y: 0, z: 0 };
    peer.direction = { x: 0, y: 0, z: -1 };
    peer.once('close', () => {
      const index = peers.findIndex(({ id }) => (id === peer.id));
      if (index !== -1) {
        peers.splice(index, 1);
      }
      for (const p of peers) {
        p.send(Operation.encode({ peer: { id: peer.id } }).finish());
      }
    });
    peer.on('message', (buffer: Buffer) => {
      if (!(buffer instanceof Buffer)) {
        return;
      }
      try {
        const op = Operation.decode(new Uint8Array(buffer));
        switch (op.type) {
          case 'peer': {
            const { position, direction } = op.peer;
            if (
              !position
              || typeof position.x !== 'number'
              || typeof position.y !== 'number'
              || typeof position.z !== 'number'
              || !direction
              || typeof direction.x !== 'number'
              || typeof direction.y !== 'number'
              || typeof direction.z !== 'number'
            ) {
              throw new Error('Invalid peer update');
            }
            op.peer.id = peer.id;
            peer.position.x = position.x;
            peer.position.y = position.y;
            peer.position.z = position.z;
            peer.direction.x = direction.x;
            peer.direction.y = direction.y;
            peer.direction.z = direction.z;
            buffer = Operation.encode(op).finish() as Buffer;
            break;
          }
          case 'update': {
            const { position, value } = op.update;
            if (
              !position
              || !Number.isInteger(position.x)
              || position.x! < 0
              || position.x! >= size.x
              || !Number.isInteger(position.y)
              || position.y! < 0
              || position.y! >= size.y
              || !Number.isInteger(position.z)
              || position.z! < 0
              || position.z! >= size.z
              || !Number.isInteger(value)
              || value! < 0
              || value! >= 255
            ) {
              throw new Error('Invalid update');
            }
            data[position.z! * size.y * size.x + position.y! * size.x + position.x!] = value!;
            break;
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error(err);
        }
        return;
      }
      for (const p of peers) {
        if (p.id !== peer.id) {
          p.send(buffer);
        }
      }
      this.debounceSave();
    });
    peer.on('pong', () => {
      peer.isAlive = true;
    });
    peer.send(WorldMessage.encode({ data: compressedData, size }).finish());
    for (const p of peers) {
      p.send(Operation.encode({ peer: { id: peer.id, position: peer.position, direction: peer.direction } }).finish());
      peer.send(Operation.encode({ peer: { id: p.id, position: p.position, direction: p.direction } }).finish());
    }
    peers.push(peer);
  }

  getPeersCount() {
    const { peers } = this;
    return peers.length;
  }

  ping() {
    const { peers } = this;
    for (const peer of peers) {
      if (peer.isAlive === false) {
        peer.terminate();
      } else {
        peer.isAlive = false;
        peer.ping(() => {});
      }
    }
    return !!this.loading || !!this.peers.length || !!this.saveTimer || !!this.saving;
  }

  shutdown() {
    const { peers } = this;
    for (const peer of peers) {
      peer.close();
    }
  }

  private async save() {
    const { id, data } = this;
    if (!data) {
      return;
    }
    this.saving = WorldModel
      .updateOne({ _id: id }, {
        $set: {
          data: await new Promise((resolve, reject) => {
            deflate(data, (err, data) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(data);
            });
          }),
        },
      })
      .then(() => {})
      .catch(() => {});
    await this.saving;
  }

  private debounceSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.saving) {
        this.debounceSave();
      } else {
        this.save();
      }
    }, 1000);
  }

  async forceSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      delete this.saveTimer;
      await this.save();
    }
    if (this.saving) {
      await this.saving;
    }
  }
}

const worlds = new Map<string, World>();

const pingInterval = setInterval(() => {
  for (const [id, world] of worlds.entries()) {
    if (!world.ping()) {
      worlds.delete(id);
    }
  }
}, 30000);

export const shutdownWorlds = () => {
  clearInterval(pingInterval);
  for (const world of worlds.values()) {
    world.shutdown();
  }
};

export const saveWorlds = async () => {
  for (const world of worlds.values()) {
    await world.forceSave();
  }
};

const wsToReq = (cb: (req: Request, res: Response, next: NextFunction) => void) => (_ws: WebSocket, req: Request, next: NextFunction) => (
  cb(req, null!, next)
);

export const connect = [
  wsToReq(
    param('id')
      .isMongoId()
  ),
  wsToReq(checkValidationResult),
  async (ws: WebSocket, req: Request, next: NextFunction) => {
    const { id } = matchedData<{ id: string }>(req);
    let world = worlds.get(id);
    if (!world) {
      world = new World(id);
      worlds.set(id, world);
    }
    try {
      await world.addPeer(ws);
    } catch (e) {
      next(e);
    }
  },
];

export const list = (_: Request, res: Response, next: NextFunction) => {
  WorldModel
    .find()
    .select('name private')
    .sort({ createdAt: -1 })
    .lean()
    .then((entries) => {
      res.json(entries.map(({ _id, ...data }) => ({
        ...data,
        id: _id.toHexString(),
        peers: worlds.get(_id.toHexString())?.getPeersCount() || 0,
      })));
    })
    .catch(next);
};

// @dani @hack
// Create test worlds
WorldModel.countDocuments().then(async (count) => {
  if (count > 0) {
    return;
  }

  for (let s = 3; s > 0; s--) {
    const size = { x: 64, y: 64, z: 64 };
    const data = new Uint8Array(size.x * size.y * size.z);
    const generator = (new Function(`return ${GeneratorEscher}`)() as Generator)(BlockType, [size.x, size.y, size.z]);
    for (let i = 0, z = 0; z < size.z; z++) {
      for (let y = 0; y < size.y; y++) {
        for (let x = 0; x < size.x; x++, i++) {
          data[i] = generator(x, y, z);
        }
      }
    }
    await WorldModel.create({
      name: `Multiplayer test server ${s < 10 ? '0' : ''}${s}`,
      data: await new Promise((resolve, reject) => {
        deflate(data, (err, data) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(data);
        });
      }),
      private: false,
      size,
      version: 1,
    });
  }
});
