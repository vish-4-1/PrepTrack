import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables across possible project roots
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:5173')
    .transform((val) => val.split(',').map((s) => s.trim()).filter(Boolean)),
  LLM_API_KEY: z.string().default(''),
  LLM_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1/chat/completions'),
  LLM_MODEL: z.string().default('llama-3.3-70b-versatile'),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  LLM_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  AGENT_MAX_ITERATIONS: z.coerce.number().int().positive().default(8),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),
  GITHUB_API_URL: z.string().url().default('https://api.github.com'),
  GITHUB_TOKEN: z.string().optional().default(''),
  LEETCODE_GRAPHQL_URL: z.string().url().default('https://leetcode.com/graphql'),
  CODECHEF_BASE_URL: z.string().url().default('https://codechef-api.vercel.app'),
  HACKERRANK_API_URL: z.string().url().default('https://www.hackerrank.com/rest/hackers'),
  CONNECTOR_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

const rawEnv = {
  ...process.env,
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.GROQ_API_KEY || process.env.GROK_API_KEY || '',
  LLM_BASE_URL: process.env.LLM_BASE_URL || process.env.GROQ_API_URL || process.env.GROK_API_URL || 'https://api.groq.com/openai/v1/chat/completions',
  LLM_MODEL: process.env.LLM_MODEL || process.env.GROQ_MODEL || process.env.GROK_MODEL || 'llama-3.3-70b-versatile',
  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.FRONTEND_URL
      ? `${process.env.CORS_ORIGINS},${process.env.FRONTEND_URL}`
      : process.env.CORS_ORIGINS
    : process.env.FRONTEND_URL
    ? `http://localhost:3000,http://localhost:5173,${process.env.FRONTEND_URL}`
    : 'http://localhost:3000,http://localhost:5173',
};

const parsedEnv = envSchema.safeParse(rawEnv);

if (!parsedEnv.success) {
  console.error('❌ FATAL: Invalid environment variable configuration:', parsedEnv.error.format());
  throw new Error(`Environment validation failed: ${JSON.stringify(parsedEnv.error.flatten().fieldErrors)}`);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof envSchema>;
