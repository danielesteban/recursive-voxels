import { type Application } from 'express-ws';
import nocache from 'nocache';
import * as World from 'services/World';

const preventCache = nocache();

export default (app: Application) => {
  app.get(
    '/worlds',
    preventCache,
    World.list
  );

  app.ws(
    '/world/:id',
    ...World.connect,
  );
};
