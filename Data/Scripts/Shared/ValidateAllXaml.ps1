$xamlFiles = Get-ChildItem -Path robot -Filter "*.xaml" -Recurse

$allValid = $true
foreach ($file in $xamlFiles) {
    try {
        $xml = New-Object System.Xml.XmlDocument
        $xml.Load($file.FullName)
        Write-Output "VALID [OK]: $($file.FullName) (Root: $($xml.DocumentElement.Name))"
    } catch {
        Write-Error "INVALID [FAIL]: $($file.FullName) - $($_.Exception.Message)"
        $allValid = $false
    }
}

if ($allValid) {
    Write-Output "ALL XAML FILES ARE 100% VALID XML!"
} else {
    exit 1
}
