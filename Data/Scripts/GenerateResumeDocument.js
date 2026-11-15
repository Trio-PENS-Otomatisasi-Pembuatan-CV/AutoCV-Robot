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

/**
 * Parse JSON text defensively.
 * UiPath's WriteTextFile activity with Encoding="utf-8" writes a UTF-8 BOM
 * (U+FEFF) at the start of the file. JSON.parse rejects that prefix with
 * "Unexpected token", which used to crash this script before any output was
 * printed. Strip the BOM before parsing.
 */
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

function formatExperienceSection(experiences) {
  if (!experiences || !Array.isArray(experiences) || experiences.length === 0) {
    return 'No experience records provided.';
  }
  return experiences
    .map((exp) => {
      // The LinkedIn mock carries one combined "period" string, so endDate is
      // empty; appending a default "Present" produced "(Nov 2026 - Present - Present)".
      const period = exp.endDate
        ? `${exp.startDate || ''} - ${exp.endDate}`
        : exp.startDate || '';
      const header = `${exp.role || 'Software Engineer'} — ${exp.company || 'Company'}${period ? ` (${period})` : ''}`;
      const bullets = (exp.bulletPoints || []).map((b) => `• ${b}`).join('\n');
      return `${header}\n${bullets}`;
    })
    .join('\n\n');
}

function formatProjectsSection(projects) {
  if (!projects || !Array.isArray(projects) || projects.length === 0) {
    return 'No technical projects selected.';
  }
  const selected = projects.filter((p) => p.isSelected !== false);
  if (selected.length === 0) {
    return 'No technical projects selected.';
  }
  return selected
    .map((proj) => {
      const stack = proj.techStack && proj.techStack.length > 0 ? ` [${proj.techStack.join(', ')}]` : '';
      const stars = proj.stars ? ` (★ ${proj.stars})` : '';
      const header = `${proj.name || 'Project'}${stars}${stack}`;
      const summary = proj.starSummary || proj.description || '';
      return `${header}\n• ${summary}\n  Repository: ${proj.repoUrl || ''}`;
    })
    .join('\n\n');
}

function formatSkillsSection(skills) {
  if (!skills || !Array.isArray(skills) || skills.length === 0) {
    return 'Technical skills not specified.';
  }
  return skills
    .map((cat) => {
      const items = (cat.items || []).join(', ');
      return `• ${cat.category || 'General'}: ${items}`;
    })
    .join('\n');
}

function formatEducationSection(education) {
  if (!education || !Array.isArray(education) || education.length === 0) {
    return 'Higher education details pending verification.';
  }
  return education
    .map((edu) => {
      const gpa = edu.gpa ? ` | GPA: ${edu.gpa}` : '';
      return `${edu.degree || 'Degree'} — ${edu.institution || 'University'} (${edu.graduationYear || 'Present'})${gpa}`;
    })
    .join('\n');
}

function convertTextToOpenXmlRuns(text, style = {}) {
  const lines = (text || '').split('\n');
  return lines
    .map((line) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('•');
      const isHeader = !isBullet && trimmed.length > 0 && (trimmed.includes('—') || !trimmed.includes(':'));

      const bTag = isHeader ? '<w:b/>' : '';
      const szVal = isHeader ? '21' : '20';
      const colorVal = isHeader ? '0F172A' : '334155';

      return `<w:p>
        <w:pPr>
          <w:spacing w:before="${isHeader ? '120' : '40'}" w:after="${isBullet ? '40' : '80'}" w:line="260" w:lineRule="auto"/>
          ${isBullet ? '<w:ind w:left="360" w:hanging="240"/>' : ''}
        </w:pPr>
        <w:r>
          <w:rPr>
            ${bTag}
            <w:sz w:val="${szVal}"/>
            <w:color w:val="${colorVal}"/>
          </w:rPr>
          <w:t xml:space="preserve">${escapeXml(line)}</w:t>
        </w:r>
      </w:p>`;
    })
    .join('');
}

