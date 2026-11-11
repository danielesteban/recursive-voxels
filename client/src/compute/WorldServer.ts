import { Operation, World } from '@shared/Protocol';

export class Server {
  private _onDisconnect?: () => void;
  private _onOperation?: (op: Operation) => void;
  private operationQueue: Operation[] = [];
  private socket?: WebSocket;

  constructor() {
    this.onDisconnect = this.onDisconnect.bind(this);
    this.onOperation = this.onOperation.bind(this);
  }

  private onDisconnect() {
    const { _onDisconnect, operationQueue } = this;
    operationQueue.length = 0;
    delete this.socket;
    _onDisconnect?.();
  }

  private onOperation({ data: buffer }: { data: ArrayBuffer }) {
    const { _onOperation, operationQueue } = this;
    const op = Operation.decode(new Uint8Array(buffer));
    if (!_onOperation) {
      operationQueue.push(op);
      return;
    }
    _onOperation(op);
  }

  connect(endpoint: string, session?: string) {
    const url = new URL(`${__SERVER__}${endpoint}${session ? `?auth=${session}` : ''}`);
    const socket = new WebSocket(`ws${url.protocol === 'https:' ? 's' : ''}://${url.host}${url.pathname}${url.search}`);
    socket.binaryType = 'arraybuffer';
    return new Promise<World>((resolve, reject) => {
      const onDisconnect = () => {
        socket.removeEventListener('close', onDisconnect);
        socket.removeEventListener('message', onConnect);
        reject(new Error("Couldn't connect to server"));
      };
      const onConnect = ({ data: buffer }: { data: ArrayBuffer }) => {
        socket.removeEventListener('close', onDisconnect);
        socket.removeEventListener('message', onConnect);
        socket.addEventListener('close', this.onDisconnect);
        socket.addEventListener('message', this.onOperation);
        this.socket = socket;
        const world = World.decode(new Uint8Array(buffer));
        resolve(world);
      };
      socket.addEventListener('close', onDisconnect);
      socket.addEventListener('message', onConnect);
    });
  }

  setOnDisconnect(cb: Server['_onDisconnect']) {
    this._onDisconnect = cb;
  }

  setOnOperation(cb: Server['_onOperation']) {
    const { operationQueue } = this;
    this._onOperation = cb;
    if (cb) {
      for (const op of operationQueue) {
        cb(op);
      }
      operationQueue.length = 0;
    }
  }

  send(op: Operation.$Properties) {
    const { socket } = this;
    if (!socket) {
      throw new Error('Not connected');
    }
    socket.send(Operation.encode(op).finish() as Uint8Array<ArrayBuffer>);
  }
}
