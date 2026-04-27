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
# MIIo2gYJKoZIhvcNAQcCoIIoyzCCKMcCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCB7ouBw04u4+jHS
# M4+B1v8NGqQRJeUU6d9wLGNMdiesj6CCDcMwggatMIIElaADAgECAhMzAAAArn9k
# 1tYsMf4JAAAAAACuMA0GCSqGSIb3DQEBDAUAMGIxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMzAxBgNVBAMTKkF6dXJlIFJTQSBQ
# dWJsaWMgU2VydmljZXMgQ29kZSBTaWduaW5nIFBDQTAeFw0yNTA2MTkxODU1NTha
# Fw0yNjA2MTcxODU1NThaMIGCMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
# Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
# cmF0aW9uMSwwKgYDVQQDEyNBenVyZSBQdWJsaWMgU2VydmljZXMgUlNBIENvZGUg
# U2lnbjCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAIRy9Jav+qjrsKKb
# Vcy2KamcS2PmseebRp/jyYNO0toLB0s0QN8Q99LDDItAglhi0pF/IH1dpgqJQ2vm
# 6A+h4n0sC2AjCQkVF+ScgVMXmf59ZgyMFXrI2hOTih/5dPOCbhW/u55g8cxbKA4R
# oC8EnAvARzfOhptPTF3y2Psavn8wn2zwPOXNzhZl2cNMZkMJguNzoH0mzUKMlUbO
# 8a2pBEj/4Z/vGKGGjlioVX6ci6++K+mYalr+HVECbU9+MFL+iuiX/HE/gMBl0vJf
# M9MMOWVJsb2JX1FYf4gBUINrTfcJEoXPtwCiKE4Ocy28Y4qOel5ulP5mnvt0ndpu
# WHCNNo05gec0BJHWMfK2QimrtAd7Vi2jAkG80DgNtRvuNtunvb79oYo/EGKmvD5U
# Q5JAZoRTGYuuZG5JiyUj8XKhG/4z05iG8UaqnICVdhuOGq9Af1JtubOsY5Pf5seE
# jtpjiPn69FiESN/VwiaFz3hnqaUfzbqzEFPKdDqm6tCcmFXfBwIDAQABo4IBuTCC
# AbUwDgYDVR0PAQH/BAQDAgeAMB8GA1UdJQQYMBYGCCsGAQUFBwMDBgorBgEEAYI3
# WwEBMB0GA1UdDgQWBBS9m3ktbtjEjFmjMaYZvOm3b/H+5DBFBgNVHREEPjA8pDow
# ODEeMBwGA1UECxMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMRYwFAYDVQQFEw00Njk5
# ODErNTA1MjkyMB8GA1UdIwQYMBaAFPEvupEWfN59Uicx9Xr71VhZaTo9MG8GA1Ud
# HwRoMGYwZKBioGCGXmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3Js
# L0F6dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmlu
# ZyUyMFBDQS5jcmwwfAYIKwYBBQUHAQEEcDBuMGwGCCsGAQUFBzAChmBodHRwOi8v
# d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL0F6dXJlJTIwUlNBJTIwUHVi
# bGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmluZyUyMFBDQS5jcnQwDAYDVR0T
# AQH/BAIwADANBgkqhkiG9w0BAQwFAAOCAgEAHqIN6Re5DdV7TxZBAy69e8RGQDSr
# gSl/XnxV9m2FB5nl56PUW/QBZN/Ge47ynj1KWSDzXVTlS6u6jdoy2F18yqC/pjaV
# l9ffmatw5Q27dS+IKpjSlRCYV3PfSGkdxre4B6fq9XNdW6I1rnI0nmsbyiYXHmaN
# YcfKwgg7IK4FzbWxxqywk3TGOibaVfqwwcaHtdb9pqHQJt5zJqjCjFFZg9AWsUNS
# rlymWKM2DKKs9eUKslcE1NmQgU+2IFIkkyheW+RT7UfTFVwnqRTD2o6gB3E24jmE
# C8sYh+3W298veaWNbjMVaO+GCROzOlA1uCoQkSzpb1z/LcJnWGgY4YVy4yAtKSvP
# P0WNHqvxAPC+7mCYALh5plC/lWYQXQMrnqHxSIgh8x0RAK44BRVlkG4sYTkBFfxq
# dWJMDIBatvKql4bBC2ArAkY/CsFf5xIQV4cm841s38TKGBB0Ur4LxvRIL+J2qG6s
# EkKKkeA14LpKkfLEUF3u85iyPZLdTHlpV/jIovLLcu2cDNb86CW6s9OUpjflQ16n
# xydFfOK4iPzYr0PGZAja18Kls2s/qB/nz3e1nfP/OiMwjLQ9yaAZKC164IlqMDaw
# rKb0VpF53lQZcUrNRU0ENt3lgsvitz3ZT5WhSE4nlnA+kiWE0JKERFP+NFGDRwaN
# RD6JgXWZ0huICuowggcOMIIE9qADAgECAhMzAAAAArLEk4h4WezTAAAAAAACMA0G
# CSqGSIb3DQEBDAUAMFsxCzAJBgNVBAYTAlVTMR4wHAYDVQQKExVNaWNyb3NvZnQg
# Q29ycG9yYXRpb24xLDAqBgNVBAMTI01pY3Jvc29mdCBSU0EgU2VydmljZXMgUm9v
# dCBDQSAyMDIxMB4XDTIxMDkwMjE3NDExOVoXDTM2MDkwMjE3NTExOVowYjELMAkG
# A1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEzMDEGA1UE
# AxMqQXp1cmUgUlNBIFB1YmxpYyBTZXJ2aWNlcyBDb2RlIFNpZ25pbmcgUENBMIIC
# IjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEApd39LL3WcWCx5Uk4WB5GFXGt
# xqHKnVgZI3QWk4SARERVvc0P9CAjsjTJ3tcbo4TxWiavkUzG8rxO8ngtzos/0EPP
# YZJrUzQuXMcpfvnv/bgLRmd3NxwDWpCLTT4GaY6vimWbFHNMW/g+F3DzIE8X0YO8
# KWpXwBK+9uK1+NoPt1U84Utvs3t++3+paiAY3l6KzQVcKpUl2Y9llpfaHiIbSi2w
# CF+rzK9KUnRjA7iLkYN4tDBOww3VF/ZQAdAoJRiQWwtJDSaptpFsNmEH7akUv+r9
# zZrqGUcudqljJ/CU0VeQOHAAVYTN/AUcRHahHjZRrJ8322w7+na1aTfcKucd2d0k
# OshnqhDcP42CiX9NHwECBcIgzqx7piUsNOzFHCH1BQOrspWErLnwcYolSrCAhbQT
# ty+XNSXQd+395uEAtnIUOSGh/0LkKrhz/jzpcuNCrSdu4qwU2FBTTK8AFHd6iHDr
# cqmzrpSZrjygTQmao7GbOs++shNhyycHIqV6Ief7jKr5Oz8qu2qRDBBy6KQw+tnB
# cK2xiTExTJSfyCvyh7DbZYN4hAQIAzULP1Nx0lp2ytOgqpdBrZsCf8AAEBjKiA88
# 418a+iNMjcOVgPjZ60xr+A95klq9f7PvHx3/h5gGcn1YVKL2rS/68s4Zzd/IzYpC
# 2rl5VsdfmtXJZzpsnfkCAwEAAaOCAcIwggG+MBAGCSsGAQQBgjcVAQQDAgEAMB0G
# A1UdDgQWBBTxL7qRFnzefVInMfV6+9VYWWk6PTBUBgNVHSAETTBLMEkGBFUdIAAw
# QTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9E
# b2NzL1JlcG9zaXRvcnkuaHRtMBkGCSsGAQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsG
# A1UdDwQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQYMBaAFA4MsWRpvS2x
# 1WsmpkfqVk6Aw+2KMGYGA1UdHwRfMF0wW6BZoFeGVWh0dHA6Ly93d3cubWljcm9z
# b2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUyMFJTQSUyMFNlcnZpY2VzJTIw
# Um9vdCUyMENBJTIwMjAyMS5jcmwwcwYIKwYBBQUHAQEEZzBlMGMGCCsGAQUFBzAC
# hldodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL01pY3Jvc29m
# dCUyMFJTQSUyMFNlcnZpY2VzJTIwUm9vdCUyMENBJTIwMjAyMS5jcnQwDQYJKoZI
# hvcNAQEMBQADggIBAGKfs8wGdeOcgnTH74ue50sNZadnx1mYnXgO5l9Syz92hROE
# sAzhyusdpNsmi6VRQQs13YCc6lf9ni16dQxPeyNgh09jIl8hhY9Gp8jo1vP4lUrt
# FG+faeXkQQwi5ETpQpL1kYFt/TZruxvTgT/sE382GGua1L+1UWN9GutWH3NeS7jm
# upa4LBRPODcSrEpDw4Zu2MFC2r9LJv9yWbkEeyiHdeEydv1Uu/cbV241/3QUvn+j
# zxdngvXyfHWV+TLaeWVjgcgDw8rwBquoBbiIpJMDcQaqfyz/jta1ApP6oQPZhtld
# U5gv4vu9AMKcVvCGADHq5y4zPsB7WuqJuDcCOwLtTkzegD++oAcMoMDeZ0zkPov9
# kR1CBobbQeFQ5JD4KJAPdPIdKJUJ9Uy5O/zciIoKeLctb/be0cLa1s3nuuWExyjK
# MiL4hV3uPuzjUwUFoPAmuZ9ef9gz6VH/lCq87vNYBtuv9dTnfW/eOv+MGKWauq3p
# T9vvLxNfID2djFX2JIwWZxvIiLbGB1wAeHGeldy9y/IVYRPpiImLJ5IlnDAm/yDB
# eIEX5mHQgcCuXopWxsB2wBO4/VMIQGk/KddmaS+IgRY+2e/fXlmNMLuc+g6lKc5V
# o7vBnO2s559m6cjl8HHDuYbWjKhGcANlrCIWxWj0n9wO7XkStEJ8NBGHBKIFMYIa
# bTCCGmkCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVibGljIFNlcnZpY2VzIENv
# ZGUgU2lnbmluZyBQQ0ECEzMAAACuf2TW1iwx/gkAAAAAAK4wDQYJYIZIAWUDBAIB
# BQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIEyPEqZ4emN4m9+5vae8YP6S
# Gnj4rvB9SO9cBPIcaDnLMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAPjJsX/tbz0B9ufCTEtU5S3F8QJgbWnNByWfuXvJdzCcZ4jIN8AIdph3X
# qDjpwOhOoJPgRFFfw66WaO8er2McejjQbEOGRYwkJISYQH4kt01k7oqSp/NfYABb
# Jh4EskE7YHcFyK6LGnNTBbfBKmGB70+cC9rxtdP2ojXdesy8cWRuDrAyJG+F/GQ8
# Iim70OwoiI03T1eBIEFsvrbxcMNI0TpDEgs8x2eH43IYIkYTNRH389Qz0E28SIRb
# ijxKPT/JRohcBnHnZyNqqNVZ/NodbidMq4FtM064kWHgB1QCLjsPG2a5oDDY6miN
# ZMhub3t8svjuEP0OMf0L8onA5iGKdv5o1h/WIiYYlr6h6CekPxIP4XjluTG4ABek
# UE3q7CK90XZtfgxHZjY2QepXob2SLRz8/BpMzX2gzykRlijuDE4/IkAMPgcXb0Zk
# /mh9ObEHE3fm71nl+N3wKPMOL+39Ydi9WZGEdaSGg8YvBntXm9KisAokAn1fa0WK
# ShZTgzJYoYIXlDCCF5AGCisGAQQBgjcDAwExgheAMIIXfAYJKoZIhvcNAQcCoIIX
# bTCCF2kCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEIBJkf4MCLaII
# FUTTdu4CDSseFzGUQhgwHsfokiarKBfzAgZp56/S/CkYEzIwMjYwNDIzMjEwMjI0
# LjA3MVowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjo4OTAwLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEeowggcgMIIFCKADAgEC
# AhMzAAACIkHS9qr/yLX/AAEAAAIiMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk1NloXDTI3MDUxNzE5Mzk1
# NlowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjo4OTAwLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# ALW54om6Qi5SwAAmj8BjkNlGoftuGC/sJYY2UR1tEaghOt0Tpayfns1o27UFN2MF
# sVy/tF+LG17TH4dG9dKqwP5Z5Jf/r/L3ATQzP7FE9MYhjbQrtpANrrw7LNXJR5QL
# KnJkL+Bb/fK079k6dT0fauLvuQk/wAGurLLVTFf86x4SC8eyPzKKRZPQBG2uNZtc
# wcXNI6jmFBx9SYxcqpZbPr43T5TKeEbLWf52hbhZmCkfxjlbuGlKiRaPUz8u7jCL
# ejoPP29Va6RyBQUaMsCXhhmk6FqHse6IL9qVciYxB/wLcDyr/r/WEWh4hkHhQaTL
# DEH85JM5Kwvr7f2kOrMzsKA6l/hXv32Q33jIz25ckjlP9KIDkx0hkiERbT5uHzlG
# oOHlhbf+hq/nhE/HDk4+UfrhBXoomSXQUgSUxWgs2jxRZFBwwPXv3HtYBKMLouxo
# 1nvIrSpwRIiwvXCJCZ19AHFyqsUKkhB+eZAWQ6n0jJdRarNry2anPwTppeD1vV6I
# BPc9VOCs6U+L+FhkJ8/Ff/qMa3I+PLUKLA6YlqaiGZJT/8I4B6d9FPYbYcxFSkJf
# XOz4CYOZ1AzVdFpvhhIAssCUPMYKyAjvuee4mOhcCWIma/s1+u9YBwDkqoJQ5ZDq
# RI+3mvbwx8pdYkmlJe0V5L8yQPMnL+IlFXIdwXL8H4y3AgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQUWQfAagMnllsQSK7wqy2K6ypqjNAwHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBAGIAz6equnAbb23FJe/jaj4KxN7YLhuhpF8WO70lpaQtMfCrumSc040v
# ef5QbfH8HTzcQpeIVisCa6XsFMcIZdTrf/FGxnbCPdmZHQDh32d/2xoIlWbiO49U
# UFqL+iS045gfaP7X7MzvTCg3mieAH+m/LtfwB9jokHhc+9vzRDPt9jl511ufCPOD
# WxmFQ8VttzB5Z4AIg2vOoUrraYx5cqaG258ytqiiAl4ld9ZjfHj+lu5uAQ1Pf6ld
# PrnbTcI8X2R90oTsYoAhFjLfGQFMO8V3x25+M6kKffycrqoyVW2cGMOFZAbQ8zcT
# +jEGzlQGsjqkFiSYge1uOJ8Oq4dP5OFpVXvEdzoiehJzdo3Nfj0kdSBCa68N0yMu
# Rthd4DT/WrkjFKDZT7JxkE68CLe51k8qEDlXM4ON/+5y7+8W1ethxGSYYo3eO6No
# rf/IxmLYm7k0QvchJaivCntGN5mD4kwgrR+iy5WP5gKbmvrgsf8P1AkMCP5d9lo1
# 4V2/3QrkDRBFEY/+mgH3JMhWMReP+4nOnwvgN3jiwCq6oM6Id2QuDF8ryc+qkJJY
# 9n0b5EI+bzmj1wB/EQ22tK47BynIrPGxEJgIv48rj73yiuK30RUn8sugJ4b6MuWP
# QpoPhDLqxl7itYyvVutAuixMFk3AWdfE2MicJYF3SLuKzXJNL/ipMIIHcTCCBVmg
# AwIBAgITMwAAABXF52ueAptJmQAAAAAAFTANBgkqhkiG9w0BAQsFADCBiDELMAkG
# A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQx
# HjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWljcm9z
# b2Z0IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5IDIwMTAwHhcNMjEwOTMwMTgy
# MjI1WhcNMzAwOTMwMTgzMjI1WjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
# aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
# MDCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAOThpkzntHIhC3miy9ck
# eb0O1YLT/e6cBwfSqWxOdcjKNVf2AX9sSuDivbk+F2Az/1xPx2b3lVNxWuJ+Slr+
# uDZnhUYjDLWNE893MsAQGOhgfWpSg0S3po5GawcU88V29YZQ3MFEyHFcUTE3oAo4
# bo3t1w/YJlN8OWECesSq/XJprx2rrPY2vjUmZNqYO7oaezOtgFt+jBAcnVL+tuhi
# JdxqD89d9P6OU8/W7IVWTe/dvI2k45GPsjksUZzpcGkNyjYtcI4xyDUoveO0hyTD
# 4MmPfrVUj9z6BVWYbWg7mka97aSueik3rMvrg0XnRm7KMtXAhjBcTyziYrLNueKN
# iOSWrAFKu75xqRdbZ2De+JKRHh09/SDPc31BmkZ1zcRfNN0Sidb9pSB9fvzZnkXf
# tnIv231fgLrbqn427DZM9ituqBJR6L8FA6PRc6ZNN3SUHDSCD/AQ8rdHGO2n6Jl8
# P0zbr17C89XYcz1DTsEzOUyOArxCaC4Q6oRRRuLRvWoYWmEBc8pnol7XKHYC4jMY
# ctenIPDC+hIK12NvDMk2ZItboKaDIV1fMHSRlJTYuVD5C4lh8zYGNRiER9vcG9H9
# stQcxWv2XFJRXRLbJbqvUAV6bMURHXLvjflSxIUXk8A8FdsaN8cIFRg/eKtFtvUe
# h17aj54WcmnGrnu3tz5q4i6tAgMBAAGjggHdMIIB2TASBgkrBgEEAYI3FQEEBQID
# AQABMCMGCSsGAQQBgjcVAgQWBBQqp1L+ZMSavoKRPEY1Kc8Q/y8E7jAdBgNVHQ4E
# FgQUn6cVXQBeYl2D9OXSZacbUzUZ6XIwXAYDVR0gBFUwUzBRBgwrBgEEAYI3TIN9
# AQEwQTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9w
# cy9Eb2NzL1JlcG9zaXRvcnkuaHRtMBMGA1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsG
# AQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIBhjAPBgNVHRMBAf8EBTAD
# AQH/MB8GA1UdIwQYMBaAFNX2VsuP6KJcYmjRPZSQW9fOmhjEMFYGA1UdHwRPME0w
# S6BJoEeGRWh0dHA6Ly9jcmwubWljcm9zb2Z0LmNvbS9wa2kvY3JsL3Byb2R1Y3Rz
# L01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNybDBaBggrBgEFBQcBAQROMEwwSgYI
# KwYBBQUHMAKGPmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2kvY2VydHMvTWlj
# Um9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0MA0GCSqGSIb3DQEBCwUAA4ICAQCdVX38
# Kq3hLB9nATEkW+Geckv8qW/qXBS2Pk5HZHixBpOXPTEztTnXwnE2P9pkbHzQdTlt
# uw8x5MKP+2zRoZQYIu7pZmc6U03dmLq2HnjYNi6cqYJWAAOwBb6J6Gngugnue99q
# b74py27YP0h1AdkY3m2CDPVtI1TkeFN1JFe53Z/zjj3G82jfZfakVqr3lbYoVSfQ
# JL1AoL8ZthISEV09J+BAljis9/kpicO8F7BUhUKz/AyeixmJ5/ALaoHCgRlCGVJ1
# ijbCHcNhcy4sa3tuPywJeBTpkbKpW99Jo3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP
# 9pEB9s7GdP32THJvEKt1MMU0sHrYUP4KWN1APMdUbZ1jdEgssU5HLcEUBHG/ZPkk
# vnNtyo4JvbMBV0lUZNlz138eW0QBjloZkWsNn6Qo3GcZKCS6OEuabvshVGtqRRFH
# qfG3rsjoiV5PndLQTHa1V1QJsWkBRH58oWFsc/4Ku+xBZj1p/cvBQUl+fpO+y/g7
# 5LcVv7TOPqUxUYS8vwLBgqJ7Fx0ViY1w/ue10CgaiQuPNtq6TPmb/wrpNPgkNWcr
# 4A245oyZ1uEi6vAnQj0llOZ0dFtq0Z4+7X6gMTN9vMvpe784cETRkPHIqzqKOghi
# f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA00wggI1AgEBMIH5oYHRpIHO
# MIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
# UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQL
# ExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxk
# IFRTUyBFU046ODkwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVALvJxdVnHduwOkmSvtW5yCmS
# yjO4oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDtlNDuMCIYDzIwMjYwNDIzMTcxMDA2WhgPMjAyNjA0MjQxNzEw
# MDZaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIFAO2U0O4CAQAwBwIBAAICDhswBwIB
# AAICEtowCgIFAO2WIm4CAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoD
# AqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEAeurm
# yPp8ViShbiFQyIllDGMcHQZKu7PC6D/PJaLY1Cm9acjTala0ZjmYc3MfxaIWPK6y
# HCNdsvo6dlTUvjgZL4fY2mScSmrLodh9fK1xPeC4gnIMgpdbTeewMQQj8ireAu04
# a8r1qT+HASfUbuwOc+rIBOEbI5mKEhrhvfn7ZO16XXCs2LQW+fwzu9MUHv+bsXyd
# AwbGtuCeq96DkGFuFaXoqrfXtGDl3Dep5kIXSJWCBPHyBjmcY3oB5Seh8zTzSJnh
# tqdEbAV/ztEreKFI2Z3ll2187Q7dS76FzdAYGiIpKqqDBde8PvvfByOly0JSPxXl
# ynidxX9sz/jI+oJ3NDGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFBDQSAyMDEwAhMzAAACIkHS9qr/yLX/AAEAAAIiMA0GCWCGSAFlAwQCAQUAoIIB
# SjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIGCn
# rwDsJ25cRwyVpz7avPYoG5R0BtZ5UNEwNwKhSOlrMIH6BgsqhkiG9w0BCRACLzGB
# 6jCB5zCB5DCBvQQgBWBdAQoE58aCM2ySYM6ZtwQg6ccY3AD5BxG58NHkCRMwgZgw
# gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiJB0vaq/8i1
# /wABAAACIjAiBCAc7jx0b/N+U1ruwTY9shYrASYwxbl5w4bA1czIKRI6RTANBgkq
# hkiG9w0BAQsFAASCAgBp+DqRuWVMHJxekbYVfea+SW45TXMi3LVcC5XKiWe1k1Eu
# JQDcrN6WgSF5ZE2fnajT6bwlbzIXAXhXoWIyxP4WBYjRg61dxy7G8Nw1IcqCUFnt
# z2Q8CHRHFmmNuCl63dbEU7jlRWhakImmJVD7d8A94+4HI168Ey5GNf7WJh0Ek91E
# hd85QZkDWJYUoAoyGjbOeVennuj4O3d6/0i0tWcH58HwNMhEo1J+YpGrRghjQ34N
# EEpjozPQCR+6WMWCtgaOhw+alES4i4zoVcL3p6HWLDu4N0AiZpnFPAg1bXen4v1z
# sWqUF4FNI/h6PlZjtvnQJB0g+pmGIjyx6pcVShxnGpsDkasAk/1aa+sXzri80Lee
# XMNEuwl53lL0nhhg4R2mXc7t51T8IXpVHYeNnAUNN4SAWiqB58ZLBZzHNWbPAq2s
# gJz40raSmFEflsv3GEs+l1O+YyYdT18PbL9LWKp2SNWqptnCF2yeB5hwRpd6mlA3
# D9Mdvdl2UzOOGQFbfmD1nAGYRe6ptq3bbUAeKnfDk7x7lbzuNQCqEz55K1IQaTLd
# 9K0W4LaXl8CVRHLxOi7VdDLBDctjEMlFemEjlFkGAchoOfT9ZZ96G5MyM2Cqp7Lr
# Xptw2Rnb8rxyknZuQH4pnuazwQctxAdIB25xnY3GOMqNLROadRWn2S+LhgSC3A==
# SIG # End signature block
