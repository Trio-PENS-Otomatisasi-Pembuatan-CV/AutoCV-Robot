/**
 * FetchGitHubRepos.js
 * AutoCV GitHub Repository & Profile Ingestion Module
 * Queries GitHub REST API for non-fork repositories, stars, and languages with automatic mock fallback.
 */

const fs = require('fs');
const path = require('path');

function parseGitHubUsername(input) {
  if (!input) return '';
  let clean = String(input).trim().replace(/^@/, '');
  clean = clean.replace(/^(?:https?:\/\/)?(?:www\.)?github\.com\//i, '');
  clean = clean.replace(/\/+$/, '');
  return clean.split('/')[0].trim();
}

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
      // ignore
    }
  }
  // Hardcoded minimal fallback if mock file is somehow inaccessible
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

async function fetchGitHubData(usernameOrUrl, token, useMockFallback = true) {
  const username = parseGitHubUsername(usernameOrUrl);

  if (!username) {
    if (useMockFallback) {
      return loadMockFallback('Empty or invalid GitHub username/URL');
    }
    throw new Error('Empty or invalid GitHub username/URL provided.');
  }

  const headers = {
    'User-Agent': 'AutoCV-Robot/1.0',
    'Accept': 'application/vnd.github.v3+json'
  };

  if (token && String(token).trim().length > 0) {
    headers['Authorization'] = `Bearer ${String(token).trim()}`;
  }

  try {
    // 1. Fetch User Profile
    const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers,
      signal: AbortSignal.timeout(8000)
    });

    if (!userRes.ok) {
      if (userRes.status === 403) {
        throw new Error(`GitHub API Rate limit exceeded (HTTP 403)`);
      } else if (userRes.status === 404) {
        throw new Error(`GitHub user '${username}' not found (HTTP 404)`);
      } else {
        throw new Error(`GitHub user API returned HTTP ${userRes.status}: ${userRes.statusText}`);
      }
    }

    const userData = await userRes.json();

    // 2. Fetch Repositories
    const reposRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, {
      headers,
      signal: AbortSignal.timeout(10000)
    });

    if (!reposRes.ok) {
      throw new Error(`GitHub repos API returned HTTP ${reposRes.status}: ${reposRes.statusText}`);
    }

    const reposData = await reposRes.json();

    if (!Array.isArray(reposData)) {
      throw new Error('GitHub repos response is not an array.');
    }

    // 3. Filter non-fork repositories and sort by stars descending, then updated_at
    const nonForks = reposData.filter(repo => !repo.fork);

    nonForks.sort((a, b) => {
      const starDiff = (b.stargazers_count || 0) - (a.stargazers_count || 0);
      if (starDiff !== 0) return starDiff;
      return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
    });

    // Take top 10 repositories
    const topRepos = nonForks.slice(0, 10).map(repo => ({
      name: repo.name || '',
      description: repo.description || '',
      language: repo.language || '',
      stargazers_count: repo.stargazers_count || 0,
      forks_count: repo.forks_count || 0,
      topics: Array.isArray(repo.topics) ? repo.topics : [],
      fork: false,
      html_url: repo.html_url || `https://github.com/${username}/${repo.name}`
    }));

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

  fetchGitHubData(usernameOrUrl, token, useMockFallback)
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

module.exports = { fetchGitHubData, parseGitHubUsername };
