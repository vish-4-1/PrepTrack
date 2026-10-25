import { env } from './env';

export class ConnectorError extends Error {
  readonly platform: string;
  readonly statusCode?: number;
  readonly isRateLimit: boolean;

  constructor(message: string, platform: string, statusCode?: number, isRateLimit = false) {
    super(`[${platform}] ${message}`);
    this.name = 'ConnectorError';
    this.platform = platform;
    this.statusCode = statusCode;
    this.isRateLimit = isRateLimit;
    Object.setPrototypeOf(this, ConnectorError.prototype);
  }
}

const baseTimeout = env.CONNECTOR_TIMEOUT_MS || 10000;

export const connectorsConfig = {
  github: {
    baseUrl: env.GITHUB_API_URL,
    timeoutMs: baseTimeout,
    searchTimeoutMs: Math.round(baseTimeout * 0.5),
    headers: {
      'User-Agent': 'PrepTrack-Placement-Platform',
      Accept: 'application/vnd.github.v3+json',
    },
    searchCommitsAccept: 'application/vnd.github.cloak-preview+json',
    token: env.GITHUB_TOKEN,
    urlPattern: /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/,
    perPage: 100,
  },
  leetcode: {
    baseUrl: 'https://leetcode.com',
    graphqlUrl: env.LEETCODE_GRAPHQL_URL,
    timeoutMs: baseTimeout,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'PrepTrack-App',
    },
    urlPattern: /^https?:\/\/(www\.)?leetcode\.com\/(u\/)?[a-zA-Z0-9_-]+\/?$/,
    graphqlQuery: `
      query getUserProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
          profile {
            ranking
          }
        }
        userContestRanking(username: $username) {
          rating
          attendedContestsCount
          globalRanking
        }
      }
    `,
  },
  codechef: {
    baseUrl: env.CODECHEF_BASE_URL,
    timeoutMs: baseTimeout,
    headers: {
      'User-Agent': 'PrepTrack-App',
    },
    urlPattern: /^https?:\/\/(www\.)?codechef\.com\/users\/[a-zA-Z0-9_-]+\/?$/,
  },
  hackerrank: {
    baseUrl: env.HACKERRANK_API_URL,
    timeoutMs: baseTimeout,
    headers: {
      'User-Agent': 'PrepTrack-Placement-App',
    },
    urlPattern: /^https?:\/\/(www\.)?hackerrank\.com\/profile\/[a-zA-Z0-9_-]+\/?$/,
  },
  linkedin: {
    baseUrl: 'https://www.linkedin.com',
    timeoutMs: baseTimeout,
    headers: {
      'User-Agent': 'PrepTrack-Placement-App',
    },
    urlPattern: /^https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?$/,
  },
} as const;

export type ConnectorsConfig = typeof connectorsConfig;
