Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$xlsxPath = Join-Path (Get-Location) "Blogs Currently Live.xlsx"
$tempPath = Join-Path (Get-Location) "temp_blogs_copy2.xlsx"

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

$rows = @()
$colHeaders = @{}

# Parse rows
$headerRow = $true
foreach ($row in $sheetXml.worksheet.sheetData.row) {
    $rowCells = @{}
    foreach ($c in $row.c) {
        $colRef = [System.Text.RegularExpressions.Regex]::Replace($c.r, "\d+", "")
        $val = ""
        if ($c.t -eq "s") {
            $strIdx = [int]$c.v
            $val = $strings[$strIdx]
        } elseif ($c.v) {
            $val = $c.v
        }
        $rowCells[$colRef] = $val
    }

    if ($headerRow) {
        $colHeaders = $rowCells
        $headerRow = $false
    } else {
        $rowObj = [ordered]@{}
        foreach ($k in $colHeaders.Keys) {
            $hName = $colHeaders[$k]
            $rowObj[$hName] = $rowCells[$k]
        }
        $rows += (New-Object PSObject -Property $rowObj)
    }
}

Write-Output "Parsed $($rows.Count) blog posts from Excel."
Write-Output "First 5 blogs:"
$rows | Select-Object -First 5 | Format-Table -AutoSize

# Export to clean JSON and CSV
$dataDir = Join-Path (Get-Location) "data"
if (!(Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir }

$jsonOut = Join-Path $dataDir "existing_lawsons_blogs.json"
$rows | ConvertTo-Json -Depth 3 | Set-Content $jsonOut -Encoding UTF8

$csvOut = Join-Path $dataDir "existing_lawsons_blogs.csv"
$rows | Export-Csv -Path $csvOut -NoTypeInformation -Encoding UTF8

Write-Output "Saved to: $jsonOut and $csvOut"
