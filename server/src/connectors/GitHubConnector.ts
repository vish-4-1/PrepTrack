import axios from 'axios';
import { ProfileConnector } from './ProfileConnector';
import { ConnectorResponse, NormalizedDevStats, PlatformName, AnalyzedRepo } from '../types';
import { connectorsConfig, ConnectorError } from '../config/connectors.config';
import { scoringConfig } from '../config/scoring.config';

export class GitHubConnector extends ProfileConnector<NormalizedDevStats> {
  readonly platform: PlatformName = 'GITHUB';

  validateUrl(url: string): boolean {
    if (!url) return false;
    const clean = this.sanitizeUrl(url);
    return connectorsConfig.github.urlPattern.test(clean);
  }

  extractUsername(url: string): string | null {
    if (!this.validateUrl(url)) return null;
    const clean = this.sanitizeUrl(url);
    const parts = clean.split('github.com/');
    if (parts.length < 2) return null;
    return parts[1].split('/')[0];
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...connectorsConfig.github.headers };
    if (connectorsConfig.github.token) {
      headers['Authorization'] = `token ${connectorsConfig.github.token}`;
    }
    return headers;
  }

  async fetchProfile(profileUrl: string): Promise<ConnectorResponse<NormalizedDevStats>> {
    const username = this.extractUsername(profileUrl);
    if (!username) {
      throw new ConnectorError('Invalid GitHub profile URL format', this.platform, 400);
    }

    const headers = this.getAuthHeaders();
    const config = connectorsConfig.github;
    const commitEstimates = scoringConfig.development.commitEstimation;

    try {
      const [userRes, reposRes] = await Promise.all([
        axios.get(`${config.baseUrl}/users/${username}`, {
          timeout: config.timeoutMs,
          headers,
        }),
        axios.get(`${config.baseUrl}/users/${username}/repos?per_page=${config.perPage}&sort=updated`, {
          timeout: config.timeoutMs,
          headers,
        }),
      ]);

      const user = userRes.data;
      const repos = Array.isArray(reposRes.data) ? reposRes.data : [];

      let totalStars = 0;
      let totalForks = 0;
      const languages: Record<string, number> = {};

      repos.forEach((repo: any) => {
        totalStars += repo.stargazers_count || 0;
        totalForks += repo.forks_count || 0;
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
      });

      let totalCommits = 0;
      let prCount = 0;
      let issueCount = 0;

      try {
        const [commitsRes, prsRes, issuesRes] = await Promise.allSettled([
          axios.get(`${config.baseUrl}/search/commits?q=author:${username}`, {
            timeout: config.searchTimeoutMs,
            headers: { ...headers, Accept: config.searchCommitsAccept },
          }),
          axios.get(`${config.baseUrl}/search/issues?q=author:${username}+type:pr`, {
            timeout: config.searchTimeoutMs,
            headers,
          }),
          axios.get(`${config.baseUrl}/search/issues?q=author:${username}+type:issue`, {
            timeout: config.searchTimeoutMs,
            headers,
          }),
        ]);

        if (commitsRes.status === 'fulfilled' && commitsRes.value.data?.total_count !== undefined) {
          totalCommits = commitsRes.value.data.total_count;
        }
        if (prsRes.status === 'fulfilled' && prsRes.value.data?.total_count !== undefined) {
          prCount = prsRes.value.data.total_count;
        }
        if (issuesRes.status === 'fulfilled' && issuesRes.value.data?.total_count !== undefined) {
          issueCount = issuesRes.value.data.total_count;
        }
      } catch {
        // Search API rate limited, continue
      }

      // Analyze top repositories for complexity, tests, CI/CD, and architecture tiers
      const topReposToAnalyze = repos.slice(0, 6);
      const topRepos: AnalyzedRepo[] = await Promise.all(
        topReposToAnalyze.map(async (repo: any) => {
          const defaultBranch = repo.default_branch || 'main';
          let hasTests = false;
          let hasCiCd = false;
          let hasDocker = false;
          let hasBackendDepth = false;
          const signals: string[] = [];

          const repoDesc = (repo.description || '').toLowerCase();
          const repoTopics = Array.isArray(repo.topics) ? repo.topics.join(' ').toLowerCase() : '';
          const metaText = `${repo.name} ${repoDesc} ${repoTopics}`.toLowerCase();

          // Try inspecting repository root tree contents
          try {
            const treeRes = await axios.get(
              `${config.baseUrl}/repos/${username}/${repo.name}/git/trees/${defaultBranch}?recursive=1`,
              {
                headers,
                timeout: Math.round(config.searchTimeoutMs * 0.8),
              }
            );

            const treePaths: string[] = Array.isArray(treeRes.data?.tree)
              ? treeRes.data.tree.map((t: any) => (t.path || '').toLowerCase())
              : [];

            hasTests = treePaths.some(
              (p) =>
                p.includes('__tests__') ||
                p.includes('/test/') ||
                p.startsWith('test/') ||
                p.includes('.spec.') ||
                p.includes('.test.') ||
                p.includes('pytest')
            );

            hasCiCd = treePaths.some(
              (p) =>
                p.includes('.github/workflows') ||
                p.includes('render.yaml') ||
                p.includes('vercel.json') ||
                p.includes('fly.toml') ||
                p.includes('jenkins')
            );

            hasDocker = treePaths.some(
              (p) => p.includes('dockerfile') || p.includes('docker-compose') || p.includes('.dockerignore')
            );

            hasBackendDepth = treePaths.some(
              (p) =>
                p.includes('prisma') ||
                p.includes('migration') ||
                p.includes('graphql') ||
                p.includes('redis') ||
                p.includes('socket.io') ||
                p.includes('alembic') ||
                p.includes('onnx') ||
                p.includes('model.pt')
            );
          } catch {
            // Fallback to repository topics and metadata signals
            hasTests = metaText.includes('test') || metaText.includes('jest') || metaText.includes('pytest');
            hasCiCd = metaText.includes('ci/cd') || metaText.includes('pipeline') || metaText.includes('workflow');
            hasDocker = metaText.includes('docker') || metaText.includes('kubernetes') || metaText.includes('container');
            hasBackendDepth =
              metaText.includes('api') ||
              metaText.includes('backend') ||
              metaText.includes('postgres') ||
              metaText.includes('redis') ||
              metaText.includes('graphql') ||
              metaText.includes('microservice');
          }

          if (hasTests) signals.push('Automated Tests');
          if (hasCiCd) signals.push('CI/CD Pipeline');
          if (hasDocker) signals.push('Docker / Containerized');
          if (hasBackendDepth) signals.push('Database / Distributed Architecture');

          const commitCount = repo.open_issues_count
            ? repo.open_issues_count * commitEstimates.openIssueMultiplier + commitEstimates.openIssueBase
            : commitEstimates.defaultFallback;

          // Compute difficulty score (1.0 - 10.0)
          let difficultyScore = 3.0; // Base score
          if (hasTests) difficultyScore += 1.8;
          if (hasCiCd) difficultyScore += 1.5;
          if (hasDocker) difficultyScore += 1.4;
          if (hasBackendDepth) difficultyScore += 1.5;
          if (commitCount > 50) difficultyScore += 0.8;
          if (repo.stargazers_count > 5) difficultyScore += 0.6;
          if (repo.forks_count > 2) difficultyScore += 0.4;
          difficultyScore = Math.min(10.0, Math.round(difficultyScore * 10) / 10);

          // Categorize Architecture Tier
          let architectureTier: 'Basic CRUD' | 'Full-Stack Production' | 'Advanced System' = 'Basic CRUD';
          if (difficultyScore >= 7.5 || (hasCiCd && hasTests && hasBackendDepth)) {
            architectureTier = 'Advanced System';
          } else if (difficultyScore >= 5.0 || hasBackendDepth || hasTests || hasDocker) {
            architectureTier = 'Full-Stack Production';
          }

          return {
            name: repo.name,
            description: repo.description || 'Public GitHub Repository',
            repoUrl: repo.html_url,
            stars: repo.stargazers_count || 0,
            forks: repo.forks_count || 0,
            language: repo.language || 'Unknown',
            commitCount,
            sizeKb: repo.size || 0,
            hasTests,
            hasCiCd,
            hasDocker,
            architectureTier,
            difficultyScore,
            signals,
          };
        })
      );

      const normalizedData: NormalizedDevStats = {
        totalRepos: user.public_repos !== undefined ? user.public_repos : repos.length,
        publicRepos: user.public_repos !== undefined ? user.public_repos : repos.length,
        totalStars,
        totalForks,
        totalCommits,
        prCount,
        issueCount,
        languages,
        topRepos,
      };

      return {
        success: true,
        platform: this.platform,
        rawProfileUrl: profileUrl,
        data: normalizedData,
        isPublicDataOnly: true,
      };
    } catch (err: any) {
      if (err instanceof ConnectorError) throw err;
      const statusCode = err.response?.status;
      const isRateLimit = statusCode === 403 || statusCode === 429;
      throw new ConnectorError(
        isRateLimit ? 'GitHub API rate limit exceeded' : (err.message || 'Failed to fetch GitHub profile telemetry'),
        this.platform,
        statusCode,
        isRateLimit
      );
    }
  }
}
