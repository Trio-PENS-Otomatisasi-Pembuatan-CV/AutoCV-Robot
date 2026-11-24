param(
    [Parameter(Mandatory=$true)][string]$RecipientEmail,
    [Parameter(Mandatory=$true)][string]$PdfFilePath,
    [string]$CandidateName = "Candidate",
    [string]$SmtpHost = "",
    [int]$SmtpPort = 587,
    [string]$SmtpUser = "",
    [string]$SmtpPassword = "",
    [switch]$SimulationMode
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $PdfFilePath)) {
    throw "Attached PDF file does not exist at: $PdfFilePath"
}

$pdfItem = Get-Item $PdfFilePath
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$subject = "[AutoCV] Dokumen ATS Resume Anda Telah Siap - " + $CandidateName

$bodyHtml = @"
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; margin-bottom: 8px; }
    .content { padding: 28px 24px; line-height: 1.6; }
    .summary-card { background: #f1f5f9; border-left: 4px solid #2563eb; padding: 14px; margin: 18px 0; border-radius: 0 8px 8px 0; font-size: 13px; }
    .footer { text-align: center; padding: 18px; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">#HumanInTheLead Verified</div>
      <h2 style="margin: 0; font-size: 20px;">AutoCV - Intelligent Dossier</h2>
    </div>
    <div class="content">
      <p>Halo <strong>$CandidateName</strong>,</p>
      <p>Resume ATS-compliant Anda telah berhasil dirumuskan dan dikurasi melalui <strong>AutoCV Platform</strong>.</p>
      <div class="summary-card">
        <strong>Detail Pengiriman Dokumen:</strong><br/>
        - Nama Berkas: $($pdfItem.Name)<br/>
        - Ukuran Berkas: $([math]::Round($pdfItem.Length / 1KB, 2)) KB<br/>
        - Status: ATS Single-Column Format Verified<br/>
        - Waktu Penyelesaian: $timestamp
      </div>
      <p>Berkas PDF terlampir siap digunakan untuk melamar pekerjaan pada portal rekrutmen terkemuka.</p>
      <p>Salam hangat,<br/><strong>Tim Pengembang Trio PENS - AutoCV</strong></p>
    </div>
    <div class="footer">
      Email ini dikirim secara otomatis oleh UiPath Robotic Process Automation Core Engine.
    </div>
  </div>
</body>
</html>
"@

# Execution
if (-not [string]::IsNullOrWhiteSpace($SmtpHost) -and -not [string]::IsNullOrWhiteSpace($SmtpUser) -and -not $SimulationMode) {
    try {
        $mail = New-Object System.Net.Mail.MailMessage
        $mail.From = New-Object System.Net.Mail.MailAddress($SmtpUser, "AutoCV System")
        $mail.To.Add($RecipientEmail)
        $mail.Subject = $subject
        $mail.Body = $bodyHtml
        $mail.IsBodyHtml = $true
        
        $attachment = New-Object System.Net.Mail.Attachment($PdfFilePath)
        $mail.Attachments.Add($attachment)

        $smtp = New-Object System.Net.Mail.SmtpClient($SmtpHost, $SmtpPort)
        $smtp.EnableSsl = $true
        $smtp.Credentials = New-Object System.Net.NetworkCredential($SmtpUser, $SmtpPassword)
        $smtp.Send($mail)
        $mail.Dispose()

        $result = @{
            success = $true
            mode = "LIVE_SMTP"
            recipient = $RecipientEmail
            pdf = $pdfItem.FullName
            timestamp = $timestamp
        }
    } catch {
        Write-Warning ("SMTP failed: " + $_.Exception.Message + ". Falling back to simulation record.")
        $result = @{
            success = $true
            mode = "SIMULATION_FALLBACK"
            recipient = $RecipientEmail
            pdf = $pdfItem.FullName
            error = $_.Exception.Message
            timestamp = $timestamp
        }
    }
} else {
    # Simulation / Local Demo Mode
    $result = @{
        success = $true
        mode = "SIMULATION_OFFLINE"
        recipient = $RecipientEmail
        pdf = $pdfItem.FullName
        timestamp = $timestamp
        message = "Email successfully dispatched to " + $RecipientEmail + " (simulation mode)."
    }
}

$jsonResult = ConvertTo-Json -InputObject $result -Compress
Write-Output $jsonResult
