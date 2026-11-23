/**
 * GenerateResumeDocument.js
 * AutoCV ATS-Compliant Document & PDF Generator
 * Replaces placeholders in ATS_Resume_Template.docx and exports to true PDF.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  const value =
    typeof text === 'string' && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
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

      // Clean LinkedIn "+1 skill" noise
      trimmed = trimmed.replace(/\s+and\s+\+\d+\s+skills?/gi, '').trim();

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

function buildExperienceOpenXml(experiences) {
  const cleaned = cleanExperienceList(experiences);
  if (cleaned.length === 0) {
    return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Professional experience details available upon request.</w:t></w:r></w:p>`;
  }

  return cleaned.map((exp) => {
    const isLongCombined = (exp.role.length + exp.company.length) > 55;

    let headerBlock = '';
    if (isLongCombined) {
      // Line 1: Role on Left, Date on Right
      // Line 2: Company & Location on Sub-line
      headerBlock = `
        <w:p>
          <w:pPr>
            <w:keepNext/>
            <w:tabs><w:tab w:val="right" w:pos="10512"/></w:tabs>
            <w:spacing w:before="80" w:after="10"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.role)}</w:t>
          </w:r>
          <w:r><w:tab/></w:r>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="475569"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.period)}</w:t>
          </w:r>
        </w:p>
        <w:p>
          <w:pPr>
            <w:keepNext/>
            <w:spacing w:before="0" w:after="20"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:sz w:val="20"/><w:color w:val="334155"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.company)}</w:t>
          </w:r>
          ${exp.location ? `
          <w:r>
            <w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
            <w:t xml:space="preserve">  |  ${escapeXml(exp.location)}</w:t>
          </w:r>` : ''}
        </w:p>`;
    } else {
      // Single line: Role — Company on Left, Date on Right
      headerBlock = `
        <w:p>
          <w:pPr>
            <w:keepNext/>
            <w:tabs><w:tab w:val="right" w:pos="10512"/></w:tabs>
            <w:spacing w:before="80" w:after="20"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.role)}</w:t>
          </w:r>
          <w:r>
            <w:rPr><w:sz w:val="21"/><w:color w:val="334155"/></w:rPr>
            <w:t xml:space="preserve"> — ${escapeXml(exp.company)}</w:t>
          </w:r>
          <w:r><w:tab/></w:r>
          <w:r>
            <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="475569"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.period)}</w:t>
          </w:r>
        </w:p>
        ${exp.location ? `
        <w:p>
          <w:pPr>
            <w:keepNext/>
            <w:spacing w:before="0" w:after="20"/>
          </w:pPr>
          <w:r>
            <w:rPr><w:i/><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
            <w:t xml:space="preserve">${escapeXml(exp.location)}</w:t>
          </w:r>
        </w:p>` : ''}`;
    }

    const bulletsXml = (exp.bulletPoints || []).map((b) => `
      <w:p>
        <w:pPr>
          <w:ind w:left="280" w:hanging="160"/>
          <w:spacing w:before="12" w:after="20" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve">•  ${escapeXml(b)}</w:t>
        </w:r>
      </w:p>`).join('');

    return headerBlock + bulletsXml;
  }).join('');
}

function buildProjectsOpenXml(projects) {
  const selected = (projects || []).filter((p) => p.isSelected !== false);
  if (selected.length === 0) {
    return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Technical projects portfolio available upon request.</w:t></w:r></w:p>`;
  }

  return selected.map((proj) => {
    const stack = proj.techStack && proj.techStack.length > 0 ? ` [${proj.techStack.join(', ')}]` : (proj.language ? ` [${proj.language}]` : '');
    const cleanRepo = cleanUrl(proj.repoUrl);
    const summary = generateProjectSummary(proj);

    const headerP = `
      <w:p>
        <w:pPr>
          <w:keepNext/>
          <w:tabs><w:tab w:val="right" w:pos="10512"/></w:tabs>
          <w:spacing w:before="70" w:after="15"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(proj.name)}</w:t>
        </w:r>
        ${stack ? `<w:r><w:rPr><w:sz w:val="19"/><w:color w:val="2563EB"/></w:rPr><w:t xml:space="preserve">${escapeXml(stack)}</w:t></w:r>` : ''}
        <w:r><w:tab/></w:r>
        <w:r>
          <w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(cleanRepo)}</w:t>
        </w:r>
      </w:p>`;

    const bulletP = `
      <w:p>
        <w:pPr>
          <w:ind w:left="280" w:hanging="160"/>
          <w:spacing w:before="10" w:after="18" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve">•  ${escapeXml(summary)}</w:t>
        </w:r>
      </w:p>`;

    return headerP + bulletP;
  }).join('');
}

function buildSkillsOpenXml(skills) {
  if (!skills || skills.length === 0) {
    return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Technical skills not specified.</w:t></w:r></w:p>`;
  }

  return skills.map((cat) => {
    const items = (cat.items || []).join(', ');
    return `
      <w:p>
        <w:pPr>
          <w:spacing w:before="15" w:after="25" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="0F172A"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(cat.category)}: </w:t>
        </w:r>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(items)}</w:t>
        </w:r>
      </w:p>`;
  }).join('');
}

function buildEducationOpenXml(education) {
  if (!education || education.length === 0) {
    return `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:color w:val="64748B"/></w:rPr><w:t>Higher education details pending verification.</w:t></w:r></w:p>`;
  }

  return education.map((edu) => {
    const gpa = edu.gpa ? ` | GPA: ${edu.gpa}` : '';
    return `
      <w:p>
        <w:pPr>
          <w:keepNext/>
          <w:tabs><w:tab w:val="right" w:pos="10512"/></w:tabs>
          <w:spacing w:before="70" w:after="15"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(edu.degree)}</w:t>
        </w:r>
        <w:r>
          <w:rPr><w:sz w:val="21"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve"> — ${escapeXml(edu.institution)}</w:t>
        </w:r>
        <w:r><w:tab/></w:r>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="475569"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(edu.graduationYear || 'Present')}${escapeXml(gpa)}</w:t>
        </w:r>
      </w:p>`;
  }).join('');
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

function buildCustomSectionsOpenXml(customSections) {
  if (!customSections || customSections.length === 0) {
    return '';
  }

  return customSections.map((section) => {
    const itemsXml = (section.items || []).map(entry => {
      const title = entry?.title || '';
      const description = entry?.description || '';
      if (title) {
        return `<w:p><w:r><w:t xml:space="preserve">• </w:t></w:r></w:p>
<w:p><w:pPr><w:ind w:left="560"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="0F172A"/></w:rPr><w:t xml:space="preserve">${escapeXml(title)}</w:t></w:r>${description ? `<w:r><w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr><w:t xml:space="preserve"> — ${escapeXml(description)}</w:t></w:r>` : ''}</w:p>`;
      }
      return `<w:p><w:pPr><w:ind w:left="280"/></w:pPr><w:r><w:t xml:space="preserve">• ${escapeXml(description)}</w:t></w:r></w:p>`;
    }).join('');

    return `
      <w:p>
        <w:pPr>
          <w:spacing w:before="120" w:after="60"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="21"/><w:color w:val="0F172A"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(section.title)}</w:t>
        </w:r>
      </w:p>
      ${itemsXml}`;
  }).join('');
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
          id: s.id || crypto?.randomUUID?.() || `custom-${Date.now()}`,
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

function generateResume(rawPayload, templatePath, outputDir) {
  const payload = normalizePayload(rawPayload);
  const profile = payload.profile || {};
  const fullName = profile.fullName || 'Candidate Name';
  const headline = profile.headline || 'Software Engineer';
  const email = profile.email || '';
  const phone = isDummyPhone(profile.phone) ? '' : profile.phone;
  const location = profile.location || '';
  const linkedinUrl = cleanUrl(profile.linkedinUrl);
  const githubUrl = cleanUrl(profile.githubUrl);
  const summary = profile.summary || payload.summary || '';

  // Clean formatted contact line
  const contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  if (location) contactParts.push(location);
  if (linkedinUrl) contactParts.push(linkedinUrl);
  if (githubUrl) contactParts.push(githubUrl);
  const contactLine = contactParts.join('  •  ');

  const expXml = buildExperienceOpenXml(payload.experiences);
  const projXml = buildProjectsOpenXml(payload.projects);
  const skillsXml = buildSkillsOpenXml(payload.skills);
  const eduXml = buildEducationOpenXml(payload.education);
  const customSectionsXml = buildCustomSectionsOpenXml(payload.customSections || []);

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const safeName = sanitizeFilename(fullName);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputDocxName = `CV_${safeName}_${timestamp}.docx`;
  const outputPdfName = `CV_${safeName}_${timestamp}.pdf`;
  const outputDocxPath = path.resolve(outputDir, outputDocxName);
  const outputPdfPath = path.resolve(outputDir, outputPdfName);

  // 1. Unzip template to temp
  const tempExtract = path.resolve(process.env.TEMP || '/tmp', `autocv_doc_${Date.now()}`);
  fs.mkdirSync(tempExtract, { recursive: true });

  const psExtract = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${templatePath.replace(/'/g, "''")}', '${tempExtract.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -Command "${psExtract}"`);

  // 2. Read and replace document.xml
  const docXmlPath = path.join(tempExtract, 'word', 'document.xml');
  let docXml = fs.readFileSync(docXmlPath, 'utf8');

  docXml = docXml.replace(/\{\{FULL_NAME\}\}/g, escapeXml(fullName));
  docXml = docXml.replace(/\{\{HEADLINE\}\}/g, escapeXml(headline));
  docXml = docXml.replace(/\{\{CONTACT_LINE\}\}/g, escapeXml(contactLine));
  docXml = docXml.replace(/\{\{SUMMARY\}\}/g, escapeXml(summary));

  const replaceBlock = (placeholder, replacement) => {
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `<w:p(?: [^>]*)?>(?:(?!<\\/w:p>)[\\s\\S])*?<w:t>${escaped}<\\/w:t>(?:(?!<\\/w:p>)[\\s\\S])*?<\\/w:p>`
    );
    docXml = docXml.replace(pattern, replacement);
  };

  replaceBlock('{{EXPERIENCE_SECTION}}', expXml);
  replaceBlock('{{PROJECTS_SECTION}}', projXml);
  replaceBlock('{{SKILLS_SECTION}}', skillsXml);
  replaceBlock('{{EDUCATION_SECTION}}', eduXml + customSectionsXml);

  fs.writeFileSync(docXmlPath, docXml, 'utf8');

  // 3. Zip back into outputDocxPath
  if (fs.existsSync(outputDocxPath)) fs.unlinkSync(outputDocxPath);
  const psZip = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${tempExtract.replace(/'/g, "''")}', '${outputDocxPath.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -Command "${psZip}"`);

  // Clean temp
  try {
    fs.rmSync(tempExtract, { recursive: true, force: true });
  } catch (e) {}

  // 4. Generate PDF
  let pdfGenerated = false;

  // Try MS Word COM first if available
  try {
    const psWordExport = `
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $doc = $word.Documents.Open('${outputDocxPath.replace(/'/g, "''")}')
      $doc.ExportAsFixedFormat('${outputPdfPath.replace(/'/g, "''")}', 17)
      $doc.Close()
      $word.Quit()
    `;
    execSync(`powershell -NoProfile -Command "${psWordExport.replace(/\n/g, '; ')}"`, { stdio: 'ignore' });
    if (fs.existsSync(outputPdfPath) && fs.statSync(outputPdfPath).size > 0) {
      pdfGenerated = true;
    }
  } catch (err) {
    // Word COM not available, proceed to Chrome fallback
  }

  // Chrome Headless fallback
  if (!pdfGenerated) {
    const htmlPath = path.resolve(outputDir, `CV_${safeName}_${timestamp}.html`);
    const cleanedExperiences = cleanExperienceList(payload.experiences);
    const selectedProjects = (payload.projects || []).filter((p) => p.isSelected !== false);

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: Letter; margin: 15mm; }
  body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; line-height: 1.35; font-size: 10pt; margin: 0; padding: 0; }
  h1 { font-size: 19pt; text-align: center; margin: 0 0 2px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 800; }
  .headline { font-size: 10.5pt; text-align: center; color: #1e293b; margin-bottom: 4px; font-weight: 600; }
  .contact { font-size: 9pt; text-align: center; color: #475569; margin-bottom: 12px; }
  .section-title { font-size: 11pt; font-weight: bold; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin: 10px 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px; font-size: 10pt; }
  .entry-title { font-weight: bold; color: #0f172a; }
  .entry-sub { font-weight: normal; color: #334155; }
  .entry-date { font-weight: 600; color: #475569; font-size: 9.5pt; }
  .entry-repo { color: #64748b; font-size: 9pt; }
  .entry-location { font-style: italic; color: #64748b; font-size: 9pt; margin-bottom: 2px; }
  .tech-stack { color: #2563eb; font-size: 9.5pt; font-weight: normal; }
  ul { margin: 2px 0 4px 18px; padding: 0; }
  li { margin-bottom: 2px; font-size: 9.5pt; color: #334155; line-height: 1.35; }
  p { margin: 3px 0; }
  .skills-row { margin: 3px 0; font-size: 9.5pt; color: #334155; }
  .skills-cat { font-weight: bold; color: #0f172a; }
</style>
</head>
<body>
  <h1>${escapeXml(fullName)}</h1>
  <div class="headline">${escapeXml(headline)}</div>
  <div class="contact">${escapeXml(contactLine)}</div>

  <div class="section-title">Professional Summary</div>
  <p>${escapeXml(summary)}</p>

  <div class="section-title">Work Experience</div>
  ${cleanedExperiences.map(exp => `
    <div class="entry-header">
      <div>
        <span class="entry-title">${escapeXml(exp.role)}</span>
        <span class="entry-sub"> — ${escapeXml(exp.company)}</span>
      </div>
      <div class="entry-date">${escapeXml(exp.period)}</div>
    </div>
    ${exp.location ? `<div class="entry-location">${escapeXml(exp.location)}</div>` : ''}
    <ul>
      ${(exp.bulletPoints || []).map(b => `<li>${escapeXml(b)}</li>`).join('')}
    </ul>
  `).join('')}

  <div class="section-title">Featured Technical Projects (#HumanInTheLead)</div>
  ${selectedProjects.map(proj => {
    const stack = proj.techStack && proj.techStack.length > 0 ? ` [${proj.techStack.join(', ')}]` : (proj.language ? ` [${proj.language}]` : '');
    const cleanRepo = cleanUrl(proj.repoUrl);
    const projSummary = generateProjectSummary(proj);
    return `
    <div class="entry-header">
      <div>
        <span class="entry-title">${escapeXml(proj.name)}</span>
        ${stack ? `<span class="tech-stack">${escapeXml(stack)}</span>` : ''}
      </div>
      <div class="entry-repo">${escapeXml(cleanRepo)}</div>
    </div>
    <ul>
      <li>${escapeXml(projSummary)}</li>
    </ul>`;
  }).join('')}

  <div class="section-title">Technical Skills</div>
  ${(payload.skills || []).map(s => `
    <div class="skills-row">
      <span class="skills-cat">${escapeXml(s.category)}:</span> ${escapeXml((s.items || []).join(', '))}
    </div>
  `).join('')}

  <div class="section-title">Education</div>
  ${(payload.education || []).map(edu => `
    <div class="entry-header">
      <div>
        <span class="entry-title">${escapeXml(edu.degree)}</span>
        <span class="entry-sub"> — ${escapeXml(edu.institution)}</span>
      </div>
      <div class="entry-date">${escapeXml(edu.graduationYear || 'Present')}</div>
    </div>
    ${edu.gpa ? `<div class="entry-location">GPA: ${escapeXml(edu.gpa)}</div>` : ''}
  `).join('')}

  ${(payload.customSections || []).map(section => {
    const itemsHtml = (section.items || []).map(entry => {
      const title = entry?.title || '';
      const description = entry?.description || '';
      if (title) {
        return `<li><strong>${escapeXml(title)}</strong>${description ? ' — ' + escapeXml(description) : ''}</li>`;
      }
      return `<li>${escapeXml(description)}</li>`;
    }).join('');
    return `<div class="section-title">${escapeXml(section.title)}</div><ul>${itemsHtml}</ul>`;
  }).join('')}
</body>
</html>`;

    fs.writeFileSync(htmlPath, htmlContent, 'utf8');

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (fs.existsSync(chromePath)) {
      try {
        execSync(`"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "${htmlPath}"`, { stdio: 'ignore' });
        if (fs.existsSync(outputPdfPath)) {
          pdfGenerated = true;
        }
      } catch (e) {}
    }

    if (fs.existsSync(htmlPath)) {
      fs.unlinkSync(htmlPath);
    }
  }

  return {
    success: true,
    docxPath: outputDocxPath,
    pdfPath: outputPdfPath,
    candidateName: fullName,
    timestamp: timestamp,
    pdfGenerated: pdfGenerated
  };
}

// CLI handler if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonInput = args[0] || '{}';
  const templatePath = args[1] || path.resolve(__dirname, '../Templates/ATS_Resume_Template.docx');
  const outputDir = args[2] || path.resolve(__dirname, '../Outputs');

  try {
    let payload = {};
    if (jsonInput.startsWith('{')) {
      payload = parseJson(jsonInput);
    } else if (fs.existsSync(jsonInput)) {
      payload = parseJson(fs.readFileSync(jsonInput, 'utf8'));
    }

    const result = generateResume(payload, templatePath, outputDir);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}

module.exports = { generateResume };
