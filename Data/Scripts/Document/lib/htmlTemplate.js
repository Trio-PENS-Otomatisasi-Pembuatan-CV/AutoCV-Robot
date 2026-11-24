/**
 * htmlTemplate.js
 * AutoCV ATS-Compliant HTML Document Generator Submodule
 * Generates semantic HTML optimized for single-column ATS parsing and high-fidelity PDF rendering.
 */

const {
  escapeXml,
  cleanUrl,
  cleanExperienceList,
  generateProjectSummary
} = require('./normalizer');

/**
 * Builds the complete HTML document string for a candidate resume.
 */
function buildResumeHtml(payload) {
  const profile = payload.profile || {};
  const fullName = profile.fullName || 'Candidate Name';
  const headline = profile.headline || 'Software Engineer';
  const email = profile.email || '';
  const phone = profile.phone || '';
  const location = profile.location || '';
  const linkedinUrl = cleanUrl(profile.linkedinUrl);
  const githubUrl = cleanUrl(profile.githubUrl);
  const summary = profile.summary || payload.summary || '';

  const contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  if (location) contactParts.push(location);
  if (linkedinUrl) contactParts.push(linkedinUrl);
  if (githubUrl) contactParts.push(githubUrl);
  const contactLine = contactParts.join('  •  ');

  const cleanedExperiences = cleanExperienceList(payload.experiences);
  const selectedProjects = (payload.projects || []).filter((p) => p.isSelected !== false);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeXml(fullName)} - ATS Resume</title>
<style>
  @page { size: Letter; margin: 15mm; }
  body {
    font-family: 'Calibri', 'Segoe UI', 'Arial', sans-serif;
    color: #1e293b;
    line-height: 1.35;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }
  h1 {
    font-size: 19pt;
    text-align: center;
    margin: 0 0 2px 0;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 800;
  }
  .headline {
    font-size: 10.5pt;
    text-align: center;
    color: #1e293b;
    margin-bottom: 4px;
    font-weight: 600;
  }
  .contact {
    font-size: 9pt;
    text-align: center;
    color: #475569;
    margin-bottom: 12px;
  }
  .section-title {
    font-size: 11pt;
    font-weight: bold;
    color: #0f172a;
    border-bottom: 1.5px solid #0f172a;
    padding-bottom: 2px;
    margin: 10px 0 6px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 6px;
    font-size: 10pt;
  }
  .entry-title {
    font-weight: bold;
    color: #0f172a;
  }
  .entry-sub {
    font-weight: normal;
    color: #334155;
  }
  .entry-date {
    font-weight: 600;
    color: #475569;
    font-size: 9.5pt;
  }
  .entry-repo {
    color: #64748b;
    font-size: 9pt;
  }
  .entry-location {
    font-style: italic;
    color: #64748b;
    font-size: 9pt;
    margin-bottom: 2px;
  }
  .tech-stack {
    color: #2563eb;
    font-size: 9.5pt;
    font-weight: normal;
  }
  ul {
    margin: 2px 0 4px 18px;
    padding: 0;
  }
  li {
    margin-bottom: 2px;
    font-size: 9.5pt;
    color: #334155;
    line-height: 1.35;
  }
  p {
    margin: 3px 0;
  }
  .skills-row {
    margin: 3px 0;
    font-size: 9.5pt;
    color: #334155;
  }
  .skills-cat {
    font-weight: bold;
    color: #0f172a;
  }
</style>
</head>
<body>
  <h1>${escapeXml(fullName)}</h1>
  <div class="headline">${escapeXml(headline)}</div>
  <div class="contact">${escapeXml(contactLine)}</div>

  ${summary ? `
  <div class="section-title">Professional Summary</div>
  <p>${escapeXml(summary)}</p>
  ` : ''}

  ${cleanedExperiences.length > 0 ? `
  <div class="section-title">Work Experience</div>
  ${cleanedExperiences.map((exp) => `
    <div class="entry-header">
      <div>
        <span class="entry-title">${escapeXml(exp.role)}</span>
        <span class="entry-sub"> — ${escapeXml(exp.company)}</span>
      </div>
      <div class="entry-date">${escapeXml(exp.period)}</div>
    </div>
    ${exp.location ? `<div class="entry-location">${escapeXml(exp.location)}</div>` : ''}
    <ul>
      ${(exp.bulletPoints || []).map((b) => `<li>${escapeXml(b)}</li>`).join('')}
    </ul>
  `).join('')}
  ` : ''}

  ${selectedProjects.length > 0 ? `
  <div class="section-title">Featured Technical Projects (#HumanInTheLead)</div>
  ${selectedProjects.map((proj) => {
    const stack = proj.techStack && proj.techStack.length > 0
      ? ` [${proj.techStack.join(', ')}]`
      : (proj.language ? ` [${proj.language}]` : '');
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
  ` : ''}

  ${(payload.skills || []).length > 0 ? `
  <div class="section-title">Technical Skills</div>
  ${(payload.skills || []).map((s) => `
    <div class="skills-row">
      <span class="skills-cat">${escapeXml(s.category)}:</span> ${escapeXml((s.items || []).join(', '))}
    </div>
  `).join('')}
  ` : ''}

  ${(payload.education || []).length > 0 ? `
  <div class="section-title">Education</div>
  ${(payload.education || []).map((edu) => `
    <div class="entry-header">
      <div>
        <span class="entry-title">${escapeXml(edu.degree)}</span>
        <span class="entry-sub"> — ${escapeXml(edu.institution)}</span>
      </div>
      <div class="entry-date">${escapeXml(edu.graduationYear || 'Present')}</div>
    </div>
    ${edu.gpa ? `<div class="entry-location">GPA: ${escapeXml(edu.gpa)}</div>` : ''}
  `).join('')}
  ` : ''}

  ${(payload.customSections || []).map((section) => {
    const itemsHtml = (section.items || []).map((entry) => {
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
}

module.exports = {
  buildResumeHtml
};
