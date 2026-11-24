param (
    [Parameter(Mandatory=$true)]
    [string]$WebhookBaseUrl,

    [Parameter(Mandatory=$true)]
    [string]$JobId,

    [Parameter(Mandatory=$true)]
    [ValidateSet("draft", "complete", "error")]
    [string]$EndpointType,

    [Parameter(Mandatory=$false)]
    [string]$PayloadJson = "",

    [Parameter(Mandatory=$false)]
    [string]$PdfFilePath = ""
)

$ErrorActionPreference = "Stop"

try {
    $baseUrl = $WebhookBaseUrl.TrimEnd("/")
    $url = "$baseUrl/api/cv/jobs/$JobId/$EndpointType"
    Write-Host "[Webhook] Target URL: $url"

    $body = $PayloadJson

    if ($EndpointType -eq "complete") {
        if (-not [string]::IsNullOrWhiteSpace($PdfFilePath) -and (Test-Path $PdfFilePath)) {
            $bytes = [System.IO.File]::ReadAllBytes($PdfFilePath)
            $base64 = [Convert]::ToBase64String($bytes)
            $bodyObj = @{
                pdfBase64 = $base64
                downloadUrl = "/api/cv/jobs/$JobId/download"
                emailSent = $true
                emailSentAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
            }
            $body = $bodyObj | ConvertTo-Json -Compress
        } elseif ([string]::IsNullOrWhiteSpace($body)) {
            $body = '{"downloadUrl":"/api/cv/jobs/' + $JobId + '/download","emailSent":true}'
        }
    } elseif ($EndpointType -eq "error") {
        if ([string]::IsNullOrWhiteSpace($body)) {
            $body = '{"error":"Robot execution failure"}'
        } elseif (-not ($body.Trim().StartsWith("{"))) {
            $body = (@{ error = $body } | ConvertTo-Json -Compress)
        }
    }

    if ([string]::IsNullOrWhiteSpace($body)) {
        $body = "{}"
    }

    $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 30
    Write-Host "[Webhook] Success! Response: $($response | ConvertTo-Json -Compress)"
    exit 0
} catch {
    Write-Warning "[Webhook] Dispatch failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Warning "[Webhook] Response details: $($reader.ReadToEnd())"
    }
    # Exit with code 0 to prevent pipeline crash, but output error
    exit 0
}
