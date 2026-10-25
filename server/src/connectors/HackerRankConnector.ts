import axios from 'axios';
import { ProfileConnector } from './ProfileConnector';
import { ConnectorResponse, NormalizedCodingStats, PlatformName } from '../types';
import { connectorsConfig, ConnectorError } from '../config/connectors.config';
import { scoringConfig } from '../config/scoring.config';

export class HackerRankConnector extends ProfileConnector<NormalizedCodingStats> {
  readonly platform: PlatformName = 'HACKERRANK';

  validateUrl(url: string): boolean {
    if (!url) return false;
    const clean = this.sanitizeUrl(url);
    return connectorsConfig.hackerrank.urlPattern.test(clean);
  }

  extractUsername(url: string): string | null {
    if (!this.validateUrl(url)) return null;
    const clean = this.sanitizeUrl(url);
    const parts = clean.split('hackerrank.com/profile/');
    if (parts.length < 2) return null;
    return parts[1].split('/')[0];
  }

  async fetchProfile(profileUrl: string): Promise<ConnectorResponse<NormalizedCodingStats>> {
    const username = this.extractUsername(profileUrl);
    if (!username) {
      throw new ConnectorError('Invalid HackerRank URL format', this.platform, 400);
    }

    const config = connectorsConfig.hackerrank;
    const dist = scoringConfig.platformDistributions.hackerrank;

    try {
      const [profileRes, badgesRes] = await Promise.allSettled([
        axios.get(`${config.baseUrl}/${username}/profile`, {
          timeout: config.timeoutMs,
          headers: config.headers,
        }),
        axios.get(`${config.baseUrl}/${username}/badges`, {
          timeout: config.timeoutMs,
          headers: config.headers,
        }),
      ]);

      if (badgesRes.status === 'rejected' && profileRes.status === 'rejected') {
        throw new ConnectorError(`HackerRank user "${username}" profile not reachable`, this.platform, 404);
      }

      let totalSolved = 0;
      let contestRating = 0;
      let globalRank = 0;

      if (badgesRes.status === 'fulfilled' && badgesRes.value.data?.models) {
        const badges = badgesRes.value.data.models;
        badges.forEach((b: any) => {
          totalSolved += (b.solved || 0) + (b.stars || dist.defaultStars) * dist.starWeight;
        });
      }

      if (profileRes.status === 'fulfilled' && profileRes.value.data?.model) {
        const model = profileRes.value.data.model;
        if (model.country_rank) globalRank = model.country_rank;
        if (model.hacker_rank) globalRank = model.hacker_rank;
      }

      if (totalSolved > 0) {
        const easySolved = Math.round(totalSolved * dist.easyRatio);
        const mediumSolved = Math.round(totalSolved * dist.mediumRatio);
        const hardSolved = Math.max(0, totalSolved - easySolved - mediumSolved);

        return {
          success: true,
          platform: this.platform,
          rawProfileUrl: profileUrl,
          data: {
            totalSolved,
            easySolved,
            mediumSolved,
            hardSolved,
            contestRating,
            globalRank,
            contestsParticipated: 0,
          },
          isPublicDataOnly: true,
        };
      }

      throw new ConnectorError(`HackerRank profile for "${username}" returned zero solved statistics`, this.platform, 404);
    } catch (err: any) {
      if (err instanceof ConnectorError) throw err;
      const statusCode = err.response?.status;
      const isRateLimit = statusCode === 429;
      throw new ConnectorError(
        isRateLimit ? 'HackerRank API rate limit exceeded' : (err.message || 'Failed to fetch HackerRank profile telemetry'),
        this.platform,
        statusCode,
        isRateLimit
      );
    }
  }
}
