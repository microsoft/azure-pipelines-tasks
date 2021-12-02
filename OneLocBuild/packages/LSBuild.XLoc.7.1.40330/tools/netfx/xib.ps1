
#
# Resource parser for the office .xib files.
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
$filePath="D:\test\xib\XL.PreferencePane.AutoComplete.xib"
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

# The parser id for macheat parser dll used to be 17 for xib files. Since we are using the AnyParser.dll and the ParserId 17 is in used, we need to set it here explicitly.
$this.SetParserID(17)

# Read the .xib file.
[xml]$xml = New-Object xml
$xml.Load($filePath)

# Create the parent 'Strings' node.
$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 10, $null, "Strings", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Select all 'string' nodes with 'key="toolTip"' attribute.
$keyNodes = $xml.SelectNodes("//string[@key='toolTip']")
foreach($keyNode in $keyNodes)
{
    [string]$id = "$($keyNode.ParentNode.Attributes['id'].Value).ibShadowedToolTip"
    $keyNode.InnerText = $this.SubmitResource($childDbid, 13, $null, $null, $id, $keyNode.InnerText, "", "", $isGenerating)
}

# Select all nodes with 'toolTip' attribute.
$toolTipNodes = $xml.SelectNodes("//*[@toolTip]")
foreach($toolTipNode in $toolTipNodes)
{
    [string]$id = "$($toolTipNode.Attributes['id'].Value).ibShadowedToolTip"
    $toolTipNode.Attributes["toolTip"].Value = $this.SubmitResource($childDbid, 13, $null, $null, $id, $toolTipNode.Attributes["toolTip"].Value, "", "", $isGenerating)
}

# Select all nodes with 'title' attribute.
$titleNodes = $xml.SelectNodes("//*[@title]")
foreach($titleNode in $titleNodes)
{
    [string]$id = "$($titleNode.Attributes['id'].Value).title"
    $titleNode.Attributes["title"].Value = $this.SubmitResource($childDbid, 13, $null, $null, $id, $titleNode.Attributes["title"].Value, "", "", $isGenerating)
}

if($isGenerating)
{
    $xml.Save($filePath)
}
