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
# MIIo3QYJKoZIhvcNAQcCoIIozjCCKMoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCClTEmP8lNmfYuz
# zmmyiR3hRS5wY8YW+ujliy4VW5ZqNqCCDcMwggatMIIElaADAgECAhMzAAAArn9k
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
# cDCCGmwCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVibGljIFNlcnZpY2VzIENv
# ZGUgU2lnbmluZyBQQ0ECEzMAAACuf2TW1iwx/gkAAAAAAK4wDQYJYIZIAWUDBAIB
# BQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIMvB0hHsHFmM/oV473+OB5nA
# /TnzI4Bdtq4uCkRjwkTsMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAE+9s6K1lFgniqpZCFq8yAKq+5cwb28rj/FXtHLLA3r3jmRjQfb6Uakuh
# NPGbaUc1lpr5QssGXm7Xv7MjdPOf/kTK5FNq+Pi1XXjsBCbDSxKjtZHPgTqu/psr
# YlJi9PWxs6bPb1M10bUNDehMlWzj62TpWTML8p7QscpERpH5DwjLSVR1bcGCgNTq
# rQQilm0+umSLXeNc/UvRTwdrtKz9LGsKdVAF756OXjzLQ7ohgu1NTgAirao71k/5
# lMYPmtlIaTZJDkC0BTC6Rm/NUfAGB+39HkZqrUdfd+JxTDls/3GX9u575t7q9DiM
# oQIc9Tli8MHr8ONY0ISUqI3I3/SWuZYlNPqWKgZd08QIuEiHjdbWifqokeUmW+Qa
# KdlKokSmRGpN07GAp6Ku3NKIJDtAtOp1W59W4Qsrxt6hB4IrP7JSJSOAbZ7Zgdj3
# ZVGYPIQh6f4n36P85EXG7QoKpZh72ApfcbiO2Z3nOwtGvhO4Av6jkMs/c6iYswAs
# aUGALjSEoYIXlzCCF5MGCisGAQQBgjcDAwExgheDMIIXfwYJKoZIhvcNAQcCoIIX
# cDCCF2wCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEIIqNVcn4RCL3
# PQG2iG5tiE9GdlBt3YpM/bcdTsnwsiS+AgZp2GbNyjMYEzIwMjYwNDIxMTc0NDI3
# LjE4NFowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjpGMDAyLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEe0wggcgMIIFCKADAgEC
# AhMzAAACICTh5uAXubSOAAEAAAIgMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk1MloXDTI3MDUxNzE5Mzk1
# MlowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjpGMDAyLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# ANFhjvKvuKNboJHXvy4q94gy5+61Y6JzGAnAo5x7/YY5Bx66zplZ9fXiLeM2Dck4
# /swYkyQ4C5zBYHCIDxRGn5liQaOlWhWQZmxXbtaOovCl/YDCoGwn9POrATskUVrG
# 6nct3GPwaN0nKYMVGt1U3+lgegEWuMPUiQgO7xvUJafy2CiaIpFJj5JO8mr32ZWR
# 2mEwEhQY56BCfLypF3bhUwTTGLw6iaSz1mr0SMN4ocam8BtdQRDqbdxE6gQ+FMT+
# aLB5Af1Oom3cg6yo+/cvy6uiMHvjtcELbLQIMgeUotwuXdkbwPslcqdZMV6feaww
# 8mly+tDfNQFUmsf+YjdHEeYKH2mkM/S4bX48nCTof/H6x+gb2FbrjGheSnHoMR81
# k19xd0ptcXbxcRd0s2fOjdIs1XKZ5AmE2o5IqGdTzhCcqauMSTnjUmK6uUMKQJY7
# 2VQFQxv3HSfJ9dRs1E9UuA/49MxF1c6jAl1gLMJB83ZmovSzhgjbwXUNufsGDDYT
# g/UT26ey8zMke3OFLZOHdOkJ8Fs4ZqUiUX3H8Mln+yyb/LLNP1i0gV6qZ83EE9MT
# do66HofGZMgLN9gABO9Y2EFujX1DCyM94D0m+GpMsLYpQ2CteugbLh4NmjSfuMVi
# NmRSKHVPL7wTqoS9XY1rpnmBTIPlr60cYOarr0KZSId/AgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU28ic4IiHEYDyZjuXWDTtQe/I2DMwHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBAK0oYG2jUFK+bhYUj4nQ1LJWFTUscvsXd9uNnZ3sXkqf8UJMFlenOsNW
# XrcUtE1wgWmcnLj+eWDjevtPmwk92jgyzwANIdAQmcdK7fH1SmMLNEQE+L36ceG8
# OBHH/VaYEPqBBRkks6Fw3ZPFbgonKGKcy2IEW2Q1Fna+ZnUwB01dObl3QvCTfDOP
# 79/tUIJNYJclKio1rdVT/qwAIcj3sS9ufODxt3eHGt/PoJwJW5/vt6C9EeKe2Em7
# BJF48/tpWZx69vWdZQgAgJ0F5sdA6vM0h5YEhDC9wVpLdIVz7j2uqvBA4wUNHgVg
# HNLtvRB4FXEW4svaJW7goAcw1SEstIPiIosMUE1M61PNOWEa8yAbvsDVyN5CsMwd
# rqhF4wN5QOodSvG/yDshF0iH6HSAMuTM3TEi7OWLQG/sm3JsYltXonFoMXgLNIIg
# xGkrn2cjqIqjguCdtAFklbv7pqRiwob+lc+V/E2/YiekPXS1IKQK/D2SvpbX41E3
# 4S5lzNGADBaVwr1clne67+/+jEe07v+SZUiznUX2pXpjZA1d3q1Tjpg+sr3ybZAP
# Kz6W8s2KYrR7XFntnUZrAqiEoa+UsAtYOVlCqAd8nfUIHQuUgMjuIvJhOl3aLIqO
# qyRtCLIy0gIf5GYf+gKDsk4rRkDdcgxtr1pJaAEXdBnqkbcQZ5CqMIIHcTCCBVmg
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
# f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1AwggI4AgEBMIH5oYHRpIHO
# MIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
# UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQL
# ExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxk
# IFRTUyBFU046RjAwMi0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVAJMYD2+mwnqCWoIuYjSuCAbH
# hgQSoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDtkgziMCIYDzIwMjYwNDIxMTQ0OTA2WhgPMjAyNjA0MjIxNDQ5
# MDZaMHcwPQYKKwYBBAGEWQoEATEvMC0wCgIFAO2SDOICAQAwCgIBAAICNYcCAf8w
# BwIBAAICE7EwCgIFAO2TXmICAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGE
# WQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEA
# AqgZVBR9JIPsefGxRqVrOkAL7JA8rC7B5uCqQZE+2pw4IFaqcUxs01jEHctpAfMv
# 7c2xCQITs/KKq3DMWabW7FyOca4tQ1drbUSOyCzR+6lUc56pM86dhEShSF0/G6MV
# xxGDvpCmt3N4SBfI77Ln85Ua0NVbsPb7xbZMsyqNjeDnDLUAwhUhEz6CMCkevK9+
# CouUgQQK79eQ3XfQP0aLRSWrQEH0y8Pxb5ZYJUJBhAe2GZQXFNCHWAWofL8QkRdI
# 0930cRXq/QKPkOyvpu3fSKiTGirrfrMs7G+uWWcqGPEwWIv/XeQ5zMMHUcU1cJC2
# MfCc5IpwmDy/ZUy/TURWsDGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMw
# EQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
# aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0
# YW1wIFBDQSAyMDEwAhMzAAACICTh5uAXubSOAAEAAAIgMA0GCWCGSAFlAwQCAQUA
# oIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIE
# IM9xkGmwuNlaO32P4cdlcYUMg3J85Z2seriPH5sp2FqWMIH6BgsqhkiG9w0BCRAC
# LzGB6jCB5zCB5DCBvQQg43u/I6U8DVWqUSnRAhUaU13xLlhYGcqP3su5NYdI7a8w
# gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
# A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
# JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiAk4ebg
# F7m0jgABAAACIDAiBCALwq0Tl9kX5AMx01zeaS13LRk37Ad41SeG8Gvbw2YmCjAN
# BgkqhkiG9w0BAQsFAASCAgBXpckelV1KoLWq06hWungZQM8vqD1AhDit7JOdPwVO
# NZpfKxIthrPb4mcJD2Ii9v1eMrlPgifms6AelTlzYMf41KDOkrrtpAO9QPlVuhgl
# zpWdSqEINOiGJ4yILAbiuuQljI4mkIugBePX72EbMG5qesiAH5DS/hElrRlvvp9H
# ow3ex+oCuItVQkByfmJEmMkSuvcHU8/RLGNpK0kuu4Gg6v8htnFUpM+2wxgpIunO
# +WFy9XIZJQ3rOc9GO1ne23LN9q3GARlaZyhTKEBCIcEOg4xmd4Ww5erFMZIiYcwL
# TfV9yW0b/pALbaxOkdllfLdWPQYdzE5tjW0eEAAU2eOzHD9C2ONj8szPOtCmecgE
# BADSoe9j3cRT+ws0MM1bxz7qd2HqUs51sXUoZc8xXEZ+TjrnqK5ozY6kKT0wO6wD
# uYs578lc5P22bDn3ihl3h1w3NqjrU/wY/vWWQTWs8/xYjXben1pSpzPTQ4JMquOZ
# Q6P1Ath/Fr0/Z9AmQYON5lA9Qa6GfY3DycBGYikwj9K/e8MMlelEDIB2PdUlc6cX
# Bj+8swzcBOByVj4e07c2yw3NLASAajlH/M6ZYo/0UlqcMlT/WkZseOQHCyECW+/w
# jqkodnxQvtPamD5B2JCy8xfm/NCgSE/IeCRuEphQqn5Qpcb/m+gUtoMgflsQh9pU
# Pw==
# SIG # End signature block
