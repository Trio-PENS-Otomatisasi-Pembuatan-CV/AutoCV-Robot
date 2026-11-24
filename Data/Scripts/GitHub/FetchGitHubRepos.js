/**
 * FetchGitHubRepos.js
 * AutoCV GitHub Repository & Profile Ingestion Module
 * Fetches user profile, starred metrics, language breakdowns, and public repositories with graceful mock fallback.
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_REPOS = parseInt(process.env.GITHUB_MAX_REPOS || '30', 10);
const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Extracts and cleans a GitHub username from username or full profile URL.
 */
function parseGitHubUsername(input) {
  if (!input) return '';
  let clean = String(input).trim().replace(/^@/, '');
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  clean = clean.replace(/\/+$/, '');
  return clean.split('/')[0].trim();
}

/**
 * Builds HTTP headers for GitHub REST API requests.
 */
function buildGitHubHeaders(token) {
  const headers = {
    'User-Agent': 'AutoCV-Robot/1.0',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token && String(token).trim().length > 0) {
    headers['Authorization'] = `Bearer ${String(token).trim()}`;
  }

  return headers;
}

/**
 * Loads mock repositories data fallback when live API request fails or is rate-limited.
 */
function loadMockFallback(reason) {
  const mockPath = path.resolve(__dirname, '../Mocks/mock_github_repos.json');
  if (fs.existsSync(mockPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(mockPath, 'utf8'));
      data.source = 'mock_fallback';
      data.fallback_reason = reason || 'Fallback triggered';
      data.fetched_at = new Date().toISOString();
      return data;
    } catch (e) {
      // Ignore JSON parse error, fall back to built-in minimal mock
    }
  }

  return {
    user: {
      login: 'candidate-dev',
      name: 'Candidate Developer',
      bio: 'Software engineer and automation enthusiast',
      public_repos: 2,
      avatar_url: 'https://avatars.githubusercontent.com/u/0'
    },
    repositories: [
      {
        name: 'cloud-distributed-scheduler',
        description: 'Distributed task scheduling system with Redis locks and retry backoff',
        language: 'TypeScript',
        stargazers_count: 99,
        forks_count: 14,
        topics: ['typescript', 'redis', 'docker', 'jest'],
        fork: false,
        html_url: 'https://github.com/candidate-dev/cloud-distributed-scheduler'
      },
      {
        name: 'autocv-core-engine',
        description: 'Automated career dossier synthesizer with RPA orchestration',
        language: 'Visual Basic',
        stargazers_count: 42,
        forks_count: 5,
        topics: ['uipath', 'automation', 'ats-resume'],
        fork: false,
        html_url: 'https://github.com/candidate-dev/autocv-core-engine'
      }
    ],
    source: 'internal_fallback',
    fallback_reason: reason || 'Mock file missing',
    fetched_at: new Date().toISOString()
  };
}

/**
 * Fetches GitHub user profile data.
 */
async function fetchUserProfile(username, headers) {
  const res = await fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(username)}`, {
    headers,
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('GitHub API Rate limit exceeded (HTTP 403)');
    } else if (res.status === 404) {
      throw new Error(`GitHub user '${username}' not found (HTTP 404)`);
    } else {
      throw new Error(`GitHub user API returned HTTP ${res.status}: ${res.statusText}`);
    }
  }

  return res.json();
}

/**
 * Fetches up to 100 repositories sorted by latest update.
 */
async function fetchUserRepositories(username, headers) {
  const url = `${GITHUB_API_BASE}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`;
  const res = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`GitHub repos API returned HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('GitHub repos response is not an array.');
  }

  return data;
}

/**
 * Filters, sorts, and transforms raw repository objects into ATS-ready project objects.
 */
function transformRepositories(rawRepos, username, maxRepos = DEFAULT_MAX_REPOS) {
  // Sort by update date descending
  const sorted = [...rawRepos].sort((a, b) => {
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
  });

  // Prioritize original (non-fork) repositories first
  const nonForks = sorted.filter(repo => !repo.fork);
  const forks = sorted.filter(repo => repo.fork);
  const prioritized = nonForks.concat(forks);

  return prioritized.slice(0, maxRepos).map(repo => ({
    name: repo.name || '',
    description: repo.description || '',
    language: repo.language || '',
    stargazers_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    fork: Boolean(repo.fork),
    html_url: repo.html_url || `https://github.com/${username}/${repo.name}`
  }));
}

/**
 * Main function fetching GitHub candidate dossier.
 */
async function fetchGitHubData(usernameOrUrl, token, useMockFallback = true, maxRepos = DEFAULT_MAX_REPOS) {
  const username = parseGitHubUsername(usernameOrUrl);

  if (!username) {
    if (useMockFallback) {
      return loadMockFallback('Empty or invalid GitHub username/URL');
    }
    throw new Error('Empty or invalid GitHub username/URL provided.');
  }

  const headers = buildGitHubHeaders(token);

  try {
    const userData = await fetchUserProfile(username, headers);
    const reposData = await fetchUserRepositories(username, headers);
    const topRepos = transformRepositories(reposData, username, maxRepos);

    return {
      user: {
        login: userData.login || username,
        name: userData.name || userData.login || username,
        bio: userData.bio || '',
        public_repos: userData.public_repos || topRepos.length,
        avatar_url: userData.avatar_url || ''
      },
      repositories: topRepos,
      source: 'live_github_api',
      fetched_at: new Date().toISOString()
    };
  } catch (err) {
    if (useMockFallback) {
      return loadMockFallback(err.message);
    }
    throw err;
  }
}

// CLI invocation handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const usernameOrUrl = args[0] || 'octocat';
  const token = args[1] || '';
  const useMockFallback = args[2] !== 'false';
  const outputPath = args[3] || '';
  const maxRepos = args[4] ? parseInt(args[4], 10) : DEFAULT_MAX_REPOS;

  fetchGitHubData(usernameOrUrl, token, useMockFallback, maxRepos)
    .then(result => {
      const jsonStr = JSON.stringify(result, null, 2);
      if (outputPath) {
        const resolvedOut = path.resolve(outputPath);
        const dir = path.dirname(resolvedOut);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(resolvedOut, jsonStr, 'utf8');
      }
      console.log(jsonStr);
    })
    .catch(err => {
      console.error(JSON.stringify({ error: err.message, success: false }));
      process.exit(1);
    });
}

module.exports = {
  fetchGitHubData,
  parseGitHubUsername,
  buildGitHubHeaders,
  loadMockFallback,
  transformRepositories
};