const hasItems = (value) => Array.isArray(value) && value.length > 0;

/**
 * Map a flat LinkedIn skill list, or the grouped object emitted by UiPath
 * module 03 ({ languages: [], ... }), onto the renderer's [{category, items}] shape.
 */
function normalizeSkills(topLevel, linkedInSkills) {
  if (hasItems(topLevel) && typeof topLevel[0] === 'object' && Array.isArray(topLevel[0].items)) {
    return topLevel;
  }
  if (hasItems(topLevel) && typeof topLevel[0] === 'string') {
    return [{ category: 'Technical Skills', items: topLevel.slice() }];
  }
  if (topLevel && typeof topLevel === 'object' && !Array.isArray(topLevel)) {
    const grouped = Object.keys(topLevel)
      .filter((key) => hasItems(topLevel[key]))
      .map((key) => ({ category: key, items: topLevel[key].slice() }));
    if (hasItems(grouped)) return grouped;
  }
  return hasItems(linkedInSkills)
    ? [{ category: 'Technical Skills', items: linkedInSkills.slice() }]
    : [];
}

/**
 * Map GitHub repositories onto the renderer's project shape, skipping forks and
 * repositories that carry neither a description nor a language.
 */
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
      // The mock has no html_url, so rebuild it from the owner's login.
      repoUrl: repo.html_url || (login ? `https://github.com/${login}/${repo.name}` : ''),
      isSelected: true
    }));
}

/**
 * Bridge the UiPath draft contract onto the fields this renderer reads.
 *
 * UiPath module 03 emits { target_job_role, personal_info, linkedin_data,
 * github_data, projects, skills, pipeline } while the template sections below
 * read flat top-level arrays and a profile object. Without this bridge every
 * section fell back to placeholder text: education rendered as
 * "Higher education details pending verification.", experience as
 * "No experience records provided.", and the file was named CV_Candidate_Name_*.
 */
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

  const summary = profile.summary || linkedIn.about || '';

  return {
    ...src,
    profile: {
      fullName: profile.fullName || profile.name || linkedIn.full_name || (github.user && github.user.name),
      headline: profile.headline || linkedIn.headline || src.target_job_role || '',
      email: profile.email || profile.recipient_email || '',
      phone: profile.phone,
      location: profile.location,
      linkedinUrl: profile.linkedinUrl || profile.linkedin_url || '',
      githubUrl: profile.githubUrl || profile.github_url || '',
      summary
    },
    summary,
    experiences,
    projects: hasItems(src.projects) ? src.projects : normalizeProjects(github.repositories, github.user),
    skills: normalizeSkills(src.skills, linkedIn.skills),
    education
  };
}

