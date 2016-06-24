$XmlTranformDllPath = "$PSScriptRoot\..\Microsoft.Web.Xdt\Microsoft.Web.XmlTransform.dll"
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

    $tranformFiles = Find-Files -SearchPattern "$xdtFilesRoot\**\$tranformFile"

    if($tranformFiles.Count -eq 0)
    {
        Write-Warning "No tranformation file '$tranformFile' found."
    }
    elseif ($tranformFiles.Count -gt 1)
    {
        throw "More than one transformation file '$tranformFile' found."
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
        throw "Xml Tranform '$tranformFilePath' failed for file '$baseFile'."
    }

    Move-Item -Path $tmpFile -Destination $baseFile -Force
    Write-Verbose "Successfully applied tranformation '$tranformFiles' for '$baseFile'"
}