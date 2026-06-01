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
# MIIpBQYJKoZIhvcNAQcCoIIo9jCCKPICAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCB7ouBw04u4+jHS
# M4+B1v8NGqQRJeUU6d9wLGNMdiesj6CCDdIwgga8MIIEpKADAgECAhMzAAAA0ths
# RrGdxrKgAAAAAADSMA0GCSqGSIb3DQEBDAUAMGIxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMzAxBgNVBAMTKkF6dXJlIFJTQSBQ
# dWJsaWMgU2VydmljZXMgQ29kZSBTaWduaW5nIFBDQTAeFw0yNjAzMDUxOTA2MTha
# Fw0yNzAzMDMxOTA2MThaMIGCMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
# Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
# cmF0aW9uMSwwKgYDVQQDEyNBenVyZSBQdWJsaWMgU2VydmljZXMgUlNBIENvZGUg
# U2lnbjCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBALNYpkb0/u3SEoGK
# Z4J4ym26Y4+rAdnOymK+3yjwP7qZLQvVbNCMS+sC1Ji/NAgwlcNYB/si1sbYzE88
# 5U+0c1BoDz6av0Z02Cxv1skzaErjLg/V6UaEYZfw2KZ9Blb1N5IBmxh7Q59GMx3A
# imG7KOHyRsBHLf+acOWJcJ0aPS7UW3WrDzv5tPoWVnw+/47KRRb9YAzbyvnqq7UL
# mqbpfHku9EHHOT6Lgr4y7XvI3cAuVp3nD2560YFrdYrV43x+0J3YrRJXQDOk9Vy5
# Zu5iGF2J8xa2u2DivumBbFAMG7qBKJxdG3ugEVjnqKUvE2rOz5SuFOoqrW1pLDWo
# LezQrPLEQL8HPb44WOd9t5lDEXZ0wnWvZXATmdbrm5yRd6nCCh+wqCzzTqNOS3gG
# vwp3Q8DCYL2oXhPF6t4KWzaAhCa8AnGQAJmcJtcYmntdnpezD6fKRDOmKi92U0vB
# Ob/POQNBLCzvP7ubqNkQHd3uGI6qy7PjswR+ZQmqW46KgMPp3wIDAQABo4IByDCC
# AcQwDgYDVR0PAQH/BAQDAgeAMB8GA1UdJQQYMBYGCCsGAQUFBwMDBgorBgEEAYI3
# WwEBMB0GA1UdDgQWBBRipXg1H4MnCFC0cApmoyjgewxpGTBUBgNVHREETTBLpEkw
# RzEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVk
# MRYwFAYDVQQFEw00Njk5ODErNTA3MTg3MB8GA1UdIwQYMBaAFPEvupEWfN59Uicx
# 9Xr71VhZaTo9MG8GA1UdHwRoMGYwZKBioGCGXmh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY3JsL0F6dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMl
# MjBDb2RlJTIwU2lnbmluZyUyMFBDQS5jcmwwfAYIKwYBBQUHAQEEcDBuMGwGCCsG
# AQUFBzAChmBodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL0F6
# dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmluZyUy
# MFBDQS5jcnQwDAYDVR0TAQH/BAIwADANBgkqhkiG9w0BAQwFAAOCAgEAowxRfRhV
# RQJOoTnTGGX0+TSFF+QsPXh4h29z79zDCAqzaZEMwbrr90ZujKGWPWmiBWye+HQH
# KomgVBg/9urNAiBclkzvvzFFDdvlETNT7qwQV2cMF1Z7aVPdKgRkPiA8ZyqPoFnD
# /V0kMt56e/2FQipkwYTbwhnHboIhVeiJ5Sr0GPr1nSejRvO7PHbRDA6pnrKGJRP1
# S07NIXnlPcMmXHcI4Rh9BA86ia+PZXqUhWm6be/s4VKMbNMloJxj8kpioMetwMJ2
# Zq7fMCIIyQ0mTk2ayDkE+N6zswwv9wL7p9Kz4vc3VzyKUa1juCG6U2cGcm/5Rm4P
# uKDmAA0uTjAr8jljYG3EC02jCzKe2Fv1OdyTmdgnqLcfJZRzbhO5dcAX750b4fxh
# 6zXq8kseoflvbHLBUl6UsWlg6PuS8ZPyMkVkpQAl7Vz/8PWsGQBj4FPf2aQAR3zU
# Hn2lMc7BVL25XFzAZrfIRevKFZuHjiotAT2R+HxvKmra8t5JhlBfmSfcvHLOT5bj
# UyZptkdK7ZFfu97bTUGSSka6rw8vsh1BPy5trpaq/s97CLPgexR9zSX4+FxeB+fU
# CsmJRbVLDD3awsWTsLRQK58yO3G/EzCR8lx51lZV6V7bU7M4RdLMV/k6Q+Dqd7sk
# 69l4liYJoUhMkT72FrpNKz5NzM/rUVHv6m0wggcOMIIE9qADAgECAhMzAAAAArLE
# k4h4WezTAAAAAAACMA0GCSqGSIb3DQEBDAUAMFsxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLDAqBgNVBAMTI01pY3Jvc29mdCBS
# U0EgU2VydmljZXMgUm9vdCBDQSAyMDIxMB4XDTIxMDkwMjE3NDExOVoXDTM2MDkw
# MjE3NTExOVowYjELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
# b3JhdGlvbjEzMDEGA1UEAxMqQXp1cmUgUlNBIFB1YmxpYyBTZXJ2aWNlcyBDb2Rl
# IFNpZ25pbmcgUENBMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEApd39
# LL3WcWCx5Uk4WB5GFXGtxqHKnVgZI3QWk4SARERVvc0P9CAjsjTJ3tcbo4TxWiav
# kUzG8rxO8ngtzos/0EPPYZJrUzQuXMcpfvnv/bgLRmd3NxwDWpCLTT4GaY6vimWb
# FHNMW/g+F3DzIE8X0YO8KWpXwBK+9uK1+NoPt1U84Utvs3t++3+paiAY3l6KzQVc
# KpUl2Y9llpfaHiIbSi2wCF+rzK9KUnRjA7iLkYN4tDBOww3VF/ZQAdAoJRiQWwtJ
# DSaptpFsNmEH7akUv+r9zZrqGUcudqljJ/CU0VeQOHAAVYTN/AUcRHahHjZRrJ83
# 22w7+na1aTfcKucd2d0kOshnqhDcP42CiX9NHwECBcIgzqx7piUsNOzFHCH1BQOr
# spWErLnwcYolSrCAhbQTty+XNSXQd+395uEAtnIUOSGh/0LkKrhz/jzpcuNCrSdu
# 4qwU2FBTTK8AFHd6iHDrcqmzrpSZrjygTQmao7GbOs++shNhyycHIqV6Ief7jKr5
# Oz8qu2qRDBBy6KQw+tnBcK2xiTExTJSfyCvyh7DbZYN4hAQIAzULP1Nx0lp2ytOg
# qpdBrZsCf8AAEBjKiA88418a+iNMjcOVgPjZ60xr+A95klq9f7PvHx3/h5gGcn1Y
# VKL2rS/68s4Zzd/IzYpC2rl5VsdfmtXJZzpsnfkCAwEAAaOCAcIwggG+MBAGCSsG
# AQQBgjcVAQQDAgEAMB0GA1UdDgQWBBTxL7qRFnzefVInMfV6+9VYWWk6PTBUBgNV
# HSAETTBLMEkGBFUdIAAwQTA/BggrBgEFBQcCARYzaHR0cDovL3d3dy5taWNyb3Nv
# ZnQuY29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRtMBkGCSsGAQQBgjcUAgQM
# HgoAUwB1AGIAQwBBMAsGA1UdDwQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB8GA1Ud
# IwQYMBaAFA4MsWRpvS2x1WsmpkfqVk6Aw+2KMGYGA1UdHwRfMF0wW6BZoFeGVWh0
# dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUyMFJT
# QSUyMFNlcnZpY2VzJTIwUm9vdCUyMENBJTIwMjAyMS5jcmwwcwYIKwYBBQUHAQEE
# ZzBlMGMGCCsGAQUFBzAChldodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
# L2NlcnRzL01pY3Jvc29mdCUyMFJTQSUyMFNlcnZpY2VzJTIwUm9vdCUyMENBJTIw
# MjAyMS5jcnQwDQYJKoZIhvcNAQEMBQADggIBAGKfs8wGdeOcgnTH74ue50sNZadn
# x1mYnXgO5l9Syz92hROEsAzhyusdpNsmi6VRQQs13YCc6lf9ni16dQxPeyNgh09j
# Il8hhY9Gp8jo1vP4lUrtFG+faeXkQQwi5ETpQpL1kYFt/TZruxvTgT/sE382GGua
# 1L+1UWN9GutWH3NeS7jmupa4LBRPODcSrEpDw4Zu2MFC2r9LJv9yWbkEeyiHdeEy
# dv1Uu/cbV241/3QUvn+jzxdngvXyfHWV+TLaeWVjgcgDw8rwBquoBbiIpJMDcQaq
# fyz/jta1ApP6oQPZhtldU5gv4vu9AMKcVvCGADHq5y4zPsB7WuqJuDcCOwLtTkze
# gD++oAcMoMDeZ0zkPov9kR1CBobbQeFQ5JD4KJAPdPIdKJUJ9Uy5O/zciIoKeLct
# b/be0cLa1s3nuuWExyjKMiL4hV3uPuzjUwUFoPAmuZ9ef9gz6VH/lCq87vNYBtuv
# 9dTnfW/eOv+MGKWauq3pT9vvLxNfID2djFX2JIwWZxvIiLbGB1wAeHGeldy9y/IV
# YRPpiImLJ5IlnDAm/yDBeIEX5mHQgcCuXopWxsB2wBO4/VMIQGk/KddmaS+IgRY+
# 2e/fXlmNMLuc+g6lKc5Vo7vBnO2s559m6cjl8HHDuYbWjKhGcANlrCIWxWj0n9wO
# 7XkStEJ8NBGHBKIFMYIaiTCCGoUCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UE
# ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVi
# bGljIFNlcnZpY2VzIENvZGUgU2lnbmluZyBQQ0ECEzMAAADS2GxGsZ3GsqAAAAAA
# ANIwDQYJYIZIAWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQw
# HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIEyP
# EqZ4emN4m9+5vae8YP6SGnj4rvB9SO9cBPIcaDnLMEIGCisGAQQBgjcCAQwxNDAy
# oBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
# b20wDQYJKoZIhvcNAQEBBQAEggGAmzdrqNhdflEMFW8uXwQkgIOF0ttC9EAsT7UW
# 1ywQs5cWNodNeAu3DFR6iWag5B+cEvPufMz3wu66YcrxjeR3wcGkQ7mfS1U8P70x
# zcRm6r9xLAZjQO1eYjR6/sKWBy9R89tYA1pzIjzamXnPQb/771tn9enyaskw57TP
# 32Im2RwsulJ7UAB4aEKG7GnY4LdDVC0Qx8IXdYM7bcTeS0JikD/7f5tKQkLX9OMo
# vMGIsWmFYgh2W5gsprfeQ5QQfj9qwoPkKyMDdq8a2PjV2T3W+swl2pxpInja2WQW
# K62bWZNPQ/eS7RffyQn+rW5dCvfGoIwtb2bVWgN9HXFDnjtjqotCUZJX2rVFATMR
# /KTTBqN+xXQehzZwKI5W7QXl/ml4JFL8CC02K0Q1yVy5azcmjhNogHsiVNPiVJSp
# 60vmeh+vMvoPTpNobvwaC2j+nXPuIBpTFseK1FnTQh0qpjKfodJ2h8dsW6qa1Ipc
# s7IRAaIgHC3jtVyNRBsJnfZRRYTyoYIXsDCCF6wGCisGAQQBgjcDAwExghecMIIX
# mAYJKoZIhvcNAQcCoIIXiTCCF4UCAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqG
# SIb3DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUD
# BAIBBQAEIFXkHc8pWjm+ft125DoULQI7aYLDXwewnfwztDhv2VIzAgZp607JywMY
# EzIwMjYwNTIwMTgzNTE5LjcxM1owBIACAfSggdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjZCMDUtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloIIR/jCCBygwggUQoAMCAQICEzMAAAIRRRg5m0PP/GwAAQAAAhEwDQYJ
# KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUw
# ODE0MTg0ODEzWhcNMjYxMTEzMTg0ODEzWjCB0zELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3Bl
# cmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046NkIwNS0w
# NUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Uw
# ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDPubszEB0vlVrKuTuOwyjc
# aeE3zmS0cJkS8RyPgEhxwcp380oLu4++lfl2E7rdbpUzmILGSUbypB5VWs9oq+Px
# 1hgkLsM23g03deVV0L++i94m48+FMn+7tf6liZXap6FNU844HX+Gma3nVLODFlzM
# x2cWX5fZ7U+C61IDkICH39fPk1bQLGdhXPyDRWnGD4GrfZqaS1FevybcFISBSzyO
# BZE9XM8cRzOluGWgYYR8dpE6YeFUoio34mEzB4SNTY1czZbqGbfaP9Af8j8pao01
# 9hyEdobTEmWNVNihQo+lxAO6Ef11AoSC8bGPZTn/cWrV6bh07oiHTibpH623Gvpj
# yhEkf1mFnexyIUEi9mHsTZgVc6M/gwbJtLKVBM8MQUC0ceCmSyR4RSGw8NH1W9Za
# F6SFDHepdoAqH4CQubP+GkTd7TL5Ego7YBESNQskAqB/5H1Cc2+ox4yTP08auOyK
# OpYbMHaTYk3JpRgqVuZDB45puwKKiJjZ8luKaNXIUAaTkB5h11QXG8kaBFUIfsF4
# E8oCrsww6ZIJM4xnRLDrPI3HhSGHljS4nRk6hMqcHcp9039tr94ocV4SGLdaoB/N
# PGLLSsy+Gx+xdkrvOhyWppG9WXxDjwnXvj57KuLKlj0eFT6iGCJiLi5AYMNV1MN4
# oO2gL+EPYKf4BHPATWsV8QIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFGJ9RQPA6eoh
# y99vnf7JXQRmfs5wMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
# A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y3JsL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
# BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
# MDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUH
# AwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQCkQp2cx4ghSJTo
# 9q1n+puvCIPNhQwpFzMLgGn9djVL02Ycj7Zzd1ynAfZI6YN928giq3uZGuC8E9g6
# 8n0K1lLl54iuw5sLRvSCApO/bCtOBYb6qS2o0USFB6Kl1RE0s3ry4cCbl53AHK13
# WTDLmvoH3eSXEOyV06ZVa3D+eCPuSc3T2a4KbCvXsmewwVygg38fn2z7VFg3tWJ3
# j7uePwVy9jL2ttk4yd0HOxOKiwXUz5owglfaTcRUVWy4Mvv9Hmmkj1ODt5ZA5Yox
# kc92wDdmpbMO6EmpPOgVJBKGdl6cL7Gr/P0GEc8UVtS1+MCgboQM+NJAlheaiCNr
# w4RrX3HCeHfBW594/5yT7/SDE2LuD6Q7pZo6bTnYXiyIPzGLpS/vkvvv3yUe89OF
# zEceyBeoxjn3Z3XBSh/e0v94NpDRSGdgJTzIaRTZcmdy042cEoC9REC9/aqIhYOP
# gulybTMDtW6h+4lHVOm7JzmnWNrnZs1kEFWoA7DIOECapawlcCNheeywL98mR57f
# XgWH4YjIyC8A9FJyCpFmpXXp1MFi+h77DWf/Baz/JJNSzEPDhP8AhNy7k8CwucJW
# kCsOsUtFMXK6354dSgbpRhl+Pz9Gy5DjYg2x7Wlv9w+bsbaVwsm2QgpPzTG8HUuJ
# o289MFURyY1K8VQzTGtdldxhzFVeJjCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
# SZkAAAAAABUwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQI
# EwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
# ZnQgQ29ycG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290IENlcnRpZmlj
# YXRlIEF1dGhvcml0eSAyMDEwMB4XDTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIy
# NVowfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcT
# B1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UE
# AxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEB
# AQUAA4ICDwAwggIKAoICAQDk4aZM57RyIQt5osvXJHm9DtWC0/3unAcH0qlsTnXI
# yjVX9gF/bErg4r25PhdgM/9cT8dm95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjo
# YH1qUoNEt6aORmsHFPPFdvWGUNzBRMhxXFExN6AKOG6N7dcP2CZTfDlhAnrEqv1y
# aa8dq6z2Nr41JmTamDu6GnszrYBbfowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v
# 3byNpOORj7I5LFGc6XBpDco2LXCOMcg1KL3jtIckw+DJj361VI/c+gVVmG1oO5pG
# ve2krnopN6zL64NF50ZuyjLVwIYwXE8s4mKyzbnijYjklqwBSru+cakXW2dg3viS
# kR4dPf0gz3N9QZpGdc3EXzTdEonW/aUgfX782Z5F37ZyL9t9X4C626p+Nuw2TPYr
# bqgSUei/BQOj0XOmTTd0lBw0gg/wEPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlM
# jgK8QmguEOqEUUbi0b1qGFphAXPKZ6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJNmSL
# W6CmgyFdXzB0kZSU2LlQ+QuJYfM2BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AF
# emzFER1y7435UsSFF5PAPBXbGjfHCBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIu
# rQIDAQABo4IB3TCCAdkwEgYJKwYBBAGCNxUBBAUCAwEAATAjBgkrBgEEAYI3FQIE
# FgQUKqdS/mTEmr6CkTxGNSnPEP8vBO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWn
# G1M1GelyMFwGA1UdIARVMFMwUQYMKwYBBAGCN0yDfQEBMEEwPwYIKwYBBQUHAgEW
# M2h0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5
# Lmh0bTATBgNVHSUEDDAKBggrBgEFBQcDCDAZBgkrBgEEAYI3FAIEDB4KAFMAdQBi
# AEMAQTALBgNVHQ8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV
# 9lbLj+iiXGJo0T2UkFvXzpoYxDBWBgNVHR8ETzBNMEugSaBHhkVodHRwOi8vY3Js
# Lm1pY3Jvc29mdC5jb20vcGtpL2NybC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAx
# MC0wNi0yMy5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8v
# d3d3Lm1pY3Jvc29mdC5jb20vcGtpL2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2
# LTIzLmNydDANBgkqhkiG9w0BAQsFAAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv
# 6lwUtj5OR2R4sQaTlz0xM7U518JxNj/aZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZn
# OlNN3Zi6th542DYunKmCVgADsAW+iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1
# bSNU5HhTdSRXud2f8449xvNo32X2pFaq95W2KFUn0CS9QKC/GbYSEhFdPSfgQJY4
# rPf5KYnDvBewVIVCs/wMnosZiefwC2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU
# 6ZGyqVvfSaN0DLzskYDSPeZKPmY7T7uG+jIa2Zb0j/aRAfbOxnT99kxybxCrdTDF
# NLB62FD+CljdQDzHVG2dY3RILLFORy3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/
# HltEAY5aGZFrDZ+kKNxnGSgkujhLmm77IVRrakURR6nxt67I6IleT53S0Ex2tVdU
# CbFpAUR+fKFhbHP+CrvsQWY9af3LwUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKi
# excdFYmNcP7ntdAoGokLjzbaukz5m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9JZTm
# dHRbatGePu1+oDEzfbzL6Xu/OHBE0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZq
# ELQdVTNYs6FwZvKhggNZMIICQQIBATCCAQGhgdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjZCMDUtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQArKnyrZV2ACrVUaTN3s9nBXrM1zaCBgzCB
# gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUA
# AgUA7bgSajAiGA8yMDI2MDUyMDEwNTg1MFoYDzIwMjYwNTIxMTA1ODUwWjB3MD0G
# CisGAQQBhFkKBAExLzAtMAoCBQDtuBJqAgEAMAoCAQACAgOsAgH/MAcCAQACAhJp
# MAoCBQDtuWPqAgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAI
# AgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEBAGfNSHKq4loH
# Pp6SvUMI8HGE37PIdEJ5NOGyCQt6xSaPwJVk8LgC23iQYs8m/dcS6L2PYASHwv36
# +/vyKJbe5Lm2pCuPU7rl8M6Kfxg59C298XHGRXJE6q32MYtettjytqWFfG2g/VVY
# 2+S7Ya0kLmUofto7M8FpKxANKw4nasz3+jrmSG5BTETbnmjsCFGPzPfJ2g+qf8IO
# svkHen78V9bmkZXHb21qKz9gQGykylSaER6tbvuBC95kgzUmqCQhWLe0SmiXs0gG
# liTM73p6M0SY+n5913oHmGJnziBU8T2T5qmENfFZb//vErIxOF1BTcE7yIFyvUen
# 5kW0NGx/h0wxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
# V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
# IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
# MjAxMAITMwAAAhFFGDmbQ8/8bAABAAACETANBglghkgBZQMEAgEFAKCCAUowGgYJ
# KoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCAYiOGZgbpo
# aRBy4pn6MZNX7NgS0E7mLhaJn1vqGgqPgzCB+gYLKoZIhvcNAQkQAi8xgeowgecw
# geQwgb0EICytM6ma74dOrVpcXC+WGMXynadQI00IRf85Ysc0Mya3MIGYMIGApH4w
# fDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
# ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMd
# TWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIRRRg5m0PP/GwAAQAA
# AhEwIgQg4zVwhrMD5i3JoaVzUyI8MF/MjzhczRtfByDFnifAEMUwDQYJKoZIhvcN
# AQELBQAEggIAL/gzDznCS/rx/xFn/zTmU8c5u5xogOSn6Xyw1cHkyv6AtOJpPyos
# auj1r2JizchRB9KQsAN3N8zTHiNjR5XGZ5EuZAMsjIIJ+iEh1I7/ZUNNBfBeeDDy
# vvJrwJlNzEjEV/w6H+HqKenBIEYwOwwNTPlxaZZTCX4N/X86TFKlESdBFQQ+5w8s
# yttHUcU5nAUU6fyXDzYLJEdWqhMJh5aBGI49fLKJ/oi/TSswl/sqtgkbRlSgke3I
# aR6h/zWVSlUqoMqEKzAYrwFFhQLnXYceLyk2Yp0L1WefC5lHT4Fk91piQc3Wwc3m
# fr/gjpucC7dOx05XnOmh66NsEJRSDFnVT3GzH9h5XpQe8omD1nIlqoP1upEVgF0G
# dG1AoMWjBZYU24LnPMTpR6J8QQfPLQ26bN3Np8FUo0SQjj0TOGUAkLeVaCwdiToT
# TjHYIK8uzBJrcIEpNfRrtn4ww04/XdB0ybV6kvVgCSgfxzcybL4TBdzL5wYiFIoF
# tbzvnL0nER2ukQDPPJ9Kp92hKrpTewRSPZLImFhkWCFYBGwmZYUIKcYfKBq1/K95
# V393eo5hiNgBg915ANpBDIKRkJKjiB+3CRCztsw9NzU9y5ybUsnzw+kaAaySgHD3
# Va8YskXZ0EQUsgd30eIU3T2hWK4/0CjvHujp3ELsMS5g8cGQF8L2LSs=
# SIG # End signature block
