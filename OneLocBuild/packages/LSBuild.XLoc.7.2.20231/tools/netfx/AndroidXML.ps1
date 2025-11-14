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

# SIG # Begin signature block
# MIIr5wYJKoZIhvcNAQcCoIIr2DCCK9QCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCB7ouBw04u4+jHS
# M4+B1v8NGqQRJeUU6d9wLGNMdiesj6CCEW4wggh+MIIHZqADAgECAhM2AAACAO38
# jbec3qFIAAIAAAIAMA0GCSqGSIb3DQEBCwUAMEExEzARBgoJkiaJk/IsZAEZFgNH
# QkwxEzARBgoJkiaJk/IsZAEZFgNBTUUxFTATBgNVBAMTDEFNRSBDUyBDQSAwMTAe
# Fw0yNDExMDgxMjQzMjhaFw0yNTExMDgxMjQzMjhaMCQxIjAgBgNVBAMTGU1pY3Jv
# c29mdCBBenVyZSBDb2RlIFNpZ24wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
# AoIBAQC5L/UPrOpwYjxcoZC0TqqvMF1WUELvwXN+k27SrA5rohJknn7Cgbxg4hGT
# XKqpcdbtsVTN3ZY896SJ20uQ+INL5OVLzpW408nCNTPYg2LtGJbqHUjpNm0hLCJ+
# gO5Jn2T8DDzIJoUijGXj1m+hRLKb2nOIicCED2GuYBmuWXnaY7INmVEaU3peryty
# ZjDuxdyGDuiPURz8lW1SUiDzoszNp1oswVr+WjDvLDUx4HlxPsG8zUjIst0NnJ6o
# z4tNFKaUBDCetcMjQxpCETn29a1CuRddxZLjPHZHfcotr5sh1S6bNQdzVaMNsxV8
# L3wjHb7XJ6ZVm662mHEiPgpyNcLhAgMBAAGjggWKMIIFhjApBgkrBgEEAYI3FQoE
# HDAaMAwGCisGAQQBgjdbAQEwCgYIKwYBBQUHAwMwPQYJKwYBBAGCNxUHBDAwLgYm
# KwYBBAGCNxUIhpDjDYTVtHiE8Ys+hZvdFs6dEoFgg93NZoaUjDICAWQCAQ4wggJ2
# BggrBgEFBQcBAQSCAmgwggJkMGIGCCsGAQUFBzAChlZodHRwOi8vY3JsLm1pY3Jv
# c29mdC5jb20vcGtpaW5mcmEvQ2VydHMvQlkyUEtJQ1NDQTAxLkFNRS5HQkxfQU1F
# JTIwQ1MlMjBDQSUyMDAxKDIpLmNydDBSBggrBgEFBQcwAoZGaHR0cDovL2NybDEu
# YW1lLmdibC9haWEvQlkyUEtJQ1NDQTAxLkFNRS5HQkxfQU1FJTIwQ1MlMjBDQSUy
# MDAxKDIpLmNydDBSBggrBgEFBQcwAoZGaHR0cDovL2NybDIuYW1lLmdibC9haWEv
# QlkyUEtJQ1NDQTAxLkFNRS5HQkxfQU1FJTIwQ1MlMjBDQSUyMDAxKDIpLmNydDBS
# BggrBgEFBQcwAoZGaHR0cDovL2NybDMuYW1lLmdibC9haWEvQlkyUEtJQ1NDQTAx
# LkFNRS5HQkxfQU1FJTIwQ1MlMjBDQSUyMDAxKDIpLmNydDBSBggrBgEFBQcwAoZG
# aHR0cDovL2NybDQuYW1lLmdibC9haWEvQlkyUEtJQ1NDQTAxLkFNRS5HQkxfQU1F
# JTIwQ1MlMjBDQSUyMDAxKDIpLmNydDCBrQYIKwYBBQUHMAKGgaBsZGFwOi8vL0NO
# PUFNRSUyMENTJTIwQ0ElMjAwMSxDTj1BSUEsQ049UHVibGljJTIwS2V5JTIwU2Vy
# dmljZXMsQ049U2VydmljZXMsQ049Q29uZmlndXJhdGlvbixEQz1BTUUsREM9R0JM
# P2NBQ2VydGlmaWNhdGU/YmFzZT9vYmplY3RDbGFzcz1jZXJ0aWZpY2F0aW9uQXV0
# aG9yaXR5MB0GA1UdDgQWBBST/HE52ZUlmsYqZcZBdrXZ5u4ZnzAOBgNVHQ8BAf8E
# BAMCB4AwRQYDVR0RBD4wPKQ6MDgxHjAcBgNVBAsTFU1pY3Jvc29mdCBDb3Jwb3Jh
# dGlvbjEWMBQGA1UEBRMNMjM2MTY3KzUwMzE1NTCCAeYGA1UdHwSCAd0wggHZMIIB
# 1aCCAdGgggHNhj9odHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpaW5mcmEvQ1JM
# L0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwxLmFtZS5nYmwv
# Y3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwyLmFtZS5n
# YmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwzLmFt
# ZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmw0
# LmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGgb1sZGFwOi8v
# L0NOPUFNRSUyMENTJTIwQ0ElMjAwMSgyKSxDTj1CWTJQS0lDU0NBMDEsQ049Q0RQ
# LENOPVB1YmxpYyUyMEtleSUyMFNlcnZpY2VzLENOPVNlcnZpY2VzLENOPUNvbmZp
# Z3VyYXRpb24sREM9QU1FLERDPUdCTD9jZXJ0aWZpY2F0ZVJldm9jYXRpb25MaXN0
# P2Jhc2U/b2JqZWN0Q2xhc3M9Y1JMRGlzdHJpYnV0aW9uUG9pbnQwHwYDVR0jBBgw
# FoAUllGE4Gtve/7YBqvD8oXmKa5q+dQwHwYDVR0lBBgwFgYKKwYBBAGCN1sBAQYI
# KwYBBQUHAwMwDQYJKoZIhvcNAQELBQADggEBAEDd8Wf5RkHsB64vgn2slxDtHzSo
# It9xN/Dm3RdFjNZ0diTUPMgSPYQlSk8nIAfudnB9FLavGlvZLlyUpfrPSuikepj3
# i3pqNEFn6fNdNFv/wHMxv7hQTIDCmuoR1v1rX+w3oeleBPMnN3QmH4ff1NsynyV4
# dZdYgN9Cw9sC/S3pWZpJrbOs7YOM3vqyU6DciHhC4D9i2zByHCF2pu9nYfiQf5A2
# iUZenRvyo1E5rC+UP2VZXa4k7g66W20+zAajIKKIqEmRtWahekMkCcOIHFBY4RDA
# ybgPRSGur4VDAiZPjTXS90wQXrX9CwU20cfiCC6e76F4H95KtQjKYpzuNVAwggjo
# MIIG0KADAgECAhMfAAAAUeqP9pxzDKg7AAAAAABRMA0GCSqGSIb3DQEBCwUAMDwx
# EzARBgoJkiaJk/IsZAEZFgNHQkwxEzARBgoJkiaJk/IsZAEZFgNBTUUxEDAOBgNV
# BAMTB2FtZXJvb3QwHhcNMjEwNTIxMTg0NDE0WhcNMjYwNTIxMTg1NDE0WjBBMRMw
# EQYKCZImiZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1FMRUwEwYDVQQD
# EwxBTUUgQ1MgQ0EgMDEwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJ
# mlIJfQGejVbXKpcyFPoFSUllalrinfEV6JMc7i+bZDoL9rNHnHDGfJgeuRIYO1LY
# /1f4oMTrhXbSaYRCS5vGc8145WcTZG908bGDCWr4GFLc411WxA+Pv2rteAcz0eHM
# H36qTQ8L0o3XOb2n+x7KJFLokXV1s6pF/WlSXsUBXGaCIIWBXyEchv+sM9eKDsUO
# LdLTITHYJQNWkiryMSEbxqdQUTVZjEz6eLRLkofDAo8pXirIYOgM770CYOiZrcKH
# K7lYOVblx22pdNawY8Te6a2dfoCaWV1QUuazg5VHiC4p/6fksgEILptOKhx9c+ia
# piNhMrHsAYx9pUtppeaFAgMBAAGjggTcMIIE2DASBgkrBgEEAYI3FQEEBQIDAgAC
# MCMGCSsGAQQBgjcVAgQWBBQSaCRCIUfL1Gu+Mc8gpMALI38/RzAdBgNVHQ4EFgQU
# llGE4Gtve/7YBqvD8oXmKa5q+dQwggEEBgNVHSUEgfwwgfkGBysGAQUCAwUGCCsG
# AQUFBwMBBggrBgEFBQcDAgYKKwYBBAGCNxQCAQYJKwYBBAGCNxUGBgorBgEEAYI3
# CgMMBgkrBgEEAYI3FQYGCCsGAQUFBwMJBggrBgEFBQgCAgYKKwYBBAGCN0ABAQYL
# KwYBBAGCNwoDBAEGCisGAQQBgjcKAwQGCSsGAQQBgjcVBQYKKwYBBAGCNxQCAgYK
# KwYBBAGCNxQCAwYIKwYBBQUHAwMGCisGAQQBgjdbAQEGCisGAQQBgjdbAgEGCisG
# AQQBgjdbAwEGCisGAQQBgjdbBQEGCisGAQQBgjdbBAEGCisGAQQBgjdbBAIwGQYJ
# KwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQDAgGGMBIGA1UdEwEB/wQI
# MAYBAf8CAQAwHwYDVR0jBBgwFoAUKV5RXmSuNLnrrJwNp4x1AdEJCygwggFoBgNV
# HR8EggFfMIIBWzCCAVegggFToIIBT4YxaHR0cDovL2NybC5taWNyb3NvZnQuY29t
# L3BraWluZnJhL2NybC9hbWVyb290LmNybIYjaHR0cDovL2NybDIuYW1lLmdibC9j
# cmwvYW1lcm9vdC5jcmyGI2h0dHA6Ly9jcmwzLmFtZS5nYmwvY3JsL2FtZXJvb3Qu
# Y3JshiNodHRwOi8vY3JsMS5hbWUuZ2JsL2NybC9hbWVyb290LmNybIaBqmxkYXA6
# Ly8vQ049YW1lcm9vdCxDTj1BTUVSb290LENOPUNEUCxDTj1QdWJsaWMlMjBLZXkl
# MjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1cmF0aW9uLERDPUFNRSxE
# Qz1HQkw/Y2VydGlmaWNhdGVSZXZvY2F0aW9uTGlzdD9iYXNlP29iamVjdENsYXNz
# PWNSTERpc3RyaWJ1dGlvblBvaW50MIIBqwYIKwYBBQUHAQEEggGdMIIBmTBHBggr
# BgEFBQcwAoY7aHR0cDovL2NybC5taWNyb3NvZnQuY29tL3BraWluZnJhL2NlcnRz
# L0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUHMAKGK2h0dHA6Ly9jcmwyLmFt
# ZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUHMAKGK2h0dHA6
# Ly9jcmwzLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUH
# MAKGK2h0dHA6Ly9jcmwxLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQw
# gaIGCCsGAQUFBzAChoGVbGRhcDovLy9DTj1hbWVyb290LENOPUFJQSxDTj1QdWJs
# aWMlMjBLZXklMjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1cmF0aW9u
# LERDPUFNRSxEQz1HQkw/Y0FDZXJ0aWZpY2F0ZT9iYXNlP29iamVjdENsYXNzPWNl
# cnRpZmljYXRpb25BdXRob3JpdHkwDQYJKoZIhvcNAQELBQADggIBAFAQI7dPD+jf
# XtGt3vJp2pyzA/HUu8hjKaRpM3opya5G3ocprRd7vdTHb8BDfRN+AD0YEmeDB5HK
# QoG6xHPI5TXuIi5sm/LeADbV3C2q0HQOygS/VT+m1W7a/752hMIn+L4ZuyxVeSBp
# fwf7oQ4YSZPh6+ngZvBHgfBaVz4O9/wcfw91QDZnTgK9zAh9yRKKls2bziPEnxeO
# ZMVNaxyV0v152PY2xjqIafIkUjK6vY9LtVFjJXenVUAmn3WCPWNFC1YTIIHw/mD2
# cTfPy7QA1pT+GPARAKt0bKtq9aCd/Ym0b5tPbpgCiRtzyb7fbNS1dE740re0COE6
# 7YV2wbeo2sXixzvLftH8L7s9xv9wV+G22qyKt6lmKLjFK1yMw4Ni5fMabcgmzRvS
# jAcbqgp3tk4a8emaaH0rz8MuuIP+yrxtREPXSqL/C5bzMzsikuDW9xH10graZzSm
# PjilzpRfRdu20/9UQmC7eVPZ4j1WNa1oqPHfzET3ChIzJ6Q9G3NPCB+7KwX0OQmK
# yv7IDimj8U/GlsHD1z+EF/fYMf8YXG15LamaOAohsw/ywO6SYSreVW+5Y0mzJutn
# BC9Cm9ozj1+/4kqksrlhZgR/CSxhFH3BTweH8gP2FEISRtShDZbuYymynY1un+Ry
# fiK9+iVTLdD1h/SxyxDpZMtimb4CgJQlMYIZzzCCGcsCAQEwWDBBMRMwEQYKCZIm
# iZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1FMRUwEwYDVQQDEwxBTUUg
# Q1MgQ0EgMDECEzYAAAIA7fyNt5zeoUgAAgAAAgAwDQYJYIZIAWUDBAIBBQCgga4w
# GQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisG
# AQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIEyPEqZ4emN4m9+5vae8YP6SGnj4rvB9
# SO9cBPIcaDnLMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8AcwBvAGYA
# dKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEBBQAEggEA
# RJlfVUWyUPOSqikZkUADbwE9kdC5KTTwWt76/6i7QE54nYV8/yMnVhYuzFBoAiM3
# WDvr/VZ4dEPjoXCM/aflMzRPjvKYdm+JEjBFZasR2rjkRPAhF+uP7J3egpdbXM9e
# P7BSaO4JG7LuLVIuGKO5nXEK2NfO5x8QNAHAtYAKu5R2zdj5AQ+5ORhJa3ZIR6dQ
# VPG2Q1Zt2XN1aGi/4ZPm/JYr+cXluEL6WpgK7udoTSGjifhBZujHl2VVQBKQoquQ
# Ld0K2HY6kCSNY8Nj4WZi3p4JAAKbyPLVru0E5kYUjBmit4Gfzno+/XAj7G+4xVMA
# rQzlAz38gi+wqOAGeO8vM6GCF5cwgheTBgorBgEEAYI3AwMBMYIXgzCCF38GCSqG
# SIb3DQEHAqCCF3AwghdsAgEDMQ8wDQYJYIZIAWUDBAIBBQAwggFSBgsqhkiG9w0B
# CRABBKCCAUEEggE9MIIBOQIBAQYKKwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUA
# BCBjHOBdF9EnRzHkRegRKNMjliG+ZA//087AUIPLx2b4+gIGaMLaEIJaGBMyMDI1
# MTAxMzE4NDI0NC40MDZaMASAAgH0oIHRpIHOMIHLMQswCQYDVQQGEwJVUzETMBEG
# A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
# cm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBP
# cGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046OTIwMC0wNUUwLUQ5
# NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2WgghHtMIIH
# IDCCBQigAwIBAgITMwAAAgkIB+D5XIzmVQABAAACCTANBgkqhkiG9w0BAQsFADB8
# MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
# bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1N
# aWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNTAxMzAxOTQyNTVaFw0y
# NjA0MjIxOTQyNTVaMIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
# bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
# aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYD
# VQQLEx5uU2hpZWxkIFRTUyBFU046OTIwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1p
# Y3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2UwggIiMA0GCSqGSIb3DQEBAQUAA4IC
# DwAwggIKAoICAQDClEow9y4M3f1S9z1xtNEETwWL1vEiiw0oD7SXEdv4sdP0xsVy
# idv6I2rmEl8PYs9LcZjzsWOHI7dQkRL28GP3CXcvY0Zq6nWsHY2QamCZFLF2IlRH
# 6BHx2RkN7ZRDKms7BOo4IGBRlCMkUv9N9/twOzAkpWNsM3b/BQxcwhVgsQqtQ8NE
# PUuiR+GV5rdQHUT4pjihZTkJwraliz0ZbYpUTH5Oki3d3Bpx9qiPriB6hhNfGPjl
# 0PIp23D579rpW6ZmPqPT8j12KX7ySZwNuxs3PYvF/w13GsRXkzIbIyLKEPzj9lzm
# mrF2wjvvUrx9AZw7GLSXk28Dn1XSf62hbkFuUGwPFLp3EbRqIVmBZ42wcz5mSIIC
# y3Qs/hwhEYhUndnABgNpD5avALOV7sUfJrHDZXX6f9ggbjIA6j2nhSASIql8F5Ls
# KBw0RPtDuy3j2CPxtTmZozbLK8TMtxDiMCgxTpfg5iYUvyhV4aqaDLwRBsoBRhO/
# +hwybKnYwXxKeeOrsOwQLnaOE5BmFJYWBOFz3d88LBK9QRBgdEH5CLVh7wkgMIeh
# 96cH5+H0xEvmg6t7uztlXX2SV7xdUYPxA3vjjV3EkV7abSHD5HHQZTrd3FqsD/VO
# YACUVBPrxF+kUrZGXxYInZTprYMYEq6UIG1DT4pCVP9DcaCLGIOYEJ1g0wIDAQAB
# o4IBSTCCAUUwHQYDVR0OBBYEFEmL6NHEXTjlvfAvQM21dzMWk8rSMB8GA1UdIwQY
# MBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8GA1UdHwRYMFYwVKBSoFCGTmh0dHA6
# Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUyMFRpbWUt
# U3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBsBggrBgEFBQcBAQRgMF4wXAYIKwYB
# BQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
# cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3J0MAwGA1UdEwEB
# /wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgwDgYDVR0PAQH/BAQDAgeAMA0G
# CSqGSIb3DQEBCwUAA4ICAQBcXnxvODwk4h/jbUBsnFlFtrSuBBZb7wSZfa5lKRMT
# NfNlmaAC4bd7Wo0I5hMxsEJUyupHwh4kD5qkRZczIc0jIABQQ1xDUBa+WTxrp/UA
# qC17ijFCePZKYVjNrHf/Bmjz7FaOI41kxueRhwLNIcQ2gmBqDR5W4TS2htRJYyZA
# s7jfJmbDtTcUOMhEl1OWlx/FnvcQbot5VPzaUwiT6Nie8l6PZjoQsuxiasuSAmxK
# IQdsHnJ5QokqwdyqXi1FZDtETVvbXfDsofzTta4en2qf48hzEZwUvbkz5smt890n
# VAK7kz2crrzN3hpnfFuftp/rXLWTvxPQcfWXiEuIUd2Gg7eR8QtyKtJDU8+PDwEC
# kzoaJjbGCKqx9ESgFJzzrXNwhhX6Rc8g2EU/+63mmqWeCF/kJOFg2eJw7au/abES
# gq3EazyD1VlL+HaX+MBHGzQmHtvOm3Ql4wVTN3Wq8X8bCR68qiF5rFasm4RxF6za
# jZeSHC/qS5336/4aMDqsV6O86RlPPCYGJOPtf2MbKO7XJJeL/UQN0c3uix5RMTo6
# 6dbATxPUFEG5Ph4PHzGjUbEO7D35LuEBiiG8YrlMROkGl3fBQl9bWbgw9CIUQbwq
# 5cTaExlfEpMdSoydJolUTQD5ELKGz1TJahTidd20wlwi5Bk36XImzsH4Ys15iXRf
# AjCCB3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAAABUwDQYJKoZIhvcNAQEL
# BQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMjAwBgNV
# BAMTKU1pY3Jvc29mdCBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDEwMB4X
# DTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIyNVowfDELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
# bXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDk4aZM
# 57RyIQt5osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/bErg4r25PhdgM/9cT8dm
# 95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjoYH1qUoNEt6aORmsHFPPFdvWGUNzB
# RMhxXFExN6AKOG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2Nr41JmTamDu6GnszrYBb
# fowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v3byNpOORj7I5LFGc6XBpDco2LXCO
# Mcg1KL3jtIckw+DJj361VI/c+gVVmG1oO5pGve2krnopN6zL64NF50ZuyjLVwIYw
# XE8s4mKyzbnijYjklqwBSru+cakXW2dg3viSkR4dPf0gz3N9QZpGdc3EXzTdEonW
# /aUgfX782Z5F37ZyL9t9X4C626p+Nuw2TPYrbqgSUei/BQOj0XOmTTd0lBw0gg/w
# EPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlMjgK8QmguEOqEUUbi0b1qGFphAXPK
# Z6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJNmSLW6CmgyFdXzB0kZSU2LlQ+QuJYfM2
# BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzFER1y7435UsSFF5PAPBXbGjfH
# CBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIurQIDAQABo4IB3TCCAdkwEgYJKwYB
# BAGCNxUBBAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS/mTEmr6CkTxGNSnPEP8v
# BO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMFwGA1UdIARVMFMwUQYM
# KwYBBAGCN0yDfQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5Lmh0bTATBgNVHSUEDDAKBggrBgEF
# BQcDCDAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYwDwYD
# VR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+iiXGJo0T2UkFvXzpoYxDBW
# BgNVHR8ETzBNMEugSaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
# bC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcmwwWgYIKwYBBQUH
# AQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtp
# L2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNydDANBgkqhkiG9w0BAQsF
# AAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv6lwUtj5OR2R4sQaTlz0xM7U518Jx
# Nj/aZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6th542DYunKmCVgADsAW+
# iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1bSNU5HhTdSRXud2f8449xvNo32X2
# pFaq95W2KFUn0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnDvBewVIVCs/wMnosZiefw
# C2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU6ZGyqVvfSaN0DLzskYDSPeZKPmY7
# T7uG+jIa2Zb0j/aRAfbOxnT99kxybxCrdTDFNLB62FD+CljdQDzHVG2dY3RILLFO
# Ry3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/HltEAY5aGZFrDZ+kKNxnGSgkujhL
# mm77IVRrakURR6nxt67I6IleT53S0Ex2tVdUCbFpAUR+fKFhbHP+CrvsQWY9af3L
# wUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmNcP7ntdAoGokLjzbaukz5
# m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9JZTmdHRbatGePu1+oDEzfbzL6Xu/OHBE
# 0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNYs6FwZvKhggNQMIICOAIB
# ATCB+aGB0aSBzjCByzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UE
# CxMeblNoaWVsZCBUU1MgRVNOOjkyMDAtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNy
# b3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQB8762rPTQd
# 7InDCQdb1kgFKQkCRKCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
# YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
# Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
# MDEwMA0GCSqGSIb3DQEBCwUAAgUA7JeDfzAiGA8yMDI1MTAxMzEzNTYxNVoYDzIw
# MjUxMDE0MTM1NjE1WjB3MD0GCisGAQQBhFkKBAExLzAtMAoCBQDsl4N/AgEAMAoC
# AQACAg+TAgH/MAcCAQACAhHLMAoCBQDsmNT/AgEAMDYGCisGAQQBhFkKBAIxKDAm
# MAwGCisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcN
# AQELBQADggEBABSxGyFFBnA/q5RMy5vUXpmhSUWnft4hF/DM3z4O5pdpyd8iVEfZ
# g3qR2f613FtvEZ6JxnAoFtOi/BdHlOvhz0bA8ZD7IjRH9kWHTomm6nUqOIoyZ7pG
# 47r6Wn2/WIehFE7TthBCBvmofYLKBsCfR2Aa3wvceSfejqCnhglN/0xoOHm8lqnL
# ZHDUDUbWKuH0+VVe4Amh4tRprVVSv4H70+ukqNBCpjAHWlBgQ5cLK4q8LuwJ4hiN
# ycks461OFzZTHM+DbljuWaRsZfV9sjKhqOM7MDWxTjoGHQ1COP3ZZ7FxYbH8j0qf
# 6lJO5fuyRQD64FXdeoGEWJJ6THQRth1ZaWoxggQNMIIECQIBATCBkzB8MQswCQYD
# VQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
# MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3Nv
# ZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAgkIB+D5XIzmVQABAAACCTANBglg
# hkgBZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqG
# SIb3DQEJBDEiBCAdQZqm89CDglTCY9uuD6CNicPAymXwCYh6i54Z0JdhLjCB+gYL
# KoZIhvcNAQkQAi8xgeowgecwgeQwgb0EIGgbLB7IvfQCLmUOUZhjdUqK8bikfB6Z
# VVdoTjNwhRM+MIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hp
# bmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
# b3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAC
# EzMAAAIJCAfg+VyM5lUAAQAAAgkwIgQgvXEL2/JTJRFzPqUS4Gw91LKTDy8QAnmL
# yele0VPteP0wDQYJKoZIhvcNAQELBQAEggIAFX/gF5rgWee6KUZi0W9MhxLm4pv7
# /yf/uBo49oeBLgDP3rUg3TowUfqJduj1Xb0EyjHMEfZHWCyr0yT1Kfj88XM41UMp
# 6LguusYocjiHa0CElUJzbKhd2ZzXEbOXbX+KlZngwO11DOEVpQC0p1wKtDtRkNWQ
# 3sY9TRZFdOOmBWQ+NMpYuiP06J4cEcLP+AOj55/zYhJdxvQLQosq03aPjS7IQQq3
# Z0nLDeyAoOVoGvaEJ2Wg6YVsEiD7Vo/XmnOjdfr5mqvD9HtkAfH0ag+Lp1jt79n9
# 2J1j7p6hBHe7w2xS2PPYpZ22pnqfUnwI+hQ7iQkKHmWeonFplFstynS01coVrZSg
# pM3K5qhnmCyrB0+OHwHvXwbqQoAwKZIrnjB0SezL8MMQ4twt/jysCXhBSvn6Ay7a
# Px66de0abFR3R+C1MYUg6rZ7NC2k+flJsLEN7Wkt+9YRprFl78mZZeqRSOBmejJu
# dX3VgcaFYrzjxsrqmU4cDdqHa61VEYVpH31g/5PO0mHR9+Q37l5UTA4ES4Ugjy+f
# lYR61+ke33MAoo+jfVmbxFSxuXg8anYpKHuFXPG92rck2ddiv94esvGlDDNrvuvA
# IqXXr3WUshmXO2bwCZTkRqxTzA5mNPWGFX/dkcrxGA96sIc/my6VB5VoeRqe78qI
# 6onatvgMu1D6kAs=
# SIG # End signature block
