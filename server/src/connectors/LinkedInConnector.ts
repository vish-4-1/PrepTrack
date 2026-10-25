import { ProfileConnector } from './ProfileConnector';
import { ConnectorResponse, PlatformName } from '../types';
import { connectorsConfig, ConnectorError } from '../config/connectors.config';

export interface LinkedInPublicData {
  profileUrl: string;
  username: string;
  verifiedStatus: string;
  skillsExtracted: string[];
  certifications: string[];
}

export class LinkedInConnector extends ProfileConnector<LinkedInPublicData> {
  readonly platform: PlatformName = 'LINKEDIN';

  validateUrl(url: string): boolean {
    if (!url) return false;
    const clean = this.sanitizeUrl(url);
    return connectorsConfig.linkedin.urlPattern.test(clean);
  }

  extractUsername(url: string): string | null {
    if (!this.validateUrl(url)) return null;
    const clean = this.sanitizeUrl(url);
    const parts = clean.split('linkedin.com/in/');
    if (parts.length < 2) return null;
    return parts[1].split('/')[0];
  }

  async fetchProfile(profileUrl: string): Promise<ConnectorResponse<LinkedInPublicData>> {
    const username = this.extractUsername(profileUrl);
    if (!username) {
      throw new ConnectorError('Invalid LinkedIn URL format', this.platform, 400);
    }

    return {
      success: true,
      platform: this.platform,
      rawProfileUrl: profileUrl,
      data: {
        profileUrl,
        username,
        verifiedStatus: 'Verified LinkedIn Profile Link',
        skillsExtracted: [],
        certifications: [],
      },
      isPublicDataOnly: true,
    };
  }
}
