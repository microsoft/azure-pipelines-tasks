
#
# Resource parser for .storyboard files.
#
# 01/2019
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

<#
# Debug
#
$filePath = "$PSScriptRoot\About.storyboard"
$isGenerating = $false
Add-Type -Path "$PSScriptRoot\managedlsom.dll"

class ParserStub
{
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType)
    {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating)
    { 
        Write-Host "id='$strResID', text='$resStr', comment='$comment'"

        # etalsnarT
        [string]$tgt = -join ($resStr[$resStr.Length..0])
        #return $tgt
        return "!!$tgt!!"
    }
}
$this = New-Object ParserStub
$langCultureInfoTgt = New-Object System.Globalization.CultureInfo 1031
#>


# Read the .storyboard file.
[xml]$xml = New-Object xml
$xml.Load($filePath)

# Create the parent 'Strings' node.
$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 10, $null, "Strings", $true, $true, [ManagedLSOM.ELSIconType]::elsIconNone)

# Create the 'StringKeys' sub node.
$childStringKeyDbid = $childDbid
$this.SubmitNode([ref]$childStringKeyDbid, 0, 10, $null, "StringKeys", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Create the 'Title' sub node.
$childTitleDbid = $childDbid
$this.SubmitNode([ref]$childTitleDbid, 0, 10, $null, "Title", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Select all 'string' nodes with 'key="title"' attribute.
$keyNodes = $xml.SelectNodes("//string[@key='title']")
foreach($keyNode in $keyNodes)
{
    # Get optional loc comment.
    [string]$comment = $keyNode.ParentNode.ParentNode.attributedString.fragment.content

    # The parent node contains the id.
    [string]$id = $($keyNode.ParentNode.Attributes['id'].Value)
    $keyNode.InnerText = $this.SubmitResource($childStringKeyDbid, 13, $null, $null, $id, $keyNode.InnerText, $comment, "", $isGenerating)
}

# Select all nodes with 'title' and 'id' attribute.
$titleAttrNodes = $xml.SelectNodes("//*[@title and @id]")
foreach($titleAttrNode in $titleAttrNodes)
{
    # Get optional loc comment.
    [string]$comment = $titleAttrNode.ParentNode.attributedString.fragment.content

    # Get resource Id.
    [string]$id = $($titleAttrNode.Attributes['id'].Value)
    $titleAttrNode.Attributes["title"].Value = $this.SubmitResource($childTitleDbid, 13, $null, $null, $id, $titleAttrNode.Attributes["title"].Value, $comment, "", $isGenerating)
}

if($isGenerating)
{
    $xml.Save($filePath)
}
