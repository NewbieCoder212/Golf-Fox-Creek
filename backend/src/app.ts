import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import { sampleRouter } from './routes/sample';
import { devAuthRouter } from './routes/dev-auth';
import { membersRouter } from './routes/members';
import { displayRouter } from './routes/display';
import { tournamentTeamsRouter } from './routes/tournament-teams';
import { tournamentScoresRouter } from './routes/tournament-scores';

const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
  /^https:\/\/(www\.)?foxcreek\.golf$/,
  /^https:\/\/[a-z0-9-]+\.foxcreek\.golf$/,
  /^https:\/\/[a-z0-9-]+\.vercel\.app$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
];

export function createApp() {
  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: (origin) => (origin && allowed.some((re) => re.test(origin)) ? origin : null),
      credentials: true,
    })
  );

  app.use('*', logger());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/sample', sampleRouter);
  app.route('/api/dev', devAuthRouter);
  app.route('/api/members', membersRouter);
  app.route('/api/display', displayRouter);
  app.route('/api/tournaments', tournamentTeamsRouter);
  app.route('/api/tournaments', tournamentScoresRouter);

  return app;
}

export const app = createApp();
