import { z } from 'zod';

function resolveBackendUrl(): string {
  const fromEnv = process.env.BACKEND_URL?.trim();
  if (fromEnv) return fromEnv;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return 'http://localhost:3000';
}

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  PORT: z.string().optional().default('3000'),
  NODE_ENV: z.string().optional(),
  BACKEND_URL: z
    .preprocess(
      (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
      z.string().url().optional()
    )
    .optional(),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    const env = {
      ...parsed,
      BACKEND_URL: parsed.BACKEND_URL ?? resolveBackendUrl(),
    };
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment variable validation failed:');
      error.issues.forEach((err: z.ZodIssue) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      if (process.env.VERCEL) {
        console.warn('Using safe defaults on Vercel');
        return {
          PORT: process.env.PORT ?? '3000',
          NODE_ENV: process.env.NODE_ENV,
          BACKEND_URL: resolveBackendUrl(),
        };
      }
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = typeof env;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
