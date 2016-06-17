function ApplyTransformation
{
    Param(
        [String][Parameter(mandatory=$true)]
        $baseFile,
        [String][Parameter(mandatory=$true)]
        $tranformFile
    )

    $XmlTranformDllPath = "$PSScriptRoot\Microsoft.Web.Xdt\Microsoft.Web.XmlTransform.dll"
    [Reflection.Assembly]::LoadFile($XmlTranformDllPath)

    $baseDocument = New-Object -TypeName Microsoft.Web.XmlTransform.XmlTransformableDocument
    $baseDocument.PreserveWhitespace = $true
    $baseDocument.Load($baseFile)

    $tranformationDocument = New-Object -TypeName Microsoft.Web.XmlTransform.XmlTransformation -ArgumentList $tranformFile

    $result = $tranformationDocument.Apply($baseDocument)

    $tmpFile = $baseFile + ".tmp"
    $baseDocument.Save($tmpFile)

    if($result -eq $false)
    {
        Throw (Get-VstsLocString -Key "XmlTranform0failedforfile1" -ArgumentList $tranformFile, $baseFile)
    }

    Move-Item -Path $tmpFile -Destination $baseFile -Force -Confirm
    Write-Verbose "Successfully applied tranformation '$tranformFile' for '$baseFile'"
}