import { describe, it, expect } from 'vitest';
import { GitHubConnector } from '../connectors/GitHubConnector';
import { LeetCodeConnector } from '../connectors/LeetCodeConnector';
import { CodeChefConnector } from '../connectors/CodeChefConnector';
import { HackerRankConnector } from '../connectors/HackerRankConnector';
import { LinkedInConnector } from '../connectors/LinkedInConnector';
import { ConnectorError } from '../config/connectors.config';

describe('ProfileConnectors URL Validation & Parsing', () => {
  it('validates and extracts GitHub profile URLs correctly', () => {
    const gh = new GitHubConnector();
    expect(gh.validateUrl('https://github.com/developer-user')).toBe(true);
    expect(gh.extractUsername('https://github.com/developer-user')).toBe('developer-user');
    expect(gh.validateUrl('https://invalid-domain.com/user')).toBe(false);
  });

  it('validates and extracts LeetCode profile URLs correctly', () => {
    const lc = new LeetCodeConnector();
    expect(lc.validateUrl('https://leetcode.com/test_coder')).toBe(true);
    expect(lc.extractUsername('https://leetcode.com/test_coder')).toBe('test_coder');
    expect(lc.validateUrl('https://leetcode.com/u/test_coder')).toBe(true);
  });

  it('validates CodeChef profile URLs correctly', () => {
    const cc = new CodeChefConnector();
    expect(cc.validateUrl('https://codechef.com/users/test_cc')).toBe(true);
    expect(cc.extractUsername('https://codechef.com/users/test_cc')).toBe('test_cc');
  });

  it('validates HackerRank profile URLs correctly', () => {
    const hr = new HackerRankConnector();
    expect(hr.validateUrl('https://hackerrank.com/profile/test_hr')).toBe(true);
    expect(hr.extractUsername('https://hackerrank.com/profile/test_hr')).toBe('test_hr');
  });

  it('validates LinkedIn profile URLs correctly', () => {
    const li = new LinkedInConnector();
    expect(li.validateUrl('https://linkedin.com/in/developer-profile')).toBe(true);
    expect(li.extractUsername('https://linkedin.com/in/developer-profile')).toBe('developer-profile');
  });

  it('throws typed ConnectorError on invalid profile format or network failure', async () => {
    const gh = new GitHubConnector();
    await expect(gh.fetchProfile('https://invalid-url.com/')).rejects.toThrow(ConnectorError);

    const lc = new LeetCodeConnector();
    await expect(lc.fetchProfile('https://invalid-url.com/')).rejects.toThrow(ConnectorError);

    const hr = new HackerRankConnector();
    await expect(hr.fetchProfile('https://invalid-url.com/')).rejects.toThrow(ConnectorError);
  });
});
