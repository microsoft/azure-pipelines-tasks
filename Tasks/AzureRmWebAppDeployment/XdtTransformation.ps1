$XmlTranformDllPath = "$PSScriptRoot\Microsoft.Web.Xdt\Microsoft.Web.XmlTransform.dll"
[Reflection.Assembly]::LoadFile($XmlTranformDllPath)

function FindAndApplyTransformation
{
    Param(
        [String][Parameter(mandatory=$true)]
        $baseFile,
        [String][Parameter(mandatory=$true)]
        $tranformFile,
        [String][Parameter(Mandatory=$true)]
        $xdtFilesRoot
    )

    $tranformFiles = Find-VstsFiles -LegacyPattern "$xdtFilesRoot\**\$tranformFile" -IncludeFiles

    if($tranformFiles.Count -ne 1)
    {
        Throw (Get-VstsLocString -Key "Noormorethanonetranformationfile0found" -ArgumentList $tranformFile)
    }

    $baseDocument = New-Object -TypeName Microsoft.Web.XmlTransform.XmlTransformableDocument
    $baseDocument.PreserveWhitespace = $true
    $baseDocument.Load($baseFile)

    $tranformationDocument = New-Object -TypeName Microsoft.Web.XmlTransform.XmlTransformation -ArgumentList $tranformFiles

    $result = $tranformationDocument.Apply($baseDocument)

    $tmpFile = $baseFile + ".tmp"
    $baseDocument.Save($tmpFile)

    if($result -eq $false)
    {
        Throw (Get-VstsLocString -Key "XmlTranform0failedforfile1" -ArgumentList $tranformFilePath, $baseFile)
    }

    Move-Item -Path $tmpFile -Destination $baseFile -Force
    Write-Verbose "Successfully applied tranformation '$tranformFiles' for '$baseFile'"
}