import { GitHubConnector } from '../connectors/GitHubConnector';
import { LeetCodeConnector } from '../connectors/LeetCodeConnector';
import { CodeChefConnector } from '../connectors/CodeChefConnector';
import { HackerRankConnector } from '../connectors/HackerRankConnector';
import { LinkedInConnector } from '../connectors/LinkedInConnector';
import { NormalizedCodingStats, PlatformName, ConnectorResponse } from '../types';

export class NormalizerService {
  private githubConnector = new GitHubConnector();
  private leetcodeConnector = new LeetCodeConnector();
  private codechefConnector = new CodeChefConnector();
  private hackerrankConnector = new HackerRankConnector();
  private linkedinConnector = new LinkedInConnector();

  validatePlatformUrl(platform: PlatformName, url: string): boolean {
    switch (platform) {
      case 'GITHUB':
        return this.githubConnector.validateUrl(url);
      case 'LEETCODE':
        return this.leetcodeConnector.validateUrl(url);
      case 'CODECHEF':
        return this.codechefConnector.validateUrl(url);
      case 'HACKERRANK':
        return this.hackerrankConnector.validateUrl(url);
      case 'LINKEDIN':
        return this.linkedinConnector.validateUrl(url);
      default:
        return false;
    }
  }

  async syncPlatform(platform: PlatformName, url: string): Promise<ConnectorResponse> {
    try {
      switch (platform) {
        case 'GITHUB':
          return await this.githubConnector.fetchProfile(url);
        case 'LEETCODE':
          return await this.leetcodeConnector.fetchProfile(url);
        case 'CODECHEF':
          return await this.codechefConnector.fetchProfile(url);
        case 'HACKERRANK':
          return await this.hackerrankConnector.fetchProfile(url);
        case 'LINKEDIN':
          return await this.linkedinConnector.fetchProfile(url);
        default:
          return {
            success: false,
            platform,
            rawProfileUrl: url,
            error: `Unsupported platform ${platform}`,
            isPublicDataOnly: true,
          };
      }
    } catch (err: any) {
      return {
        success: false,
        platform,
        rawProfileUrl: url,
        error: err.message || 'Platform synchronization failed',
        isPublicDataOnly: true,
      };
    }
  }

  aggregateCodingStats(codingProfiles: Array<{ platform: string; data: NormalizedCodingStats }>) {
    let combinedTotalSolved = 0;
    let combinedContestRatingMax = 0;

    codingProfiles.forEach((cp) => {
      combinedTotalSolved += cp.data.totalSolved || 0;
      if (cp.data.contestRating > combinedContestRatingMax) {
        combinedContestRatingMax = cp.data.contestRating;
      }
    });

    return {
      combinedTotalSolved,
      combinedContestRatingMax,
    };
  }
}

export const normalizerService = new NormalizerService();
