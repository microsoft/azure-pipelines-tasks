<#
.DESCRIPTION
    Resource parser for Android .xml files.

.NOTES
    Version 1.5

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

.NOTES
    ParserId=246
#>

#
<#
# Debug
#
# Default output file gets deleted by the parser.
$filePath = "C:\test\android\Android_strings.xml"
$debugFilePath = "$($filePath).debug.xml"
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
$scriptRoot = "."
#>

Add-Type -Path $ScriptRoot/ICUParserLib.dll

# Setup variables.
# Regex for the char limit instruction.
[string]$maxLengthRegex = '\[\s*CHAR.LIMIT\s*=\s*(?<MaxLength>\d+)\s*\]'

# Additional help strings to be added for plural resources.
$androidPluralHelpStrings = @{
    zero  = "NOTE: Leave this value the same as 'other' if the language does not require special treatment for it. When the language requires special treatment of the number 0 (as in Arabic)."
    one   = "NOTE: When the language requires special treatment of numbers like one (as with the number 1 in English and most other languages; in Russian, any number ending in 1 but not ending in 11 is in this class)."       
    two   = "NOTE: When the language requires special treatment of numbers like two (as with 2 in Welsh, or 102 in Slovenian)."
    few   = "NOTE: When the language requires special treatment of small numbers (as with 2, 3, and 4 in Czech; or numbers ending 2, 3, or 4 but not 12, 13, or 14 in Polish)."
    many  = "NOTE: When the language requires special treatment of large numbers (as with numbers ending 11-99 in Maltese)."
    other = "NOTE: When the language does not require special treatment of the given quantity (as with all numbers in Chinese, or 42 in English)."
}

<#
.DESCRIPTION
    Submit item.
    Preserve CDATA structure of the resource.
#>
function Submit-Item(
    [int]$childDbid,
    [System.Xml.XmlDocument]$xml,
    [System.Xml.XmlElement]$readNode,
    [System.Xml.XmlElement]$writeNode,
    [string]$stringId,
    [string]$text,
    [string]$devComment,
    [bool]$isGenerating
) {
    [string]$translation = $this.SubmitResource($childDbid, 42, "XML:Text", 0, $stringId, $text, $devComment, "", $isGenerating)
    
    if ($isGenerating) {

        # Add escaping to single apostrophe.
        # Match ' that is preceeded by a even amount of \
        [string]$escapedText = $translation -replace "(?<=^(?:\\\\)*|[^\\](?:\\\\)*)(?:'|&apos;)", "\'"

        # Log Warning for fixed apostrophe.
        if ($translation -ne $escapedText) {
            $this.LogWarning("The resource with id='$stringId', src='$text' and translation='$translation' contains unescaped apostrophe. Changed translation to '$escapedText'.")
        }

        try {
            # Preserve CDATA structure of the resource.
            # Select CDATA node.
            foreach ($cNode in $readNode.ChildNodes) {
                if ($cNode.NodeType -eq "CDATA") {
                    $writeNode.InnerXml = $xml.CreateCDataSection($escapedText).OuterXml
                    return
                }
            }

            $writeNode.InnerXml = $escapedText
        }
        catch {
            throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$stringId'`nTranslation: '$escapedText'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
        }
    }
}

<#
.DESCRIPTION
    Gets the src item.
#>
function Get-SrcItem([System.Xml.XmlElement]$node) {
    # Support CDATA tags in Android.
    # Select CDATA node.
    foreach ($cNode in $node.ChildNodes) {
        if ($cNode.NodeType -eq "CDATA") {
            return $cNode.InnerText
        }
    }

    $node.InnerXml
}

<#
.DESCRIPTION
    Gets the individual comment for the node.
#>
function Get-IndividualComment([System.Xml.XmlElement]$node) {
    if ($node.NextSibling.NodeType -eq "Comment") {
        return " | " + $node.NextSibling.value.trim()
    }
    elseif ($node.NextSibling.NodeType -eq "Whitespace" -and
        -not ($node.NextSibling.value.Contains("`r") -or $node.NextSibling.value.Contains("`n")) -and
        $node.NextSibling.NextSibling.NodeType -eq "Comment" ) {
        return " | " + $node.NextSibling.NextSibling.value.trim()
    }
    ""
}

<#
.DESCRIPTION
    Gets the comment and converts the optional CHAR_LIMIT to a LocVer instruction.
