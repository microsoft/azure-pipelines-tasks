<#
.DESCRIPTION
    Resource parser for iOS .plist files.
    Replaces macheat.dll.

.NOTES
    Version 2.1

.SYNOPSIS

.PARAMETER
    Parameters from the AnyParse host.

    [string]$srcFilePath                # Path of the src file. 
    [string]$filePath                   # Path of the file to be read/write. 
    [int]$parentDbid                    # Internal parent id to create content nodes.
    [CultureInfo]$langCultureInfoSrc    # Source language CultureInfo.
    [CultureInfo]$langCultureInfoTgt    # Target language CultureInfo.
    [bool]$isGenerating                 # True if generating the target file.
    [string]$scriptRoot                 # Path of the script.

.LINK
    https://osgwiki.com/wiki/AnyParse

.NOTES
    07/2022
    mailto:jurgen.eidt@microsoft.com?subject=AnyParse
#>

# Debug
#
#
<#
# Default output file gets deleted by the parser.
$filePath = "C:\test\plist\AppIntentVocabulary_multiple.plist"
#$filePath = "C:\test\plist\_Microsoft Excel_Resources_XLPreferencePaneKeywords.plist"
#$filePath = "C:\test\plist\test.plist"
#$filePath = "C:\test\plist\Localizable.stringsdict.plist"
$debugFilePath = "$($filePath).debug.plist"
Copy-Item $filePath -Destination $debugFilePath
$filePath = $debugFilePath
$isGenerating = $true

class ParserStub {
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType) {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating) { 
        Write-Host "Comment='$comment'"
        Write-Host "id='$strResID', text='$resStr'"
        return "[😺 $([char]0x2122) (tm) ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [void]LogInfo([string]$msg) {
        Write-Host "Info: $msg"
    }

    [void]LogWarning([string]$msg) {
        Write-Host "Warning: $msg"
    }

    [void]LogError([string]$msg) {
        Write-Host "Error: $msg"
    }
}

Add-Type @'
    namespace ManagedLSOM
    {
        public class ELSIconType 
        {
            public static int elsIconString = 9;
        }
    }
'@

$this = New-Object ParserStub
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo("ar-SA")
#>

# Reference table to keep track of the resource ids.
[Hashtable]$idtable = @{}

<#
.DESCRIPTION
    Submit item and write the translation as xml text back to the node when generating.
#>
function Submit-Item(
    [int]$childDbid,
    [int]$itemId,
    [Xml.XmlElement]$writeNode,
    [int]$numResID,
    [string]$resId,
    [string]$text
) {
    [string]$translation = $this.SubmitResource($childDbid, $itemId, "plist", $numResID, $resId, $text, "", "", $isGenerating)
    
    if ($isGenerating) {
        try {
            $writeNode.InnerXml = $translation
        }
        catch {
            throw [IO.InvalidDataException] "Invalid translation for resourceID '$resId'`nTranslation: '$translation'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
        }
    }
}

<#
.DESCRIPTION
    Submit item and write the translation back as text to the node when generating.
#>
function Submit-ItemText(
    [int]$childDbid,
    [int]$itemId,
    [Xml.XmlElement]$writeNode,
    [int]$numResID,
    [string]$resId,
    [string]$text
) {
    [string]$translation = $this.SubmitResource($childDbid, $itemId, "plist", $numResID, $resId, $text, "", "", $isGenerating)
    
    if ($isGenerating) {
        try {
            $writeNode.InnerText = $translation
        }
        catch {
            throw [IO.InvalidDataException] "Invalid translation for resourceID '$resId'`nTranslation: '$translation'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
        }
    }
}

<#
.DESCRIPTION
    Returns unique id.
#>
function Get-Id([string]$id) {
    if ($idtable.ContainsKey($id)) {
        $idtable[$id]++
        "$id#$($idtable[$id])"
    }
    else {
        $idtable[$id] = 0
        $id
    }
}

<#
.DESCRIPTION
    Gets the full resource path for the node.
#>
function Get-ResourcePath([Xml.XmlElement]$node) {

    [string]$resPath = ""

    while ($node.ParentNode.Name -ne "plist") {

        if ($node.Name -eq "dict") {
            $node = $node.ParentNode
            [Xml.XmlElement]$keyNode = $node.SelectSingleNode("preceding-sibling::key[1]")

            if ($keyNode) {
                if ($resPath) {
                    $resPath = "$($keyNode.InnerText)/$resPath"
                }
                else {
                    $resPath = $keyNode.InnerText
                }
            }
        }

        $node = $node.ParentNode
    }
    
    Get-Id $resPath
}

