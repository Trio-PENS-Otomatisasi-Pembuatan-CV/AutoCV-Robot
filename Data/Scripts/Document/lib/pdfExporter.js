/**
 * pdfExporter.js
 * AutoCV Resilient PDF Exporter Submodule
 * Implements a dual-engine export strategy:
 *   1. MS Word COM Automation (with strict timeout guard and alert suppression)
 *   2. Instant Chrome / Chromium Headless fallback
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Browser candidates in priority order
const CHROME_CANDIDATE_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  process.env.CHROME_BIN,
  process.env.PUPPETEER_EXECUTABLE_PATH
].filter(Boolean);

/**
 * Finds the first available headless browser binary.
 */
function findAvailableBrowser() {
  for (const candidate of CHROME_CANDIDATE_PATHS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/**
 * Attempts to export DOCX to PDF using Word COM automation via PowerShell.
 * @param {string} docxPath - Absolute path to .docx file.
 * @param {string} pdfPath - Absolute path to target .pdf file.
 * @param {number} timeoutMs - Timeout in milliseconds (default: 8000ms).
 */
function exportViaWordCom(docxPath, pdfPath, timeoutMs = 8000) {
  if (!fs.existsSync(docxPath)) {
    return { success: false, error: `DOCX file not found: ${docxPath}` };
  }

  // Remove existing output PDF before generating
  if (fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath);
    } catch (e) {
      // Ignore unlink error
    }
  }

  // PowerShell script with alert suppression and explicit cleanup
  const safeDocx = docxPath.replace(/'/g, "''");
  const safePdf = pdfPath.replace(/'/g, "''");

  const psScript = `
    $ErrorActionPreference = 'Stop'
    $word = $null
    $doc = $null
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $word.DisplayAlerts = 0
      $doc = $word.Documents.Open('${safeDocx}')
      # 17 = wdExportFormatPDF
      $doc.ExportAsFixedFormat('${safePdf}', 17)
      $doc.Close([ref]0)
      $word.Quit()
      [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    catch {
      if ($doc -ne $null) { try { $doc.Close([ref]0) } catch {} }
      if ($word -ne $null) { try { $word.Quit() } catch {} }
      throw $_
    }
  `.trim();

  try {
    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`, {
      timeout: timeoutMs,
      stdio: 'ignore'
    });

    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
      return { success: true, method: 'word_com', pdfPath };
    }
    return { success: false, error: 'Word COM finished but output PDF was empty or missing' };
  } catch (err) {
    return {
      success: false,
      error: err.code === 'ETIMEDOUT' ? `Word COM timed out after ${timeoutMs}ms` : err.message
    };
  }
}

/**
 * Attempts to export HTML to PDF using Chrome/Chromium Headless.
 * @param {string} htmlPath - Absolute path to .html file.
 * @param {string} pdfPath - Absolute path to target .pdf file.
 * @param {number} timeoutMs - Timeout in milliseconds (default: 12000ms).
 */
function exportViaChromeHeadless(htmlPath, pdfPath, timeoutMs = 12000) {
  if (!fs.existsSync(htmlPath)) {
    return { success: false, error: `HTML file not found: ${htmlPath}` };
  }

  const browserPath = findAvailableBrowser();
  if (!browserPath) {
    return { success: false, error: 'No compatible headless browser (Chrome/Edge) found on system' };
  }

  if (fs.existsSync(pdfPath)) {
    try {
      fs.unlinkSync(pdfPath);
    } catch (e) {
      // Ignore
    }
  }

  try {
    const cmd = `"${browserPath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;
    execSync(cmd, {
      timeout: timeoutMs,
      stdio: 'ignore'
    });

    if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
      return { success: true, method: 'chrome_headless', pdfPath };
    }
    return { success: false, error: 'Chrome Headless finished but output PDF was empty or missing' };
  } catch (err) {
    return {
      success: false,
      error: err.code === 'ETIMEDOUT' ? `Chrome Headless timed out after ${timeoutMs}ms` : err.message
    };
  }
}

/**
 * Orchestrates resilient dual-engine PDF export.
 * Tries Word COM first with strict timeout guard.
 * If Word COM is unavailable, times out, or fails, automatically falls back to Chrome Headless.
 */
function exportPdf({ docxPath, htmlContent, pdfPath, workDir, wordTimeoutMs = 8000, chromeTimeoutMs = 12000 }) {
  const dir = workDir || path.dirname(pdfPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempHtmlPath = path.resolve(
    dir,
    `temp_cv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.html`
  );

  let wordComError = null;

  // 1. Try Word COM if docx exists
  if (docxPath && fs.existsSync(docxPath)) {
    const wordRes = exportViaWordCom(docxPath, pdfPath, wordTimeoutMs);
    if (wordRes.success) {
      return wordRes;
    }
    wordComError = wordRes.error;
  }

  // 2. Fallback: Chrome Headless via HTML
  try {
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');
    const chromeRes = exportViaChromeHeadless(tempHtmlPath, pdfPath, chromeTimeoutMs);
    if (chromeRes.success) {
      return {
        ...chromeRes,
        fallbackNote: wordComError ? `Fell back to Chrome Headless (Word COM bypassed: ${wordComError})` : null
      };
    }

    return {
      success: false,
      error: `All PDF export engines failed. Word COM: ${wordComError || 'skipped'}. Chrome: ${chromeRes.error}`
    };
  } finally {
    // Clean up temporary HTML
    try {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    } catch (e) {
      // Ignore
    }
  }
}

module.exports = {
  findAvailableBrowser,
  exportViaWordCom,
  exportViaChromeHeadless,
  exportPdf
};
