
$source = 'C:\Users\Abdallah\Downloads\OT_Justification_JUL 2026 (2).docx'
$projectRoot = $PSScriptRoot
$destination = Join-Path $projectRoot 'temp_inspect.docx'
$inStream = [System.IO.File]::Open($source, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
$outStream = [System.IO.File]::Create($destination)
$inStream.CopyTo($outStream)
$inStream.Close()
$outStream.Close()

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($destination)
$entry = $zip.GetEntry('word/document.xml')
$reader = New-Object System.IO.StreamReader($entry.Open())
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()
[System.IO.File]::WriteAllText((Join-Path $projectRoot 'download_doc.xml'), $xml)
