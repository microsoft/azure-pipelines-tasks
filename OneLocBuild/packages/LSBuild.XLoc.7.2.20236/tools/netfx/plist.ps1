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

# SIG # Begin signature block
# MIIpAgYJKoZIhvcNAQcCoIIo8zCCKO8CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCClTEmP8lNmfYuz
# zmmyiR3hRS5wY8YW+ujliy4VW5ZqNqCCDdIwgga8MIIEpKADAgECAhMzAAAA0ths
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
# 7XkStEJ8NBGHBKIFMYIahjCCGoICAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UE
# ChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVi
# bGljIFNlcnZpY2VzIENvZGUgU2lnbmluZyBQQ0ECEzMAAADS2GxGsZ3GsqAAAAAA
# ANIwDQYJYIZIAWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQw
# HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIMvB
# 0hHsHFmM/oV473+OB5nA/TnzI4Bdtq4uCkRjwkTsMEIGCisGAQQBgjcCAQwxNDAy
# oBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
# b20wDQYJKoZIhvcNAQEBBQAEggGAid3Y35N3HW4UFKo5Z8UXzM6SbNy0vd6WWX6x
# Bjy6NohaKONOuahLqj7DZ8JG42tzm2AFX6OfBAnqY8YK0SdQ9oJ9INb87hme39Sm
# NR7j9Jt45KZpcQwva9pY3hXSIkTgS4etp1FtFf1L6/5Rq8NLv1sWk17bVy5v0krH
# UgluYhiyDJESOc2p3AL1j/sBmd6HrlLyjFONasSpYGbbINLy61AksbJ69yZ5scyJ
# hdBxwmqCUburnjD71S1Duhf3DLrf7Kau78ej8B5RsklBEs2KY5gBiNgWF86CyYkT
# YFbQWPMin3Vvlte9haAewHPcIcsxAAzi9Jgyna7bPdkp9xlLl55Unp0O6gzZT8Qq
# Xn0LM/Dfxo0116oEi4w3GXnjh1I+0K5YTmLBVn03oNUI2TVTZDUQ1+pTlxLoDEzM
# FRZlN+3fEJSJHuT6gqdceLxe60R8MM4F8hRX8Qg+upIxPoEe1aO8ML0hRaVjG6oS
# Eh9/yVvGkBvJXetMIrhwijuMHDk7oYIXrTCCF6kGCisGAQQBgjcDAwExgheZMIIX
# lQYJKoZIhvcNAQcCoIIXhjCCF4ICAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqG
# SIb3DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUD
# BAIBBQAEIAp2xGQjyZkB2HRLsDbg+JqKRqn6wZhUmLBkuwiBp95AAgZqEXXLBpIY
# EzIwMjYwNjA4MjI0MjQ2LjY3N1owBIACAfSggdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjU1MUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloIIR+zCCBygwggUQoAMCAQICEzMAAAIb0LK4Amf3cs8AAQAAAhswDQYJ
# KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUw
# ODE0MTg0ODMwWhcNMjYxMTEzMTg0ODMwWjCB0zELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3Bl
# cmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046NTUxQS0w
# NUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Uw
# ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCOxZ3nZlmTMHld7mD+XYaw
# 6MDPfSyDqNXF8UlX7DjEgNXJojcs7xsimbNi6XcBkeDnRQhDw+tJFkalCoWRE276
# jdgoniDa4ZgFGSwecdhHS5VIJCDnxOGRjJ6mUZfegC8ZFW48ilC0CJOxHvoD+B2h
# TscPARtvvdsnBPKtsoeFH5ZozL0NAcjiTlCjj5tkOzSSPvpu+Em90ZT5LzPFAGnt
# QCGMmcWorEi6xIhMTvMIJHjbYQuGSFVU4WorbDqHUwC8gt7vqHFEhw+PRIEvavw7
# 23HmeNTj62DasB1TXnembKGprN2lRxxgET3ANEVR3970KhbHtN2dSJwH4xqLtFPq
# qx7t7loapfUHtueP9ke+ut8X4EkQiVL2INcBSB6S9dn4VmaO8vA/5037T9yuH76v
# h7wWScXsRfogl+eY14M3/rxnn2RtonV/4/macph/J0J5mbGsalLS1paQOTfoPeM9
# Vl+W/Gtz7WuEIiUzm/1qAsQUjXZCIFN+k4E4GvcAYI+T54fT6Vq2NBqO6D7b8EPX
# apvzbnTQtDK1RZPai1r8didGBK/WO9nT92aXUWzFZjM6cKuN90H/s3qk3JK3i+f4
# 8Y3p0UuKbuTGiz4H1Z9A97MmLd+4rLIMAH3NIc+PVm7ydl95xkn26bjOPsMWC8ld
# MNOcbmqUbhl1sVFr+ut/OQIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFLa+n3f+XEum
# k0rw6Rq4nYC82YhQMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
# A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y3JsL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
# BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
# MDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUH
# AwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQBmRTVfFAPg5Mzc
# ZOG3fZNdKEh88Ggx9KwWwFCoU5mosk7HIk6WUgEWmam860Y0+QLlnyV0bxoKm+AU
# 2j+MNZ5PkWJbnd0CP0qdnGmxDc9/l9HNIYdFzEQw51chXMMnBxlRfRyN/GdrvJ02
# /x5cH9eTobpLKtHY4fpLUscxbXWbdS8oX54uMg+XjmvGKa4MKgR35p3SU4BcDn+9
# k4o3mf949h4/QtFyFlfRDofyf9mZI8yVuWLcw7znVDT1GZP9kYdr78V3L5YsOvBx
# jKRX2ZTL/hNvArDoW11Hpk8fEx0iLWmTxjaYL8bMKrQsKwfS5MV5DpDs1zcxGYRH
# /eYtZSFtpYeBfUVthyG9HbZv4G6n5g9HlD/QGFpoA3oAgF9waz67+cmggHLJkoDx
# xPIKadQj/i9boPi/LCDdcEV/h/YPAUfL96+wL7nwoyX6TbBrTlfaQrRP9sI8uFqi
# /1lfKhtrB804tgaJq4pPYVa9vBnMcgUJPGMHDDo+3m5G8IT+OdRx//GGU4YyfqIo
# 71e3j29lMTZJ8gGT/fiItNEEnoftoY9NNCfNrc59a7X91HJwLpaXmiezc+OcZdNI
# pLFeWUk+aDpH+6Uaic/9QJignqY34ReN/IMs9cuqyv3X5VMbWtjNEKM/AEUAe/gQ
# jBoTRqMKt/vl5QYjf6hdTRQ/quWhnzCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
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
# ELQdVTNYs6FwZvKhggNWMIICPgIBATCCAQGhgdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjU1MUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQCGhXqvj0zgYF3jUrVFgHVnR/jO4KCBgzCB
# gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUA
# AgUA7dGzmzAiGA8yMDI2MDYwODIxMzMxNVoYDzIwMjYwNjA5MjEzMzE1WjB0MDoG
# CisGAQQBhFkKBAExLDAqMAoCBQDt0bObAgEAMAcCAQACAgaFMAcCAQACAhMsMAoC
# BQDt0wUbAgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
# AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEBABuAhn9AxUpsn838
# 2aIC9X7HiQ4uFDdT05uKy3lmCG2JbKfpZrPZwmBk6L/TQmo19Y9nqKv5jCY7SsqK
# kcLHa2kVd3MYhS4Y7GqHUmfPZP08N2yhv1YEQXwcgeYEXrW1strKHbTd8ndcl2WD
# zmKsQAkHT3ufWTrBZ6tlV82lh3gsZMaRGVrVFZ1scstJajF+zfyYBTi86+tmxoun
# h1ilWCaYadqsrkyfMAIqAuZvuKyyh+UlZxMMlkeSZZ7oelkXAmEme7FHX/D5bCpo
# QsNKWm54jCvSyOJTz9ATkPWSu8Ufss2KRqWQWjCOSlf8dQ+/CqAmiMi2uI7zS+Fb
# yi567xExggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
# aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
# MAITMwAAAhvQsrgCZ/dyzwABAAACGzANBglghkgBZQMEAgEFAKCCAUowGgYJKoZI
# hvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCAwb2d+REDB81pL
# gnu48XepaxLOp+MIMRVIqgS9H6LcPTCB+gYLKoZIhvcNAQkQAi8xgeowgecwgeQw
# gb0EIDAlFJW4PaOYxxAIVd0u4kDAOlRU1nptzp18lTzdDYuAMIGYMIGApH4wfDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
# bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
# cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIb0LK4Amf3cs8AAQAAAhsw
# IgQgRSckIsiyckRkyk4AaGi+5yAA4K6fpB3ycbIArKhxIRMwDQYJKoZIhvcNAQEL
# BQAEggIACO6prfS3ng7HHwlI6Z/IDptze2xVeCHRX/Ac+8u64DKzZaN2mBA+SL+5
# y4n/Zvq/k3FV8NwfJqgTUlYwoWzFbA4yUxXahalXLZdpdsRCG21cGm0u4yd7e47W
# ud/+kz91FviJ4tRJ293BNPCv/0NTgWNnkjWMcaqrDmZv/T7FIwoAbNyz6P45AkIs
# wDN3cpdk5YFGntMhVkSWJx8YvLczkYpddcMIymjsE1H6b3CNfY14k1FWWjz7IHWR
# aZ1+sBD6+dRxvskxQs0lOrZU9MjftYe1vTj3Qp0KDIIvnKmPzAiMQOgGjTMyVaHg
# svR9+JJs8cz2TGGm/DOBbdHiaRP9a+FFo9Pf8Yo3H6nFXbn1o8cxVSczAmLC0Siz
# nHAExHuqA8N0qzU2UMIyyOCEMlBQGmXJfH7OeNVh3aeRTzGLR+zgKrnF4iPed9qf
# J5LvOSNF8zV/3CSGasScJMS3b+5i8Lh98W/mHTXgV1kKNYoHl6w8P2VjWY0FkayM
# m+gc0b0Uql3KWHFPSqSkAm9XHP0UOPxAQUfKC8ojrQb/KkKBHe7DYxthaJxDwVjB
# H4auune6WL04z/ZqS2HIJQPRIm1cms8RE9xeb3WCRLY76kNAv5jrKsNNDWv7/Y4G
# grWzt1amFrBBFpimd1V8uzVkAQ/jsynYWgo/YjriGmoJ1FhfvoA=
# SIG # End signature block
