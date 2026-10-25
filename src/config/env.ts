import { z } from 'zod';

const frontendEnvSchema = z.object({
  VITE_API_URL: z.string().default(''),
  VITE_APP_NAME: z.string().default('PrepTrack'),
});

export const env = frontendEnvSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL || '',
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME || 'PrepTrack',
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;
