/**
 * openXmlBuilder.js
 * AutoCV OpenXML Generation Submodule
 * Generates ATS-compliant Microsoft Word OpenXML runs and paragraphs (<w:p>, <w:r>).
 */

const {
  escapeXml,
  cleanUrl,
  cleanExperienceList,
  generateProjectSummary
} = require('./normalizer');

/**
 * Builds OpenXML representation for Work Experience section.
 */
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

/**
 * Builds OpenXML representation for Technical Projects section.
 */
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

/**
 * Builds OpenXML representation for Technical Skills section.
 */
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

/**
 * Builds OpenXML representation for Education section.
 */
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

/**
 * Builds OpenXML representation for Custom Sections.
 */
function buildCustomSectionsOpenXml(customSections) {
  if (!customSections || customSections.length === 0) {
    return '';
  }

  return customSections.map((section) => {
    const itemsXml = (section.items || []).map(entry => {
      const title = entry?.title || '';
      const description = entry?.description || '';

      if (title && description) {
        return `<w:p>
        <w:pPr>
          <w:ind w:left="280" w:hanging="160"/>
          <w:spacing w:before="12" w:after="20" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve">•  </w:t>
        </w:r>
        <w:r>
          <w:rPr><w:b/><w:sz w:val="19"/><w:color w:val="0F172A"/></w:rPr>
          <w:t xml:space="preserve">${escapeXml(title)}</w:t>
        </w:r>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve"> — ${escapeXml(description)}</w:t>
        </w:r>
      </w:p>`;
      }
      const text = (title || description).trim();
      if (!text) {
        return '';
      }
      return `<w:p>
        <w:pPr>
          <w:ind w:left="280" w:hanging="160"/>
          <w:spacing w:before="12" w:after="20" w:line="240" w:lineRule="auto"/>
        </w:pPr>
        <w:r>
          <w:rPr><w:sz w:val="19"/><w:color w:val="334155"/></w:rPr>
          <w:t xml:space="preserve">•  ${escapeXml(text)}</w:t>
        </w:r>
      </w:p>`;
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

module.exports = {
  buildExperienceOpenXml,
  buildProjectsOpenXml,
  buildSkillsOpenXml,
  buildEducationOpenXml,
  buildCustomSectionsOpenXml
};
