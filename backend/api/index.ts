import { handle } from 'hono/vercel';

import '../src/env';
import { app } from '../src/app';

export default handle(app);
