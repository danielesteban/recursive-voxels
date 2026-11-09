import { badRequest, notFound } from '@hapi/boom';
import { type NextFunction, type Request } from 'express';
import { matchedData } from 'express-validator';
import { v4 as uuid } from 'uuid';
import validator from 'validator';
import { type WebSocket } from 'ws';
import { Operation, World as WorldMessage } from '@shared/Protocol';
import { World as WorldModel } from 'models';

class World {
  private readonly id: string;
  private data: Uint8Array = null!;
  private loading?: Promise<void>;
  private readonly peers: (WebSocket & { id: string; isAlive: boolean; })[] = [];
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
        .then((world) => {
          if (!world) {
            throw notFound();
          }
          this.data = world.data;
          this.size = world.size;
          delete this.loading;
        });
      await this.loading;
    }
    if (ws.readyState !== ws.OPEN) {
      return;
    }
    const { data, peers, size } = this;
    const peer = ws as unknown as typeof this.peers[0];
    peer.id = uuid();
    peer.isAlive = true;
    peer.once('close', () => {
      const index = peers.findIndex(({ id }) => (id === peer.id));
      if (index !== -1) {
        peers.splice(index, 1);
      }
    });
    peer.on('message', (buffer) => {
      if (!(buffer instanceof Buffer)) {
        return;
      }
      try {
        const op = Operation.decode(new Uint8Array(buffer));
        switch (op.type) {
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
    // @dani @incomplete
    // Compress the data before sending it to the client
    peer.send(WorldMessage.encode({ data, size }).finish());
    peers.push(peer);
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
          // @dani @incomplete
          // Compress the data before saving it to the db
          data: Buffer.from(data),
        },
      })
      .then(() => {});
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

export const connect = [
  async (ws: WebSocket, req: Request, next: NextFunction) => {
    const { id } = matchedData<{ id: string }>(req);
    if (!validator.isMongoId(id)) {
      next(badRequest());
      return;
    }
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

// @dani @hack
// Create default world
WorldModel.countDocuments().then((count) => {
  if (count > 0) {
    return;
  }

  const size = { x: 64, y: 64, z: 64 };
  const data = new Uint8Array(size.x * size.y * size.z);

  // @dani @hack
  const origin = { x: size.x * 0.5, y: size.y * 0.5, z: size.z * 0.5 };
  data[origin.z * size.y * size.x + origin.y * size.x + origin.x] = 128;

  WorldModel.create({
    _id: '6af11800c420506757d047dd',
    name: 'Default World',
    data: Buffer.from(data),
    size,
    version: 1,
  });
});
