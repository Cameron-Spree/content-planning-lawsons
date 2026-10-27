Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$xlsxPath = Join-Path (Get-Location) "Blogs Currently Live.xlsx"
$tempPath = Join-Path (Get-Location) "temp_blogs_copy.xlsx"

$src = [System.IO.File]::Open($xlsxPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$dst = [System.IO.File]::Create($tempPath)
$src.CopyTo($dst)
$src.Close()
$src.Dispose()
$dst.Close()
$dst.Dispose()

$zip = [System.IO.Compression.ZipFile]::OpenRead($tempPath)
$sharedStringsXml = $null
$sheetXml = $null

foreach ($entry in $zip.Entries) {
    if ($entry.FullName -eq "xl/sharedStrings.xml") {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $sharedStringsXml = [xml]$reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
    }
    if ($entry.FullName -eq "xl/worksheets/sheet1.xml") {
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream)
        $sheetXml = [xml]$reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
    }
}
$zip.Dispose()
Remove-Item $tempPath -Force -ErrorAction SilentlyContinue

$strings = @()
if ($sharedStringsXml) {
    foreach ($si in $sharedStringsXml.sst.si) {
        $t = $si.t
        if ($null -eq $t -and $si.r) {
            $t = ($si.r | ForEach-Object { $_.t }) -join ""
        }
        $strings += $t
    }
}

Write-Output "Extracted $($strings.Count) shared strings. Sample first 35:"
$strings | Select-Object -First 35
