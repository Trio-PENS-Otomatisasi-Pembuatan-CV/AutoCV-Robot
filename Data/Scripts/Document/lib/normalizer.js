/**
 * normalizer.js
 * AutoCV Data Normalization & Sanitization Submodule
 * Handles cleaning of candidate profiles, LinkedIn DOM artifacts, GitHub repositories, and OpenXML escaping.
 */

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseJson(text) {
  if (typeof text !== 'string') return text;
  const value = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  return JSON.parse(value);
}

function sanitizeFilename(name) {
  return (name || 'Candidate')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}

function cleanUrl(url) {
  if (!url) return '';
  return String(url)
    .replace(/^https?:\/\/(www\.)?/, '')
    .replace(/\/+$/, '');
}

function isDummyPhone(phone) {
  if (!phone) return true;
  const p = String(phone).replace(/[\s\-\+\(\)]/g, '');
  return p.includes('00000000') || p === '6281200000000' || p === '1234567890';
}

function generateProjectSummary(proj) {
  if (proj.starSummary && proj.starSummary.trim()) return proj.starSummary.trim();
  if (proj.description && proj.description.trim()) return proj.description.trim();
  const lang = (proj.language || (proj.techStack && proj.techStack[0]) || '').trim();
  const name = (proj.name || 'Project').toLowerCase();
  if (name.includes('doc')) {
    return 'Comprehensive technical documentation and architectural specifications for software workflows.';
  }
  if (name.includes('devsecops') || name.includes('infra')) {
    return `Automated CI/CD security scanning pipelines and infrastructure deployment configurations${lang ? ` with ${lang}` : ''}.`;
  }
  if (name.includes('workshop')) {
    return `Hands-on container orchestration, system administration, and network configuration laboratory repository${lang ? ` using ${lang}` : ''}.`;
  }
  if (name.includes('backend')) {
    return `High-performance backend services, data persistence, and RESTful API endpoints${lang ? ` built with ${lang}` : ''}.`;
  }
  if (name.includes('frontend')) {
    return `Modern responsive web application interface with component architecture${lang ? ` developed in ${lang}` : ''}.`;
  }
  if (name.includes('mobile')) {
    return `Cross-platform mobile application interface with offline state management${lang ? ` using ${lang}` : ''}.`;
  }
  return `Engineered modular technical software solution${lang ? ` using ${lang}` : ''} following clean architecture principles.`;
}

function cleanPeriod(rawStart, rawEnd, rawPeriod) {
  let combined = (rawPeriod || rawStart || '').trim();
  if (rawEnd && rawEnd !== 'Present' && !combined.includes(rawEnd)) {
    combined = `${combined} – ${rawEnd}`;
  }

  // Strip LinkedIn duration indicators like "· 4 mos", "· 1 mo", "· 1 yr 1 mo", "· 10 mos"
  combined = combined.replace(/·\s*\d+\s*(yr|mos|year|month)s?(\s*\d+\s*mos?)?/gi, '').trim();
  combined = combined.replace(/·\s*\d+\s*mo/gi, '').trim();

  // If ends with duplicate "– Present – Present", deduplicate
  combined = combined.replace(/(–\s*Present\s*)+/gi, '– Present');
  combined = combined.replace(/(-\s*Present\s*)+/gi, '– Present');

  // Fix multiple dashes or trailing dashes
  combined = combined.replace(/\s*-\s*/g, ' – ').replace(/\s*–\s*$/, '').trim();

  return combined;
}

