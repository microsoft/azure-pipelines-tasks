param(
    [Parameter(Mandatory = $true)]
    [string]$storageAccountName,
    [Parameter(Mandatory = $true)]
    [string]$containerName,
    [Parameter(Mandatory = $true)]
    [string]$sasToken,
    [Parameter(Mandatory = $true)]
    [string]$path
)

$Url = "https://${storageAccountName}.blob.core.windows.net/${containerName}"
$Url += "?$sasToken"
$Url += "&restype=container&comp=list"
$blobsList = Invoke-RestMethod -Uri $Url -Method "GET" 

#utf-8 bom
if (([byte]$blobsList[0] -eq 239) -and ([byte]$blobsList[1] -eq 187) -and ([byte]$blobsList[2] -eq 191)) {
    $blobsList = $blobsList.subString(3);
}
$blobsListXml = [xml]$blobsList

if (-not([string]::IsNullOrEmpty($path))){
    if(-not(Test-Path -PathType Container $path)){
        New-Item -ItemType Directory -Path $path
    }
    Set-Location $path
}

$fixedUrl = $blobsListXml.EnumerationResults.ServiceEndpoint + $blobsListXml.EnumerationResults.ContainerName
foreach ($blob in $blobsListXml.EnumerationResults.Blobs.Blob) {
    $Url = $fixedUrl
    $blobPath = $blob.Name
    $blobDirPath = $blobPath.Replace('/', '\')
    $Url += ("/" + $blobPath)
    $Url += "?$sasToken"
    $blobDir = Split-Path $blobDirPath
    if ((-not([string]::IsNullOrEmpty($blobDir))) -and (-not(Test-Path -PathType Container $blobDir))) {
        New-Item -ItemType Directory -Path $blobDir
    }
    Invoke-RestMethod -Uri $Url -Method "GET" -OutFile $blobDirPath
}