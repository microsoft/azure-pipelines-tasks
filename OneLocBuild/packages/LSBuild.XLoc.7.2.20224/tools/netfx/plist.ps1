<#
.DESCRIPTION
    Resource parser for iOS .plist/.stringsdict files.
    https://en.wikipedia.org/wiki/Property_list
    https://developer.apple.com/documentation/xcode/localizing-strings-that-contain-plurals
    Replaces macheat.dll.

.NOTES
    Version 2.4

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
    02/2023
    mailto:jurgen.eidt@microsoft.com?subject=AnyParse
#>

# Debug
#
#
<#
# Default output file gets deleted by the parser.
$filePath = "C:\test\plist\Localizable.stringsdict"
#$filePath = "C:\test\plist\AppIntentVocabulary_multiple.plist"
#$filePath = "C:\test\plist\_Microsoft Excel_Resources_XLPreferencePaneKeywords.plist"
#$filePath = "C:\test\plist\test.plist"
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

    # Using the error function result in LSBuild retcode 8.
    # Using exception result in LSBuild retcode 8, does not continue processing and does not generate the output file.
    #   throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$stringId'`nTranslation: '$translation'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
    #   LSBuild : Info BT1002 - {"Return code":"8","Return code enum":"CommandExecutedSuccessButWithErrorMessages","Elapsed Time":"..."}
    #
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
$scriptRoot = $PSScriptRoot
#>

Add-Type -Path $scriptRoot/ICUParserLib.dll

# Reference table to keep track of the resource ids.
[Hashtable]$idtable = @{}

<#
.DESCRIPTION
    Submit item and write the translation back to the node when generating.
