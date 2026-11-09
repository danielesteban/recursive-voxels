import { Schema } from 'mongoose';

Schema.Types.String.checkRequired(v => typeof v === 'string');

export { World, type WorldDocument } from 'models/World';
