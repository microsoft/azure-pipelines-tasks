param(
    [Parameter(Mandatory = $true)]
    [string]$storageAccountName,
    [Parameter(Mandatory = $true)]
    [string]$containerName,
    <#[Parameter(Mandatory = $true)]
    [string]$signature,#>
    [Parameter(Mandatory = $true)]
    [string]$sasToken,
    [Parameter(Mandatory = $true)]
    [string]$path
)


#$headers = @{"x-ms-version" = "2017-04-17"}
$Url = "https://${storageAccountName}.blob.core.windows.net/${containerName}"
$Url += $sasToken
$Url += "&restype=container&comp=list"
#$xmsdate = (get-date -format r).ToString()
#$headers.Add("x-ms-date", $xmsdate)
#$headers.Add("Authorization", "SharedKey " + $storageAccountName + ":" + $signature)
$blobsList = Invoke-RestMethod -Uri $Url -Method "GET" #-headers $headers

#utf-8 bom
if(([byte]$blobsList[0] -eq 239) -and ([byte]$blobsList[0] -eq 187) -and ([byte]$blobsList[0] -eq 191)){
    $blobsList = $blobsList.subString(3);
}

$blobsListXml = [xml]$blobsList
Set-Location $path
$fixedUrl = $blobsListXml.EnumerationResults.ServiceEndpoint + $blobsListXml.EnumerationResults.ContainerName
foreach($blob in $blobsListXml.EnumerationResults.Blobs.Blob){
    $Url = $fixedUrl
    $blobPath = $blob.Name
    $blobPath = $blobPath.Replace('/', '\')
    $blobFileName = Split-Path $blobPath -Leaf
    $Url += ("/" + $blobFileName)
    $Url += $sasToken
    $blobDir = Split-Path $blobPath
    New-Item -ItemType Directory -Path $blobDir
    $blobContent = Invoke-RestMethod -Uri $Url -Method "GET"
    Set-Content -Path $blobPath -Value $blobContent
}