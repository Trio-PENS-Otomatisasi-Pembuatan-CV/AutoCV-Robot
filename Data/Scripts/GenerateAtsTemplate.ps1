Add-Type -AssemblyName System.IO.Compression.FileSystem

$templateDir = "$PSScriptRoot\..\Templates"
if (-not (Test-Path $templateDir)) {
    New-Item -ItemType Directory -Path $templateDir -Force | Out-Null
}

$tempDir = Join-Path $env:TEMP "autocv_template_$(Get-Random)"
$wordDir = Join-Path $tempDir "word"
$wordRelsDir = Join-Path $wordDir "_rels"
$relsDir = Join-Path $tempDir "_rels"

New-Item -ItemType Directory -Path $wordRelsDir -Force | Out-Null
New-Item -ItemType Directory -Path $relsDir -Force | Out-Null

$contentTypes = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'@

$pkgRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'@

$docRels = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'@

$stylesXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="21"/>
        <w:szCs w:val="21"/>
        <w:color w:val="334155"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>
'@

$documentXml = @'
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- RESUME HEADER -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="30"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="38"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>{{FULL_NAME}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="21"/>
          <w:color w:val="1E293B"/>
        </w:rPr>
        <w:t>{{HEADLINE}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="19"/>
          <w:color w:val="475569"/>
        </w:rPr>
        <w:t>{{CONTACT_LINE}}</w:t>
      </w:r>
    </w:p>

    <!-- SECTION: PROFESSIONAL SUMMARY -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="3" w:color="0F172A"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="50"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>PROFESSIONAL SUMMARY</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="20" w:after="80" w:line="260" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="20"/>
          <w:color w:val="334155"/>
        </w:rPr>
        <w:t>{{SUMMARY}}</w:t>
      </w:r>
    </w:p>

    <!-- SECTION: WORK EXPERIENCE -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="3" w:color="0F172A"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="50"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>WORK EXPERIENCE</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
      </w:pPr>
      <w:r>
        <w:t>{{EXPERIENCE_SECTION}}</w:t>
      </w:r>
    </w:p>

    <!-- SECTION: TECHNICAL PROJECTS -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="3" w:color="0F172A"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="50"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>FEATURED TECHNICAL PROJECTS</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
      </w:pPr>
      <w:r>
        <w:t>{{PROJECTS_SECTION}}</w:t>
      </w:r>
    </w:p>

    <!-- SECTION: TECHNICAL SKILLS -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="3" w:color="0F172A"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="50"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>TECHNICAL SKILLS</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
      </w:pPr>
      <w:r>
        <w:t>{{SKILLS_SECTION}}</w:t>
      </w:r>
    </w:p>

    <!-- SECTION: EDUCATION -->
    <w:p>
      <w:pPr>
        <w:keepNext/>
        <w:pBdr>
          <w:bottom w:val="single" w:sz="6" w:space="3" w:color="0F172A"/>
        </w:pBdr>
        <w:spacing w:before="120" w:after="50"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="22"/>
          <w:color w:val="0F172A"/>
        </w:rPr>
        <w:t>EDUCATION</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="0" w:after="0"/>
      </w:pPr>
      <w:r>
        <w:t>{{EDUCATION_SECTION}}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="720" w:right="864" w:bottom="720" w:left="864" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>
'@

[System.IO.File]::WriteAllText((Join-Path $tempDir "[Content_Types].xml"), $contentTypes, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $tempDir "_rels\.rels"), $pkgRels, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $wordDir "_rels\document.xml.rels"), $docRels, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $wordDir "styles.xml"), $stylesXml, [System.Text.Encoding]::UTF8)
[System.IO.File]::WriteAllText((Join-Path $wordDir "document.xml"), $documentXml, [System.Text.Encoding]::UTF8)

$targetDocx = Join-Path $templateDir "ATS_Resume_Template.docx"
if (Test-Path $targetDocx) {
    Remove-Item -Force $targetDocx
}

[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetDocx)
Remove-Item -Recurse -Force $tempDir

Write-Output "Successfully generated: $targetDocx"