function generateResume(rawPayload, templatePath, outputDir) {
  const payload = normalizePayload(rawPayload);
  const profile = payload.profile || {};
  const fullName = profile.fullName || profile.name || 'Candidate Name';
  const headline = profile.headline || profile.target_job_role || 'Software Engineer';
  const email = profile.email || profile.recipient_email || 'candidate@example.com';
  const phone = profile.phone || '+62 812-0000-0000';
  const location = profile.location || 'Indonesia';
  const linkedinUrl = profile.linkedinUrl || profile.linkedin_url || '';
  const githubUrl = profile.githubUrl || profile.github_url || '';
  const summary = profile.summary || payload.summary || 'Accomplished engineering professional.';

  const contactParts = [email, phone, location];
  if (linkedinUrl) contactParts.push(linkedinUrl);
  if (githubUrl) contactParts.push(githubUrl);
  const contactLine = contactParts.join('  |  ');

  const expXml = convertTextToOpenXmlRuns(formatExperienceSection(payload.experiences));
  const projXml = convertTextToOpenXmlRuns(formatProjectsSection(payload.projects));
  const skillsXml = convertTextToOpenXmlRuns(formatSkillsSection(payload.skills));
  const eduXml = convertTextToOpenXmlRuns(formatEducationSection(payload.education));

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

  // Replace each block placeholder's own paragraph with structured OpenXML.
  // The match has to stop at that paragraph's </w:p>. Anchoring on the first
  // <w:p> in the document (as the previous /<w:p>[\s\S]*?.../ patterns did)
  // swallowed every section above the placeholder, and because EXPERIENCE runs
  // before PROJECTS before SKILLS before EDUCATION each replacement erased the
  // one before it - leaving a document that contained only the education text.
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
  replaceBlock('{{EDUCATION_SECTION}}', eduXml);

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
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; line-height: 1.45; font-size: 10.5pt; }
  h1 { font-size: 20pt; text-align: center; margin: 0 0 4px 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }
  .headline { font-size: 11pt; text-align: center; color: #2563eb; font-style: italic; margin-bottom: 6px; font-weight: 600; }
  .contact { font-size: 9pt; text-align: center; color: #64748b; margin-bottom: 18px; }
  .section-title { font-size: 11.5pt; font-weight: bold; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 2px; margin: 14px 0 8px 0; text-transform: uppercase; letter-spacing: 0.5px; }
  .item-title { font-weight: bold; color: #0f172a; margin-top: 6px; }
  .item-sub { color: #475569; font-size: 9.5pt; margin-bottom: 4px; }
  ul { margin: 4px 0 8px 20px; padding: 0; }
  li { margin-bottom: 3px; }
  p { margin: 4px 0; }
</style>
</head>
<body>
  <h1>${escapeXml(fullName)}</h1>
  <div class="headline">${escapeXml(headline)}</div>
  <div class="contact">${escapeXml(contactLine)}</div>

  <div class="section-title">Professional Summary</div>
  <p>${escapeXml(summary)}</p>

  <div class="section-title">Work Experience</div>
  ${(payload.experiences || []).map(exp => `
    <div class="item-title">${escapeXml(exp.role || '')} — ${escapeXml(exp.company || '')}</div>
    <div class="item-sub">${escapeXml(exp.startDate || '')} - ${escapeXml(exp.endDate || 'Present')}</div>
    <ul>
      ${(exp.bulletPoints || []).map(b => `<li>${escapeXml(b)}</li>`).join('')}
    </ul>
  `).join('')}

  <div class="section-title">Featured Technical Projects (#HumanInTheLead)</div>
  ${(payload.projects || []).filter(p => p.isSelected !== false).map(proj => `
    <div class="item-title">${escapeXml(proj.name || '')} ${proj.stars ? `(★ ${proj.stars})` : ''} ${proj.techStack ? `[${proj.techStack.join(', ')}]` : ''}</div>
    <div class="item-sub">${escapeXml(proj.repoUrl || '')}</div>
    <ul>
      <li>${escapeXml(proj.starSummary || proj.description || '')}</li>
    </ul>
  `).join('')}

  <div class="section-title">Technical Skills</div>
  <ul>
    ${(payload.skills || []).map(s => `<li><strong>${escapeXml(s.category || 'Skill')}:</strong> ${escapeXml((s.items || []).join(', '))}</li>`).join('')}
  </ul>

  <div class="section-title">Education</div>
  ${(payload.education || []).map(edu => `
    <div class="item-title">${escapeXml(edu.degree || '')} — ${escapeXml(edu.institution || '')}</div>
    <div class="item-sub">${escapeXml(edu.graduationYear || '')} ${edu.gpa ? `| GPA: ${escapeXml(edu.gpa)}` : ''}</div>
  `).join('')}
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

    // Clean html temp
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
    // Report the real cause on stderr and exit non-zero.
    // RunResumeGeneration.ps1 captures stderr and turns it into
    // generation_result.json so the failure is visible to UiPath.
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}

module.exports = { generateResume };