#>
function Get-Comment([string]$text, [string]$devComment) {
    # Protect content tags.
    [System.Text.RegularExpressions.MatchCollection]$tags = ([regex]::Matches($text, '<.+?>'))

    # Check if CHAR_LIMIT is used.
    [int]$maxLengthValue = -1
    if ($devComment -match $maxLengthRegex) {
        [string]$maxLength = $matches['MaxLength']
        $maxLengthValue = [int]$maxLength
            
        # Add the length of the placeholders to the CHAR_LIMIT value as the new MaxLength instruction. 
        if ($maxLengthValue -gt 0) {
            # Remove CHAR_LIMIT
            $devComment = $devComment -replace $maxLengthRegex, ""

            [int]$tagsLength = $maxLengthValue
            $tags | % { $tagsLength += $_.Length }
            if ($tagsLength -gt 0) {
                $devComment += " {MaxLength=$tagsLength}"
            }
        }
    }

    # Add LocVer Placeholder instructions for the tags.
    $tagsUnique = $tags | Select-Object -unique
    [string]$placeholder = $tagsUnique | % { " {Placeholder=`"$_`"}" }
    $devComment + $placeholder
}

# Read the android .xml file.
[xml]$xml = New-Object xml
$xml.PreserveWhitespace = $true
$xml.Load($filePath)

# Debug: save copy with the default formatting to simplify compare with the generated file.
#$xml.Save($filePath + ".formatted.xml")

# Create the parent '<string>' node.
[int]$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 0, $null, "<string>", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Select all child nodes.
$stringNodes = $xml.SelectNodes("/resources/child::node()")

# Support group comment headers.
[string]$groupComment = ""

# Enumerate each node and get the loc content.
foreach ($stringNode in $stringNodes) {   
    #$this.LogInfo($groupComment)

    # Skip whitespace nodes.
    if ($stringNode.NodeType -eq "Whitespace") {
        continue
    }

    # Add group comment to dev comments.
    # Group comment is defined by a leading line:
    # <!-- group comment1 -->
    # <string name="action_settings">Settings</string>
    if ($stringNode.NodeType -eq "Comment" -and 
        $stringNode.PreviousSibling.NodeType -eq "Whitespace" -and
        ($stringNode.PreviousSibling.value.Contains("`r") -or $stringNode.PreviousSibling.value.Contains("`n"))
    ) {
        $groupComment = $stringNode.value.trim()
        continue
    }

    # Skip nodes with the translatable attribute set to false.
    if ($stringNode."translatable" -eq "false") {
        continue
    }

    if ($stringNode.LocalName -eq "string") {

        # Get resource id from the name attribute.
        [string]$stringId = $stringNode."name"

        # Get source text.
        [string]$text = Get-SrcItem $stringNode

        # Get dev comment.
        [string]$devComment = Get-Comment $text $stringNode."comment"

        if ($groupComment) {
            $devComment += " | " + $groupComment
        }

        # Add individual comment.
        # Individual comment follows directly the content node:
        # <string name="action_manage_accounts">Manage Accounts</string><!-- individual comment -->
        $devComment += Get-IndividualComment $stringNode
    
        # Submit item.
        Submit-Item $childDbid $xml $stringNode $stringNode $stringId $text $devComment $isGenerating
    }
    elseif ($stringNode.LocalName -eq "string-array") {

        # Get resource id from the name attribute.
        [string]$stringId = $stringNode."name"

        # Get dev comment.
        [string]$comment = $stringNode."comment"

        # array ids start with 1
        [int]$arrayId = 1
        foreach ($childNode in $stringNode.SelectNodes("item")) {
            # Compose the item id from the parent id and the array id.
            [string]$itemStringId = "string-array_$($stringId)_$($arrayId)"
            $arrayId++

            # Get item source text.
            [string]$itemText = Get-SrcItem $childNode

            # Get dev comment.
            [string]$devComment = "$($itemStringId). For item: $($itemText)" + (Get-Comment $itemText $comment)

            # Get item dev comment.
            [string]$itemDevComment = $devComment
            [string]$itemComment = $childNode."comment"

            if ($itemComment) {
                $itemDevComment += " | " + $itemComment
            }

            if ($groupComment) {
                $itemDevComment += " | " + $groupComment
            }
    
            # Add individual comment.
            # Individual comment follows directly the content node:
            # <string name="action_manage_accounts">Manage Accounts</string><!-- individual comment -->
            $itemDevComment += Get-IndividualComment $childNode

            # Submit item.
            Submit-Item $childDbid $xml $childNode $childNode $itemStringId $itemText $itemDevComment $isGenerating
        }
    }
    elseif ($stringNode.LocalName -eq "plurals") {

        # Get resource id from the name attribute.
        [string]$stringId = $stringNode."name"

        # Get comment from the comment attribute.
        [string]$comment = $stringNode."comment"

        # Get the node 'other' for the data type.
        [System.Xml.XmlElement]$itemOtherNode = $stringNode.SelectSingleNode("item[@quantity='other']")
        if (-not $itemOtherNode) {
            $this.LogError("The resource with id '$stringId' does not have the required quantity attribute 'other'.")
            return
        }

        # Store the whitespace for the 'other' item to replicate the formatting for the added plurals.
        if ($itemOtherNode.PreviousSibling.NodeType -eq "Whitespace") {
            $itemOtherNodeWS = $itemOtherNode.PreviousSibling.Clone()
        }
        else {
            $itemOtherNodeWS = $null
        }

        # Store the current plurals.
        [System.Collections.Specialized.OrderedDictionary]$pluralMap = New-Object System.Collections.Specialized.OrderedDictionary

        $childNodes = @()
        foreach ($childNode in $stringNode.ChildNodes) {
            # Get resource id from the quantity attribute.
            [string]$quantity = $childNode."quantity"

            # Get item source text.
            if ($childNode.NodeType -eq "Element") {
                [string]$itemText = Get-SrcItem $childNode
                $pluralMap.Add($quantity, $itemText)
            }

            # Keep the plural 'other'.
            if ($isGenerating) {
                if ($childNode.NodeType -eq "Element" -and $quantity -ne "other") {
                    $childNodes += $childNode
                }

                # Skip the parent tag whitespaces.
                if ($childNode -ne $stringNode.FirstChild -and $childNode -ne $stringNode.LastChild -and $childNode.NodeType -eq "Whitespace") {
                    $childNodes += $childNode
                }
            }
        }

        # Clean-up plural nodes and whitespaces.
        foreach ($childNode in $childNodes) {
            [void]($stringNode.RemoveChild($childNode))
        }
    
        # Expand the plural list.
        [System.Globalization.CultureInfo]$language = $null
        if ($isGenerating) {
            $language = $langCultureInfoTgt
        }

        $messageItems = [ICUParserLib.ICUParser]::ExpandPlurals($pluralMap, $language)
        foreach ($messageItem in $messageItems) {
            [string]$text = $messageItem.Text
            [string]$quantity = $messageItem.Plural

            # Compose the item id from the parent id and the array id.
            [string]$itemStringId = "plurals_$($stringId)_$($quantity)"

            # Get dev comment.
            [string]$devComment = Get-Comment $text $comment

            # Compose the item dev comment.
            [string]$helpString = $androidPluralHelpStrings[$quantity]
            [string]$itemDevComment = "Variant of plurals: $stringId. For amount: $quantity. $helpString $devComment"
            
            # Add language specific lock.
            if ($messageItem.Data) {
                $itemDevComment += " (ICU){Locked=$($messageItem.Data)}"
            }

            # Add group comment.
            if ($groupComment) {
                $itemDevComment += " | " + $groupComment
            }
    
            # Add the plural.
            [System.Xml.XmlElement]$newItemNode = $itemOtherNode
            if ($quantity -ne "other") {
                $newItemNode = $xml.CreateElement("item")
                $newItemNode.SetAttribute("quantity", $quantity)
                [void]($stringNode.InsertBefore($newItemNode, $itemOtherNode))

                # Replicate the formatting for the added plurals.
                if ($itemOtherNodeWS) {
                    [void]($stringNode.InsertAfter($itemOtherNodeWS.Clone(), $newItemNode))
                }
            }

            # Submit item.
            Submit-Item $childDbid $xml $itemOtherNode $newItemNode $itemStringId $text $itemDevComment $isGenerating
        }
    }
}

if ($isGenerating) {

    # Remove all non translatable strings.
    $nonTranslatableNodes = $xml.SelectNodes("//string[@translatable='false']")
    foreach ($nonTranslatableNode in $nonTranslatableNodes) {   
        if ($nonTranslatableNode.PreviousSibling.NodeType -eq "Whitespace") {
            [void]($nonTranslatableNode.ParentNode.RemoveChild($nonTranslatableNode.PreviousSibling))
        }
        [void]($nonTranslatableNode.ParentNode.RemoveChild($nonTranslatableNode))
    }
   
    # Save xml as UTF-8 without BOM.
    $encoding = [System.Text.UTF8Encoding]::new($false)
    $writer = [System.IO.StreamWriter]::new($filePath, $false, $encoding)
    $xml.Save($writer)
    $writer.Dispose()
}
