import axios from 'axios';
import { ProfileConnector } from './ProfileConnector';
import { ConnectorResponse, NormalizedCodingStats, PlatformName } from '../types';
import { connectorsConfig, ConnectorError } from '../config/connectors.config';
import { scoringConfig } from '../config/scoring.config';

export class CodeChefConnector extends ProfileConnector<NormalizedCodingStats> {
  readonly platform: PlatformName = 'CODECHEF';

  validateUrl(url: string): boolean {
    if (!url) return false;
    const clean = this.sanitizeUrl(url);
    return connectorsConfig.codechef.urlPattern.test(clean);
  }

  extractUsername(url: string): string | null {
    if (!this.validateUrl(url)) return null;
    const clean = this.sanitizeUrl(url);
    const parts = clean.split('codechef.com/users/');
    if (parts.length < 2) return null;
    return parts[1].split('/')[0];
  }

  async fetchProfile(profileUrl: string): Promise<ConnectorResponse<NormalizedCodingStats>> {
    const username = this.extractUsername(profileUrl);
    if (!username) {
      throw new ConnectorError('Invalid CodeChef URL format', this.platform, 400);
    }

    const config = connectorsConfig.codechef;
    const dist = scoringConfig.platformDistributions.codechef;

    try {
      const res = await axios.get(`${config.baseUrl}/handle/${username}`, {
        timeout: config.timeoutMs,
        headers: config.headers,
      });

      const data = res.data;
      if (data && data.success !== false && (data.currentRating || data.stars || data.totalProblemsSolved !== undefined)) {
        const totalSolved = Number(data.totalProblemsSolved) || 0;
        const currentRating = Number(data.currentRating) || 0;
        const globalRank = Number(data.globalRank) || 0;

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
            contestRating: currentRating,
            globalRank,
            contestsParticipated: Number(data.ratingData?.length) || 0,
          },
          isPublicDataOnly: true,
        };
      }

      throw new ConnectorError(`CodeChef user "${username}" returned invalid data`, this.platform, 404);
    } catch (err: any) {
      if (err instanceof ConnectorError) throw err;
      const statusCode = err.response?.status;
      const isRateLimit = statusCode === 429;
      throw new ConnectorError(
        isRateLimit ? 'CodeChef API rate limit exceeded' : (err.message || 'Failed to fetch CodeChef profile telemetry'),
        this.platform,
        statusCode,
        isRateLimit
      );
    }
  }
}
