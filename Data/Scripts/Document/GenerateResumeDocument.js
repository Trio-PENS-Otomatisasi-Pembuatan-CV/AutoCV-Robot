/**
 * GenerateResumeDocument.js
 * AutoCV ATS-Compliant Document & PDF Generator
 * Orchestrator coordinating data normalization, OpenXML building, DOCX packaging, and resilient PDF export.
 */

const fs = require('fs');
const path = require('path');

const {
  parseJson,
  sanitizeFilename,
  cleanUrl,
  isDummyPhone,
  normalizePayload
} = require('./lib/normalizer');

const {
  buildExperienceOpenXml,
  buildProjectsOpenXml,
  buildSkillsOpenXml,
  buildEducationOpenXml,
  buildCustomSectionsOpenXml
} = require('./lib/openXmlBuilder');

const { packageDocx } = require('./lib/docxPackager');
const { buildResumeHtml } = require('./lib/htmlTemplate');
const { exportPdf } = require('./lib/pdfExporter');

/**
 * Main orchestration function for generating ATS-compliant DOCX and PDF resume files.
 * @param {object|string} rawPayload - Candidate payload object or raw JSON string.
 * @param {string} templatePath - Absolute or relative path to ATS_Resume_Template.docx.
 * @param {string} outputDir - Directory where output DOCX and PDF will be saved.
 * @returns {object} Generation result details.
 */
function generateResume(rawPayload, templatePath, outputDir) {
  const parsedData = typeof rawPayload === 'string' ? parseJson(rawPayload) : rawPayload;
  const payload = normalizePayload(parsedData);
  const profile = payload.profile || {};

  const fullName = profile.fullName || 'Candidate Name';
  const headline = profile.headline || 'Software Engineer';
  const email = profile.email || '';
  const phone = isDummyPhone(profile.phone) ? '' : (profile.phone || '');
  const location = profile.location || '';
  const linkedinUrl = cleanUrl(profile.linkedinUrl);
  const githubUrl = cleanUrl(profile.githubUrl);
  const summary = profile.summary || payload.summary || '';

  // 1. Format contact header line
  const contactParts = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  if (location) contactParts.push(location);
  if (linkedinUrl) contactParts.push(linkedinUrl);
  if (githubUrl) contactParts.push(githubUrl);
  const contactLine = contactParts.join('  •  ');

  // 2. Build OpenXML section components
  const expXml = buildExperienceOpenXml(payload.experiences);
  const projXml = buildProjectsOpenXml(payload.projects);
  const skillsXml = buildSkillsOpenXml(payload.skills);
  const eduXml = buildEducationOpenXml(payload.education);
  const customSectionsXml = buildCustomSectionsOpenXml(payload.customSections || []);

  // 3. Prepare target file paths
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

  // 4. Package DOCX with injected OpenXML blocks
  const resolvedTemplate = path.resolve(templatePath);
  packageDocx({
    templatePath: resolvedTemplate,
    outputDocxPath,
    replacements: {
      fullName,
      headline,
      contactLine,
      summary,
      experienceXml: expXml,
      projectsXml: projXml,
      skillsXml: skillsXml,
      educationXml: eduXml,
      customSectionsXml
    }
  });

  // 5. Generate resilient PDF (Word COM with 8s timeout guard + Chrome Headless fallback)
  const htmlContent = buildResumeHtml(payload);
  const pdfResult = exportPdf({
    docxPath: outputDocxPath,
    htmlContent,
    pdfPath: outputPdfPath,
    workDir: outputDir
  });

  return {
    success: true,
    docxPath: outputDocxPath,
    pdfPath: pdfResult.success ? outputPdfPath : '',
    candidateName: fullName,
    timestamp,
    pdfGenerated: Boolean(pdfResult.success),
    exportMethod: pdfResult.method || 'none',
    exportNote: pdfResult.fallbackNote || null
  };
}

// CLI entrypoint (invoked by RunResumeGeneration.ps1 / UiPath)
if (require.main === module) {
  const payloadPath = process.argv[2];
  const templatePath = process.argv[3] || path.resolve(__dirname, '../Templates/ATS_Resume_Template.docx');
  const outputDir = process.argv[4] || path.resolve(__dirname, '../Outputs');

  if (!payloadPath) {
    console.error(JSON.stringify({ success: false, error: 'Usage: node GenerateResumeDocument.js <payload.json> [template.docx] [outputDir]' }));
    process.exit(1);
  }

  try {
    const rawContent = fs.readFileSync(path.resolve(payloadPath), 'utf8');
    const result = generateResume(rawContent, templatePath, outputDir);
    console.log(JSON.stringify(result));
  } catch (err) {
    console.error(JSON.stringify({ success: false, error: err.message, stack: err.stack }));
    process.exit(1);
  }
}

module.exports = {
  generateResume
};
