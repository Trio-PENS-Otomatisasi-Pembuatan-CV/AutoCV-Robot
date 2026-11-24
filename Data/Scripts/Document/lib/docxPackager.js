/**
 * docxPackager.js
 * AutoCV DOCX OpenXML Archive Manipulation Submodule
 * Unzips DOCX templates, injects custom OpenXML sections, and re-compresses into valid DOCX files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { escapeXml } = require('./normalizer');

/**
 * Extracts a DOCX zip archive into a target directory.
 */
function extractDocx(templatePath, targetDir) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`DOCX template not found at: ${templatePath}`);
  }
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const psExtract = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${templatePath.replace(/'/g, "''")}', '${targetDir.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -Command "${psExtract}"`, { stdio: 'ignore' });
}

/**
 * Repacks an uncompressed directory structure back into a DOCX archive.
 */
function repackDocx(sourceDir, outputDocxPath) {
  if (fs.existsSync(outputDocxPath)) {
    try {
      fs.unlinkSync(outputDocxPath);
    } catch (e) {
      // Ignore if file was already removed
    }
  }

  const outputDir = path.dirname(outputDocxPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const psZip = `Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${sourceDir.replace(/'/g, "''")}', '${outputDocxPath.replace(/'/g, "''")}')`;
  execSync(`powershell -NoProfile -Command "${psZip}"`, { stdio: 'ignore' });
}

/**
 * Replaces a paragraph containing an exact placeholder tag with an OpenXML block.
 */
function replaceParagraphBlock(xmlContent, placeholder, replacementXml) {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<w:p(?: [^>]*)?>(?:(?!<\\/w:p>)[\\s\\S])*?<w:t>${escaped}<\\/w:t>(?:(?!<\\/w:p>)[\\s\\S])*?<\\/w:p>`
  );
  return xmlContent.replace(pattern, replacementXml);
}

/**
 * Injects candidate data and section OpenXML into word/document.xml.
 */
function injectDocxContent(docXml, replacements) {
  let modified = docXml;

  // Simple string replacements
  if (replacements.fullName !== undefined) {
    modified = modified.replace(/\{\{FULL_NAME\}\}/g, escapeXml(replacements.fullName));
  }
  if (replacements.headline !== undefined) {
    modified = modified.replace(/\{\{HEADLINE\}\}/g, escapeXml(replacements.headline));
  }
  if (replacements.contactLine !== undefined) {
    modified = modified.replace(/\{\{CONTACT_LINE\}\}/g, escapeXml(replacements.contactLine));
  }
  if (replacements.summary !== undefined) {
    modified = modified.replace(/\{\{SUMMARY\}\}/g, escapeXml(replacements.summary));
  }

  // Block OpenXML replacements
  if (replacements.experienceXml !== undefined) {
    modified = replaceParagraphBlock(modified, '{{EXPERIENCE_SECTION}}', replacements.experienceXml);
  }
  if (replacements.projectsXml !== undefined) {
    modified = replaceParagraphBlock(modified, '{{PROJECTS_SECTION}}', replacements.projectsXml);
  }
  if (replacements.skillsXml !== undefined) {
    modified = replaceParagraphBlock(modified, '{{SKILLS_SECTION}}', replacements.skillsXml);
  }
  if (replacements.educationXml !== undefined) {
    const combinedEdu = (replacements.educationXml || '') + (replacements.customSectionsXml || '');
    modified = replaceParagraphBlock(modified, '{{EDUCATION_SECTION}}', combinedEdu);
  }

  return modified;
}

/**
 * High-level function that unpacks template, replaces tokens, and repackages DOCX.
 */
function packageDocx({ templatePath, outputDocxPath, replacements, tempDir }) {
  const extractDir = path.resolve(
    tempDir || process.env.TEMP || '/tmp',
    `autocv_doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`
  );

  try {
    extractDocx(templatePath, extractDir);

    const docXmlPath = path.join(extractDir, 'word', 'document.xml');
    if (!fs.existsSync(docXmlPath)) {
      throw new Error(`word/document.xml not found in extracted template at ${extractDir}`);
    }

    const originalXml = fs.readFileSync(docXmlPath, 'utf8');
    const updatedXml = injectDocxContent(originalXml, replacements);
    fs.writeFileSync(docXmlPath, updatedXml, 'utf8');

    repackDocx(extractDir, outputDocxPath);
    return true;
  } finally {
    // Cleanup extraction folder
    try {
      if (fs.existsSync(extractDir)) {
        fs.rmSync(extractDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

module.exports = {
  extractDocx,
  repackDocx,
  replaceParagraphBlock,
  injectDocxContent,
  packageDocx
};