#>
function Submit-Item(
    [int]$childDbid,
    [int]$itemId,
    [Xml.XmlElement]$writeNode,
    [int]$numId,
    [string]$stringId,
    [string]$text,
    [string]$devComment
) {
    [string]$translation = $this.SubmitResource($childDbid, $itemId, "plist", $numId, $stringId, $text, $devComment, "", $isGenerating)
    
    if ($isGenerating) {
        try {
            # Convert entities.
            $writeNode.InnerText = $translation.Replace("&amp;", "&").Replace("&lt;", "<").Replace("&gt;", ">").Replace("&quot;", "`"").Replace("&apos;", "'")
        }
        catch {
            throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$stringId'`nTranslation: '$translation'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
        }
    }
}

<#
.DESCRIPTION
    Return unique id.
#>
function Get-Id([string]$id) {
    if ($idtable.ContainsKey($id)) {
        [int]$seq = ++$idtable[$id]
        "$id#$($seq)"
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
function Get-ResourcePath([Xml.XmlElement]$node, [bool]$makeUnique = $true) {

    [string]$resPath = ""

    while ($node.ParentNode.Name -ne "plist") {

        if ($node.Name -eq "dict") {
            $node = $node.ParentNode
            [Xml.XmlElement]$keyNode = $node.SelectSingleNode("preceding-sibling::key[1]")

            if ($keyNode) {
                $resPath = if ($resPath) {
                    "$($keyNode.InnerText)/$resPath"
                }
                else {
                    $keyNode.InnerText
                }
            }
        }

        $node = $node.ParentNode
    }
    
    if ($makeUnique) {
        # Return unique id.
        Get-Id $resPath
    }
    else {
        $resPath
    }
}

# Read the .plist/.stringsdict file.
[xml]$xml = [xml]::new()
$xml.PreserveWhitespace = $true
$xml.Load($filePath)

# Create the parent '<string>' node.
[int]$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 0, $null, "<string>", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Get all 'dict' nodes with key/string pairs.
[Xml.XmlNodeList]$dictStringNodes = $xml.SelectNodes('//dict[string and not(array)]')
[int]$sequenceItemId = 1

foreach ($dictStringNode in $dictStringNodes) {

    # Query for plural node.
    [Xml.XmlNode]$pluralTypeNode = $dictStringNode.SelectSingleNode("string[.='NSStringPluralRuleType']")
    [Xml.XmlNode]$pluralOtherNode = $dictStringNode.SelectSingleNode("key[.='other']")

    # Check if plural node is valid.
    if ($pluralTypeNode -and -not $pluralOtherNode) {

        [string]$key = Get-ResourcePath $pluralTypeNode $false
        $this.LogError("The plural resource with the key '$key' does not have the required plural attribute 'other'.")
        return
    }

    if ($pluralTypeNode) {

        # Store the whitespace for the type 'other' item to match the formatting for the added plurals.
        if ($pluralOtherNode.PreviousSibling.NodeType -eq "Whitespace") {
            $itemOtherNodeWS = $pluralOtherNode.PreviousSibling.Clone()
        }
        else {
            $itemOtherNodeWS = $null
        }

        # Store the current plurals.
        [System.Collections.Specialized.OrderedDictionary]$pluralMap = [System.Collections.Specialized.OrderedDictionary]::new()

        $childNodes = @()

        # Get all plural format elements.
        foreach ($childNode in $dictStringNode.SelectNodes("key[not(starts-with(text(),'NSStringFormat'))]")) {
            
            # Get the matching string node.
            [Xml.XmlNode]$stringNode = $childNode.SelectSingleNode("following-sibling::string[1]")
            [string]$plural = $childNode.InnerText

            # Store the plural.
            if ($stringNode) {
                $pluralMap.Add($plural, $stringNode.InnerText)
            }

            # Keep the plural type 'other'.
            if ($isGenerating) {
                if ($plural -ne "other") {
                    $childNodes += $childNode
                }
            }
        }

        # Clean-up plural nodes and whitespaces.
        foreach ($childNode in $childNodes) {

            [Xml.XmlElement]$childStringNode = $childNode.SelectSingleNode("following-sibling::string[1]")
            if ($childNode.PreviousSibling.NodeType -eq "Whitespace") {
                [void]($dictStringNode.RemoveChild($childNode.PreviousSibling))
            }
            
            [void]($dictStringNode.RemoveChild($childNode))
            
            if ($childStringNode.PreviousSibling.NodeType -eq "Whitespace") {
                [void]($dictStringNode.RemoveChild($childStringNode.PreviousSibling))
            }
            
            [void]($dictStringNode.RemoveChild($childStringNode))
        }
    
        # Expand the plural list.
        [System.Globalization.CultureInfo]$language = $null
        if ($isGenerating) {
            $language = $langCultureInfoTgt
        }

        # Get the group id for the set.
        # No unique id needed ($false) as each block is identified with the sequenceItemId.
        [string]$groupid = Get-ResourcePath $dictStringNode $false

        $messageItems = [ICUParserLib.ICUParser]::ExpandPlurals($pluralMap, $language)
        foreach ($messageItem in $messageItems) {
            [string]$text = $messageItem.Text
            [string]$plural = $messageItem.Plural

            # Compose the item id from the key node and the plural.
            [Xml.XmlElement]$dictKeyNode = $pluralTypeNode.ParentNode.SelectSingleNode("preceding-sibling::key[1]")
            [string]$itemStringId = $dictKeyNode.InnerText + '_' + $plural

            # Setup the comment.
            [string]$devComment = ""
            if ($messageItem.Plural) {
                # Add comment for the plural.
                $devComment += " [Add language specific translation for the plural selector '$($messageItem.Plural)' for format key '$groupid'.]"
            }

            # Add language specific lock.
            if ($messageItem.Data) {
                $devComment += " {Locked=$($messageItem.Data)}"
            }

            # Add the plurals.
            [Xml.XmlElement]$newStringNode = $null

            if ($plural -eq "other") {

                # Add the plural type 'other'.
                $newStringNode = $pluralOtherNode.SelectSingleNode("following-sibling::string[1]")
            
            }
            else {
            
                # Add the plurals except type 'other'.
                [Xml.XmlElement]$newKeyNode = $xml.CreateElement("key")
                $newKeyNode.InnerText = $plural
                [void]($dictStringNode.InsertBefore($newKeyNode, $pluralOtherNode))

                # Replicate the formatting.
                if ($itemOtherNodeWS) {
                    [void]($dictStringNode.InsertAfter($itemOtherNodeWS.Clone(), $newKeyNode))
                }

                $newStringNode = $xml.CreateElement("string")
                [void]($dictStringNode.InsertBefore($newStringNode, $pluralOtherNode))

                # Replicate the formatting.
                if ($itemOtherNodeWS) {
                    [void]($dictStringNode.InsertAfter($itemOtherNodeWS.Clone(), $newStringNode))
                }

            }

            # Submit item and update translation.
            Submit-Item $childDbid 42 $newStringNode $sequenceItemId $itemStringId $text $devComment
        }
    }
    else {

        # Get all string nodes that are preceeded by a key node.
        [Xml.XmlNodeList]$stringNodes = $dictStringNode.SelectNodes('key/following-sibling::string[1]')
        
        foreach ($stringNode in $stringNodes) {

            # Add the key/string pair.
            [Xml.XmlNode]$keyNode = $stringNode.SelectSingleNode("preceding-sibling::key[1]")
            [Xml.XmlNode]$dictNode = $keyNode.ParentNode.SelectSingleNode("dict")

            # Keep previous sequence item id to align the embedded dict tags.
            if ($keyNode.InnerText -eq "NSStringLocalizedFormatKey" -and $dictNode) {
                $sequenceItemId--
            }

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
                [string]$devComment = ""

                # Submit item and update translation.
                Submit-Item $childDbid 42 $stringNode $sequenceItemId $stringId $text $devComment
            }
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
            [string]$text = $stringNode.InnerText
            [string]$devComment = ""

            # Submit item and update translation.
            Submit-Item $childDbid 0 $stringNode 0 $resId $text $devComment
        }

        # Add array string resources.
        [Xml.XmlElement]$dictKeyNode = $dictArrayStringNode.SelectSingleNode("array/preceding::key[1]")
        if ($dictKeyNode) {

            [string]$dictId = "$resPath/$($dictKeyNode.InnerText)"

            [Xml.XmlNodeList]$arrayStringNodes = $dictArrayStringNode.SelectNodes('array/string')
            [int]$sequenceId = 1

            foreach ($arrayStringNode in $arrayStringNodes) {

                [string]$resId = "$dictId#$sequenceId"
                [string]$text = $arrayStringNode.InnerText
                [string]$devComment = ""
    
                # Submit item and update translation.
                Submit-Item $childDbid 0 $arrayStringNode 0 $resId $text $devComment
                
                $sequenceId++
            }
        }
    }
}

if ($isGenerating) {

    # Save .plist/.stringsdict file.
    $xml.Save($filePath)

    # The .plist/.stringsdict format is a customized XML format and must not have an empty internal subset [].
    [string]$docTypeWithBrackets = "<!DOCTYPE plist PUBLIC `"-//Apple//DTD PLIST 1.0//EN`" `"http://www.apple.com/DTDs/PropertyList-1.0.dtd`"[]>"
    [string]$docType = $docTypeWithBrackets.Replace("[]", "")
    
    [Text.UTF8Encoding]$encoding = New-Object System.Text.UTF8Encoding $false
    [string]$doc = (Get-Content -Raw $filePath).replace($docTypeWithBrackets, $docType)
    [IO.File]::WriteAllLines($filePath, $doc, $encoding)
}
