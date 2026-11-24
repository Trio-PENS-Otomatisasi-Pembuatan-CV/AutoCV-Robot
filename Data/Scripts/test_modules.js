/**
 * test_modules.js
 * Automated Verification & Unit Test Suite for refactored robot scripts
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('\n=== RUNNING AUTO-CV ROBOT MODULE TESTS ===\n');

  // 1. Normalizer tests
  console.log('--- 1. Testing normalizer.js ---');
  const normalizer = require('./Document/lib/normalizer');

  test('escapeXml correctly escapes special XML characters', () => {
    assert.strictEqual(normalizer.escapeXml('A & B < C > D " E \' F'), 'A &amp; B &lt; C &gt; D &quot; E &apos; F');
  });

  test('cleanUrl strips protocol and trailing slashes', () => {
    assert.strictEqual(normalizer.cleanUrl('https://www.linkedin.com/in/test/'), 'linkedin.com/in/test');
    assert.strictEqual(normalizer.cleanUrl('http://github.com/test///'), 'github.com/test');
  });

  test('cleanPeriod cleans LinkedIn noise like durations', () => {
    const res = normalizer.cleanPeriod('Aug 2022', 'Present', 'Aug 2022 – Present · 2 yrs 1 mo');
    assert.ok(res.includes('Aug 2022'));
    assert.ok(res.includes('Present'));
    assert.ok(!res.includes('2 yrs'));
  });

  test('cleanExperienceList cleans noise bullets like +1 skills', () => {
    const rawExps = [
      {
        role: 'Software Engineer',
        company: 'PT Tech',
        period: '2022 – Present',
        bulletPoints: [
          'Led architecture redesign',
          'and +3 skills',
          'Hybrid',
          '• Engineered REST API services'
        ]
      }
    ];
    const cleaned = normalizer.cleanExperienceList(rawExps);
    assert.strictEqual(cleaned.length, 1);
    assert.strictEqual(cleaned[0].bulletPoints.length, 2);
    assert.strictEqual(cleaned[0].bulletPoints[0], 'Led architecture redesign');
    assert.strictEqual(cleaned[0].bulletPoints[1], 'Engineered REST API services');
  });

  test('normalizePayload fills sensible defaults', () => {
    const payload = normalizer.normalizePayload({});
    assert.strictEqual(payload.profile.fullName, 'Candidate Name');
    assert.strictEqual(payload.profile.headline, 'Software Engineer');
    assert.ok(Array.isArray(payload.experiences));
    assert.ok(Array.isArray(payload.projects));
    assert.ok(Array.isArray(payload.skills));
  });

  // 2. OpenXML Builder tests
  console.log('\n--- 2. Testing openXmlBuilder.js ---');
  const openXml = require('./Document/lib/openXmlBuilder');

  test('buildExperienceOpenXml generates valid XML with w:p', () => {
    const exps = [
      { role: 'Backend Engineer', company: 'GoTech', period: '2021 – 2023', bulletPoints: ['Built caching layer'] }
    ];
    const xml = openXml.buildExperienceOpenXml(exps);
    assert.ok(xml.includes('<w:p>'));
    assert.ok(xml.includes('Backend Engineer'));
    assert.ok(xml.includes('GoTech'));
    assert.ok(xml.includes('Built caching layer'));
  });

  test('buildProjectsOpenXml generates project runs with repos and summaries', () => {
    const projs = [
      { name: 'cloud-scheduler', repoUrl: 'https://github.com/user/cloud-scheduler', starSummary: 'Distributed scheduler' }
    ];
    const xml = openXml.buildProjectsOpenXml(projs);
    assert.ok(xml.includes('cloud-scheduler'));
    assert.ok(xml.includes('Distributed scheduler'));
  });

  test('buildSkillsOpenXml generates category rows', () => {
    const skills = [
      { category: 'Languages', items: ['Go', 'TypeScript'] }
    ];
    const xml = openXml.buildSkillsOpenXml(skills);
    assert.ok(xml.includes('Languages:'));
    assert.ok(xml.includes('Go, TypeScript'));
  });

  // 3. HTML Template tests
  console.log('\n--- 3. Testing htmlTemplate.js ---');
  const htmlTemplate = require('./Document/lib/htmlTemplate');

  test('buildResumeHtml creates complete HTML document', () => {
    const payload = normalizer.normalizePayload({
      profile: { fullName: 'Alex Rivera', email: 'alex@example.com' },
      experiences: [{ role: 'Developer', company: 'Acme', period: '2020 – 2022', bulletPoints: ['Unit tests'] }]
    });
    const html = htmlTemplate.buildResumeHtml(payload);
    assert.ok(html.includes('<!DOCTYPE html>'));
    assert.ok(html.includes('Alex Rivera'));
    assert.ok(html.includes('alex@example.com'));
    assert.ok(html.includes('Acme'));
  });

  // 4. PDF Exporter tests
  console.log('\n--- 4. Testing pdfExporter.js ---');
  const pdfExporter = require('./Document/lib/pdfExporter');

  test('findAvailableBrowser locates system Chrome or Edge', () => {
    const browser = pdfExporter.findAvailableBrowser();
    assert.ok(browser !== null, 'Browser executable should be found on Windows system');
    assert.ok(fs.existsSync(browser), 'Found browser binary must physically exist');
  });

  // 5. GitHub Fetch tests
  console.log('\n--- 5. Testing FetchGitHubRepos.js ---');
  const github = require('./GitHub/FetchGitHubRepos');

  test('parseGitHubUsername extracts clean username from various formats', () => {
    assert.strictEqual(github.parseGitHubUsername('https://github.com/octocat'), 'octocat');
    assert.strictEqual(github.parseGitHubUsername('@octocat'), 'octocat');
    assert.strictEqual(github.parseGitHubUsername('octocat/'), 'octocat');
  });

  await runAsyncTest('fetchGitHubData returns mock fallback gracefully on empty/unauthorized user', async () => {
    const data = await github.fetchGitHubData('candidate-dev', '', true);
    assert.ok(data.user);
    assert.ok(Array.isArray(data.repositories));
    assert.ok(data.repositories.length > 0);
  });

  // 6. End-to-end Document Generation test
  console.log('\n--- 6. Testing GenerateResumeDocument.js End-to-End ---');
  const { generateResume } = require('./Document/GenerateResumeDocument');

  test('generateResume produces valid DOCX and PDF in seconds', () => {
    const mockPath = path.resolve(__dirname, '../Mocks/CuratedResumeMock.json');
    const templatePath = path.resolve(__dirname, '../Templates/ATS_Resume_Template.docx');
    const outputDir = path.resolve(__dirname, '../Outputs');

    const result = generateResume(fs.readFileSync(mockPath, 'utf8'), templatePath, outputDir);
    assert.strictEqual(result.success, true);
    assert.ok(result.docxPath && fs.existsSync(result.docxPath), 'DOCX must be created');
    assert.ok(result.pdfPath && fs.existsSync(result.pdfPath), 'PDF must be created');
    assert.strictEqual(result.pdfGenerated, true);
    assert.ok(['word_com', 'chrome_headless'].includes(result.exportMethod));

    const docxStat = fs.statSync(result.docxPath);
    const pdfStat = fs.statSync(result.pdfPath);
    assert.ok(docxStat.size > 1000, 'DOCX must not be empty');
    assert.ok(pdfStat.size > 5000, 'PDF must not be empty');
  });

  console.log('\n==========================================');
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
  console.log('==========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner encountered unexpected error:', err);
  process.exit(1);
});