function cleanExperienceList(experiences) {
  if (!Array.isArray(experiences) || experiences.length === 0) return [];

  const noiseKeywords = /^(present|on-site|onsite|hybrid|remote|\+?\d+\s*skills?)$/i;
  const durationPattern = /^(\d+\s*(yr|mos|year|month)|·|\d+\s*mo)/i;
  const dateRangePattern = /^[A-Za-z]{3}\s*\d{4}\s*[-–]\s*([A-Za-z]{3}\s*\d{4}|Present)/i;
  const singleDatePattern = /^[A-Za-z]{3}\s*\d{4}(\s*·\s*\d+\s*mo)?/i;

  return experiences.map((exp) => {
    let role = (exp.role || exp.position || '').trim();
    let company = (exp.company || '').trim();
    let rawPeriod = (exp.period || exp.startDate || '').trim();
    let location = exp.location || '';

    // Handle nested company/role inversion when company is a duration string (e.g. "1 yr 3 mos")
    if (durationPattern.test(company) || !company) {
      company = role || 'Organization';
      role = 'Contributor';
    }

    let rawBullets = [];
    if (Array.isArray(exp.bulletPoints)) {
      rawBullets = exp.bulletPoints.flatMap((b) => String(b).split('\n'));
    } else if (exp.description) {
      rawBullets = String(exp.description).split('\n');
    }

    const cleanedBullets = [];
    for (const b of rawBullets) {
      let trimmed = b.trim().replace(/^•\s*/, '');
      if (!trimmed) continue;
      if (noiseKeywords.test(trimmed)) continue;
      if (durationPattern.test(trimmed)) continue;

      // Clean LinkedIn "+1 skill" / "and +X skills" noise
      trimmed = trimmed.replace(/^(and\s+)?\+\d+\s+skills?/gi, '').trim();
      trimmed = trimmed.replace(/\s+and\s+\+\d+\s+skills?/gi, '').trim();
      if (!trimmed) continue;

      // Extract date if period is missing and line is a date indicator
      if (dateRangePattern.test(trimmed) || singleDatePattern.test(trimmed)) {
        if (!rawPeriod) {
          rawPeriod = trimmed;
        }
        continue;
      }

      // Extract location if line looks like "Surabaya, East Java, Indonesia · On-site"
      if (/^[A-Za-z\s]+,\s*[A-Za-z\s]+.*$/i.test(trimmed) && trimmed.toLowerCase().includes('indonesia')) {
        if (!location) {
          location = trimmed.replace(/·\s*(on-site|hybrid|remote)/gi, '').trim();
        }
        continue;
      }

      // If role was defaulted and we find a sub-role like "Sekretaris Umum"
      if (role === 'Contributor' && trimmed.length < 50 && !trimmed.includes('—')) {
        role = trimmed;
        continue;
      }
      cleanedBullets.push(trimmed);
    }

    const period = cleanPeriod(exp.startDate, exp.endDate, rawPeriod);

    return {
      role: role || 'Contributor',
      company: company || 'Organization',
      period: period || 'Present',
      location,
      bulletPoints: cleanedBullets
    };
  });
}

const hasItems = (value) => Array.isArray(value) && value.length > 0;

function normalizeSkills(topLevel, linkedInSkills, linkedInCerts, githubRepos) {
  if (hasItems(topLevel) && typeof topLevel[0] === 'object' && Array.isArray(topLevel[0].items)) {
    const hasLanguages = topLevel.some((c) => /lang|tech|tool/i.test(c.category) && c.items.length > 0);
    if (!hasLanguages && Array.isArray(githubRepos)) {
      const discoveredLangs = Array.from(new Set(githubRepos.map((r) => r.language).filter(Boolean)));
      if (discoveredLangs.length > 0) {
        return [{ category: 'Programming Languages', items: discoveredLangs }, ...topLevel];
      }
    }
    return topLevel;
  }

  const result = [];

  if (Array.isArray(githubRepos)) {
    const discoveredLangs = Array.from(new Set(githubRepos.map((r) => r.language).filter(Boolean)));
    if (discoveredLangs.length > 0) {
      result.push({ category: 'Programming Languages', items: discoveredLangs });
    }
  }

  if (hasItems(linkedInSkills)) {
    result.push({ category: 'Technical Skills', items: linkedInSkills.slice() });
  }

  if (hasItems(linkedInCerts)) {
    const certNames = linkedInCerts.map((c) => (typeof c === 'string' ? c : c.name)).filter(Boolean);
    if (certNames.length > 0) {
      result.push({ category: 'Certifications', items: certNames });
    }
  }

  if (result.length === 0) {
    result.push({ category: 'Core Competencies', items: ['Software Engineering', 'Fullstack Development', 'System Architecture'] });
  }

  return result;
}

