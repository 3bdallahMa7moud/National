
$projectRoot = $PSScriptRoot
$word = New-Object -ComObject Word.Application
$word.Visible = $false
foreach ($name in @('test_pct_fixed', 'test_dxa_auto', 'test_pct_auto')) {
  $doc = $word.Documents.Open((Join-Path $projectRoot "$name.docx"))
  $doc.ExportAsFixedFormat((Join-Path $projectRoot "$name.pdf"), 17)
  $doc.Close($false)
}
$word.Quit()
Write-Host "All test PDFs created"
