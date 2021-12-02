
#
# Resource parser for the office .plist files.
# Replaces macheat.dll.
#
# 08/2018
# mailto:jurgen.eidt@microsoft.com?subject=AnyParse
# 

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

# Debug
#
<#
$filePath="D:\MacParsers\Localizable.stringsdict.plist"
$isGenerating = $false

class ParserStub
{
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType)
    {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating)
    { 
        return "!!$resStr!!"
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
    # Get all string nodes that are followed by a key node.
    $stringNodes = $locNode.SelectNodes('key/following-sibling::string[1]|dict/key/following-sibling::string[1]')
    foreach($stringNode in $stringNodes)
    {
        # Add the key/string pair.
        [Xml.XmlNode]$keyNode = $stringNode.PreviousSibling
        $resId = if($id -ne 1) { $id } else { $null }
        $stringNode.InnerXml = $this.SubmitResource($childDbid, 42, "plist", $resId, $keyNode.InnerText, $stringNode.InnerText, "", "", $isGenerating)
    }

    $id++
}

if($isGenerating)
{
    $xml.Save($filePath)
}
