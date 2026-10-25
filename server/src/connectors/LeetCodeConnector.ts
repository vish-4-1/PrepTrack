import axios from 'axios';
import { ProfileConnector } from './ProfileConnector';
import { ConnectorResponse, NormalizedCodingStats, PlatformName } from '../types';
import { connectorsConfig, ConnectorError } from '../config/connectors.config';

export class LeetCodeConnector extends ProfileConnector<NormalizedCodingStats> {
  readonly platform: PlatformName = 'LEETCODE';

  validateUrl(url: string): boolean {
    if (!url) return false;
    const clean = this.sanitizeUrl(url);
    return connectorsConfig.leetcode.urlPattern.test(clean);
  }

  extractUsername(url: string): string | null {
    if (!this.validateUrl(url)) return null;
    const clean = this.sanitizeUrl(url);
    const parts = clean.split('leetcode.com/');
    if (parts.length < 2) return null;
    let path = parts[1];
    if (path.startsWith('u/')) path = path.replace('u/', '');
    return path.split('/')[0];
  }

  async fetchProfile(profileUrl: string): Promise<ConnectorResponse<NormalizedCodingStats>> {
    const username = this.extractUsername(profileUrl);
    if (!username) {
      throw new ConnectorError('Invalid LeetCode URL format', this.platform, 400);
    }

    const config = connectorsConfig.leetcode;

    try {
      const graphqlQuery = {
        query: config.graphqlQuery,
        variables: { username },
      };

      const res = await axios.post(config.graphqlUrl, graphqlQuery, {
        timeout: config.timeoutMs,
        headers: config.headers,
      });

      const matchedUser = res.data?.data?.matchedUser;
      const contestData = res.data?.data?.userContestRanking;

      if (!matchedUser) {
        throw new ConnectorError(`User "${username}" not found on LeetCode API`, this.platform, 404);
      }

      const stats = matchedUser.submitStats?.acSubmissionNum || [];
      let easy = 0;
      let medium = 0;
      let hard = 0;

      stats.forEach((item: any) => {
        if (item.difficulty === 'Easy') easy = Number(item.count) || 0;
        if (item.difficulty === 'Medium') medium = Number(item.count) || 0;
        if (item.difficulty === 'Hard') hard = Number(item.count) || 0;
      });

      const normalized: NormalizedCodingStats = {
        totalSolved: easy + medium + hard,
        easySolved: easy,
        mediumSolved: medium,
        hardSolved: hard,
        contestRating: contestData?.rating ? Math.round(contestData.rating) : 0,
        globalRank: contestData?.globalRanking || matchedUser.profile?.ranking || 0,
        contestsParticipated: contestData?.attendedContestsCount || 0,
      };

      return {
        success: true,
        platform: this.platform,
        rawProfileUrl: profileUrl,
        data: normalized,
        isPublicDataOnly: true,
      };
    } catch (err: any) {
      if (err instanceof ConnectorError) throw err;
      const statusCode = err.response?.status;
      const isRateLimit = statusCode === 429;
      throw new ConnectorError(
        isRateLimit ? 'LeetCode API rate limit exceeded' : (err.message || 'Failed to fetch LeetCode profile telemetry'),
        this.platform,
        statusCode,
        isRateLimit
      );
    }
  }
}
