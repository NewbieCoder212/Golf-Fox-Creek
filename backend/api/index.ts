import { handle } from '@hono/node-server/vercel';

import '../src/env';
import { app } from '../src/app';

export default handle(app);