# Read the .plist file.
[xml]$xml = New-Object xml
$xml.PreserveWhitespace = $true
$xml.Load($filePath)

# Create the parent '<string>' node.
[int]$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 0, $null, "<string>", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Get all 'dict' nodes with key/string pairs.
[Xml.XmlNodeList]$dictStringNodes = $xml.SelectNodes('//dict[string and not(dict) and not(array)]')
[int]$sequenceItemId = 1

foreach ($dictStringNode in $dictStringNodes) {

    # Get all string nodes that are preceeded by a key node.
    [Xml.XmlNodeList]$stringNodes = $dictStringNode.SelectNodes('key/following-sibling::string[1]')
    foreach ($stringNode in $stringNodes) {

        # Add the key/string pair.
        [Xml.XmlNode]$keyNode = $stringNode.SelectSingleNode("preceding-sibling::key[1]")
           
        if (-not $keyNode.InnerText.StartsWith('NSStringFormat')) {

            # Get the current and previous key text for the resource Id to match the stringdict parser format.       
            [string]$keyNodeInnerText = $keyNode.InnerText

            [Xml.XmlElement]$dictKeyNode = $null
            while (-not $dictKeyNode -and $keyNode) {
                $keyNode = $keyNode.ParentNode
                $dictKeyNode = $keyNode.SelectSingleNode("preceding-sibling::key[1]")
            }
            [string]$stringId = $dictKeyNode.InnerText + '_' + $keyNodeInnerText
            [string]$text = $stringNode.InnerText

            # Submit item and update translation.
            Submit-ItemText $childDbid 42 $stringNode $sequenceItemId $stringId $text
        }
    }

    $sequenceItemId++
}

# Get all 'dict' nodes with array strings.
[Xml.XmlNodeList]$dictArrayStringNodes = $xml.SelectNodes('//dict[array/string]')

foreach ($dictArrayStringNode in $dictArrayStringNodes) {

    [Xml.XmlNodeList]$stringNodes = $dictArrayStringNode.SelectNodes('key/following-sibling::string[1]')
    if ($stringNodes) {

        # Use the full path to build the resource id.
        [string]$resPath = Get-ResourcePath $dictArrayStringNode

        # Add key/string resources.
        foreach ($stringNode in $stringNodes) {
        
            [Xml.XmlNode]$keyNode = $stringNode.SelectSingleNode("preceding-sibling::key[1]")
            [string]$resId = Get-Id "$resPath/$($keyNode.InnerText)"
            [string]$text = $stringNode.InnerXml

            # Submit item and update translation.
            Submit-Item $childDbid 0 $stringNode 0 $resId $text
        }

        # Add array string resources.
        [Xml.XmlElement]$dictKeyNode = $dictArrayStringNode.SelectSingleNode("array/preceding::key[1]")
        if ($dictKeyNode) {

            [string]$dictId = "$resPath/$($dictKeyNode.InnerText)"

            [Xml.XmlNodeList]$arrayStringNodes = $dictArrayStringNode.SelectNodes('array/string')
            [int]$sequenceId = 1

            foreach ($arrayStringNode in $arrayStringNodes) {

                [string]$resId = "$dictId#$sequenceId"
                [string]$text = $arrayStringNode.InnerXml
    
                # Submit item and update translation.
                Submit-Item $childDbid 0 $arrayStringNode 0 $resId $text
                
                $sequenceId++
            }
        }
    }
}

if ($isGenerating) {

    # Save xml.
    $xml.Save($filePath)

    # The .plist format is a customized XML format and must not have an empty internal subset [].
    [string]$docTypeWithBrackets = "<!DOCTYPE plist PUBLIC `"-//Apple//DTD PLIST 1.0//EN`" `"http://www.apple.com/DTDs/PropertyList-1.0.dtd`"[]>"
    [string]$docType = $docTypeWithBrackets.Replace("[]", "")
    
    [Text.UTF8Encoding]$encoding = New-Object System.Text.UTF8Encoding $false
    [string]$doc = (Get-Content -Raw $filePath).replace($docTypeWithBrackets, $docType)
    [IO.File]::WriteAllLines($filePath, $doc, $encoding)
}
