
#
# Resource parser for the office .stringsdict files.
# Replaces macheat.dll.
#
# 08/2018
# mailto:jurgen.eidt@microsoft.com?subject=AnyParse
# 
# 12/2018
# mailto:tsutomuat@microsoft.com?subject=stringsdict.ps1

<#
param(
    [string]$filePath
    [int]$parentDbid
    [int]$langIDSrc
    [CultureInfo]$langCultureInfoSrc
    [int]$langIDTgt
    [CultureInfo]$langCultureInfoTgt
    [bool]$isGenerating
    )
#>


<#
# Debug
#
$filePath = "$PSScriptRoot\stringsdict.plist"
$isGenerating = $true
Add-Type -Path $PSScriptRoot\managedlsom.dll

class ParserStub
{
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType)
    {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating)
    { 
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }
}
$this = New-Object ParserStub
#>

# Read the .plist file.
[xml]$xml = New-Object xml
$xml.Load($filePath)

# Select all 'dict' nodes to localize.
$locNodes = $xml.SelectNodes('/plist/dict/dict')

# Create the parent '<string>' node.
$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 0, $null, "<string>", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Enumerate each loc node and get the key/string pairs.
[int]$id = 1

foreach($locNode in $locNodes)
{   
    $devComment = $locNode.'#comment'
    # Get all string nodes that are followed by a key node.
    $stringNodes = $locNode.SelectNodes('dict/key/following-sibling::string[1]')
    foreach($stringNode in $stringNodes)
    {
        # Add the key/string pair.
        [Xml.XmlNode]$keyNode = $stringNode.PreviousSibling
                
        if($keyNode.InnerText.StartsWith('NSStringFormat') -eq $false)
        {            
            $parentPreviousSibling = $keyNode.ParentNode.PreviousSibling.InnerText    
            $keyNodeInnerText = $keyNode.InnerText
            $stringId = $parentPreviousSibling + '_' + $keyNodeInnerText
            $stringNode.InnerXml = $this.SubmitResource($childDbid, 42, "plist", $id, $stringId, $stringNode.InnerText, $devComment, "", $isGenerating)
            $devComment = ''
        }
    }

    $id++
}

if($isGenerating)
{
    $xml.Save($filePath)

    # The .stringsdict format is a customized XML format and must not have empty [].
    [string]$docTypeWithBrackets = "<!DOCTYPE plist PUBLIC `"-//Apple//DTD PLIST 1.0//EN`" `"http://www.apple.com/DTDs/PropertyList-1.0.dtd`"[]>"
    [string]$docType = "<!DOCTYPE plist PUBLIC `"-//Apple//DTD PLIST 1.0//EN`" `"http://www.apple.com/DTDs/PropertyList-1.0.dtd`">"

    (Get-Content $filePath).replace($docTypeWithBrackets, $docType) | Set-Content $filePath -Encoding UTF8
}
