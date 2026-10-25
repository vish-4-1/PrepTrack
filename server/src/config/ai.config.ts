import dotenv from 'dotenv';
import path from 'path';

// Ensure environment files are loaded
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface AIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  agentMaxSteps: number;
  requestTimeoutMs: number;
}

export const aiConfig: AIConfig = {
  apiKey:
    process.env.LLM_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.GROK_API_KEY ||
    '',
  model:
    process.env.LLM_MODEL ||
    process.env.GROQ_MODEL ||
    process.env.GROK_MODEL ||
    'llama-3.3-70b-versatile',
  baseUrl:
    process.env.LLM_BASE_URL ||
    process.env.GROQ_API_URL ||
    process.env.GROK_API_URL ||
    'https://api.groq.com/openai/v1/chat/completions',
  temperature: process.env.LLM_TEMPERATURE
    ? parseFloat(process.env.LLM_TEMPERATURE)
    : 0.2,
  maxTokens: process.env.LLM_MAX_TOKENS
    ? parseInt(process.env.LLM_MAX_TOKENS, 10)
    : 4096,
  agentMaxSteps: process.env.AGENT_MAX_STEPS
    ? parseInt(process.env.AGENT_MAX_STEPS, 10)
    : process.env.AGENT_MAX_ITERATIONS
    ? parseInt(process.env.AGENT_MAX_ITERATIONS, 10)
    : 8,
  requestTimeoutMs: 20000,
};