function normalizeProjects(repositories, githubUser) {
  if (!Array.isArray(repositories)) return [];
  const login = githubUser && githubUser.login;
  return repositories
    .filter((repo) => repo && repo.name && repo.fork !== true && (repo.description || repo.language))
    .map((repo) => ({
      name: repo.name,
      description: repo.description || '',
      techStack: repo.language ? [repo.language].concat(repo.topics || []) : repo.topics || [],
      stars: repo.stargazers_count || 0,
      repoUrl: repo.html_url || (login ? `https://github.com/${login}/${repo.name}` : ''),
      isSelected: true
    }));
}

function normalizePayload(rawPayload) {
  const src = rawPayload || {};
  const linkedIn = src.linkedin_data || src.raw_linkedin_data || {};
  const github = src.github_data || {};
  const profile = src.profile || src.personal_info || {};

  const experiences = hasItems(src.experiences)
    ? src.experiences
    : (linkedIn.experiences || []).map((exp) => ({
        role: exp.role || exp.position || '',
        company: exp.company || '',
        startDate: exp.startDate || exp.period || '',
        endDate: exp.endDate || '',
        location: exp.location || '',
        bulletPoints: hasItems(exp.bulletPoints)
          ? exp.bulletPoints
          : exp.description
            ? [exp.description]
            : []
      }));

  const education = hasItems(src.education)
    ? src.education
    : (linkedIn.education || []).map((edu) => ({
        degree: edu.degree || '',
        institution: edu.institution || '',
        graduationYear: edu.graduationYear || edu.year || '',
        gpa: edu.gpa
      }));

  const summary = profile.summary || linkedIn.about || 'Accomplished engineering professional with proven expertise in building modern software architectures and automation pipelines.';

  const projects = hasItems(src.projects)
    ? src.projects
    : normalizeProjects(github.repositories, github.user);

  const skills = normalizeSkills(src.skills, linkedIn.skills, linkedIn.certifications, github.repositories);

  const customSections = hasItems(src.customSections)
    ? src.customSections.map((s) => {
        const rawItems = Array.isArray(s.items) ? s.items : [];
        const normalizedItems = rawItems.map(item => {
          if (typeof item === 'string') {
            return { title: '', description: item };
          }
          if (item && typeof item === 'object') {
            return {
              title: item.title || item.heading || item.content || '',
              description: item.description || item.desc || item.content || ''
            };
          }
          return { title: '', description: '' };
        });
        return {
          id: s.id || `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: s.title || s.heading || 'Section',
          items: normalizedItems
        };
      })
    : [];

  return {
    ...src,
    profile: {
      fullName: profile.fullName || profile.name || linkedIn.full_name || (github.user && github.user.name) || 'Candidate Name',
      headline: profile.headline || linkedIn.headline || src.target_job_role || 'Software Engineer',
      email: profile.email || profile.recipient_email || '',
      phone: profile.phone,
      location: profile.location || 'Indonesia',
      linkedinUrl: profile.linkedinUrl || profile.linkedin_url || '',
      githubUrl: profile.githubUrl || profile.github_url || '',
      summary
    },
    summary,
    experiences,
    projects,
    skills,
    education,
    customSections
  };
}

module.exports = {
  escapeXml,
  parseJson,
  sanitizeFilename,
  cleanUrl,
  isDummyPhone,
  generateProjectSummary,
  cleanPeriod,
  cleanExperienceList,
  hasItems,
  normalizeSkills,
  normalizeProjects,
  normalizePayload
};
