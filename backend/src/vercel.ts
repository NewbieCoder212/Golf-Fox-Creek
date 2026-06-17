import { handle } from '@hono/node-server/vercel';

import './env';
import { app } from './app';

export default handle(app);
