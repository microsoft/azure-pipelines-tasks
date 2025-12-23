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
# MIIr8gYJKoZIhvcNAQcCoIIr4zCCK98CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCClTEmP8lNmfYuz
# zmmyiR3hRS5wY8YW+ujliy4VW5ZqNqCCEX0wggiNMIIHdaADAgECAhM2AAACAR26
# 8SCNUOBoAAIAAAIBMA0GCSqGSIb3DQEBCwUAMEExEzARBgoJkiaJk/IsZAEZFgNH
# QkwxEzARBgoJkiaJk/IsZAEZFgNBTUUxFTATBgNVBAMTDEFNRSBDUyBDQSAwMTAe
# Fw0yNDExMDgxMjQ0MTRaFw0yNTExMDgxMjQ0MTRaMCQxIjAgBgNVBAMTGU1pY3Jv
# c29mdCBBenVyZSBDb2RlIFNpZ24wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
# AoIBAQC5EbpMULKgL3ArJn1rQqUye5Mzq2Eqlu0Ov9Vv2X+MvePQtXj4Cr7dLpJO
# VjPrUvirL6Jn8gYuDRxhVZbj3s81AfC8wq0sC/928aXCleSUDwX4scwK7vbpur2+
# TJm0WZ0E1gk8VY1bAjG9G3sQ2A+bpcMaBu7soLLH0ofyYzf6cl9irH3iHAw1ZucU
# mpROzEZcn3cmcxNwS0P2MX1nPE3qJEPoa3odBFZd5RXfDo7ro62MeNVjR/4bPjic
# IcnT/G0wWEXwKwTOkxFHibmmbhgfWAxDh75LZMYeLSeGkXhhBgQ/7Y11swZdaK3l
# okxcrV7d6jus7is+p6o8nep1OGGrAgMBAAGjggWZMIIFlTApBgkrBgEEAYI3FQoE
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
# aG9yaXR5MB0GA1UdDgQWBBSOzWIbg/0woPHoJiGbNef2gihnJDAOBgNVHQ8BAf8E
# BAMCB4AwVAYDVR0RBE0wS6RJMEcxLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVsYW5k
# IE9wZXJhdGlvbnMgTGltaXRlZDEWMBQGA1UEBRMNMjM2MTY3KzUwMzE2NTCCAeYG
# A1UdHwSCAd0wggHZMIIB1aCCAdGgggHNhj9odHRwOi8vY3JsLm1pY3Jvc29mdC5j
# b20vcGtpaW5mcmEvQ1JML0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6
# Ly9jcmwxLmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0
# dHA6Ly9jcmwyLmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyG
# MWh0dHA6Ly9jcmwzLmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5j
# cmyGMWh0dHA6Ly9jcmw0LmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgy
# KS5jcmyGgb1sZGFwOi8vL0NOPUFNRSUyMENTJTIwQ0ElMjAwMSgyKSxDTj1CWTJQ
# S0lDU0NBMDEsQ049Q0RQLENOPVB1YmxpYyUyMEtleSUyMFNlcnZpY2VzLENOPVNl
# cnZpY2VzLENOPUNvbmZpZ3VyYXRpb24sREM9QU1FLERDPUdCTD9jZXJ0aWZpY2F0
# ZVJldm9jYXRpb25MaXN0P2Jhc2U/b2JqZWN0Q2xhc3M9Y1JMRGlzdHJpYnV0aW9u
# UG9pbnQwHwYDVR0jBBgwFoAUllGE4Gtve/7YBqvD8oXmKa5q+dQwHwYDVR0lBBgw
# FgYKKwYBBAGCN1sBAQYIKwYBBQUHAwMwDQYJKoZIhvcNAQELBQADggEBABAaRi/Y
# mQnOw4MrZVaGuauVsykbusUmfa8tbfFNYfqqGhlJhBp8cWnpJnc39N3MDq22orPd
# dbidV8+YPxQ8FyhqFIkGKlV2WoD9kQV5LH+1RapE1nrHrGWH+vFdCcIy/X81ARIZ
# 2q3VHjNXQzMg+6vAJNMQRZIjk5pE/3YQvCNUOABt9gYFd8GEnTMeBaJaQibKB0o+
# 8tPKWRpse5J4/O4/Yj3dwI5YYmNPUFerhszwU6IXH/k3EwvgbFVCYCgtl6vckET8
# 36Ph/bJEA1uKmsFhtTAj8xE2USF9OHKFietrYEmA3aP0eIkyjRmZGRcla5P9fS62
# o2/gYAp0+NCn7C0wggjoMIIG0KADAgECAhMfAAAAUeqP9pxzDKg7AAAAAABRMA0G
# CSqGSIb3DQEBCwUAMDwxEzARBgoJkiaJk/IsZAEZFgNHQkwxEzARBgoJkiaJk/Is
# ZAEZFgNBTUUxEDAOBgNVBAMTB2FtZXJvb3QwHhcNMjEwNTIxMTg0NDE0WhcNMjYw
# NTIxMTg1NDE0WjBBMRMwEQYKCZImiZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQB
# GRYDQU1FMRUwEwYDVQQDEwxBTUUgQ1MgQ0EgMDEwggEiMA0GCSqGSIb3DQEBAQUA
# A4IBDwAwggEKAoIBAQDJmlIJfQGejVbXKpcyFPoFSUllalrinfEV6JMc7i+bZDoL
# 9rNHnHDGfJgeuRIYO1LY/1f4oMTrhXbSaYRCS5vGc8145WcTZG908bGDCWr4GFLc
# 411WxA+Pv2rteAcz0eHMH36qTQ8L0o3XOb2n+x7KJFLokXV1s6pF/WlSXsUBXGaC
# IIWBXyEchv+sM9eKDsUOLdLTITHYJQNWkiryMSEbxqdQUTVZjEz6eLRLkofDAo8p
# XirIYOgM770CYOiZrcKHK7lYOVblx22pdNawY8Te6a2dfoCaWV1QUuazg5VHiC4p
# /6fksgEILptOKhx9c+iapiNhMrHsAYx9pUtppeaFAgMBAAGjggTcMIIE2DASBgkr
# BgEEAYI3FQEEBQIDAgACMCMGCSsGAQQBgjcVAgQWBBQSaCRCIUfL1Gu+Mc8gpMAL
# I38/RzAdBgNVHQ4EFgQUllGE4Gtve/7YBqvD8oXmKa5q+dQwggEEBgNVHSUEgfww
# gfkGBysGAQUCAwUGCCsGAQUFBwMBBggrBgEFBQcDAgYKKwYBBAGCNxQCAQYJKwYB
# BAGCNxUGBgorBgEEAYI3CgMMBgkrBgEEAYI3FQYGCCsGAQUFBwMJBggrBgEFBQgC
# AgYKKwYBBAGCN0ABAQYLKwYBBAGCNwoDBAEGCisGAQQBgjcKAwQGCSsGAQQBgjcV
# BQYKKwYBBAGCNxQCAgYKKwYBBAGCNxQCAwYIKwYBBQUHAwMGCisGAQQBgjdbAQEG
# CisGAQQBgjdbAgEGCisGAQQBgjdbAwEGCisGAQQBgjdbBQEGCisGAQQBgjdbBAEG
# CisGAQQBgjdbBAIwGQYJKwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQD
# AgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHwYDVR0jBBgwFoAUKV5RXmSuNLnrrJwN
# p4x1AdEJCygwggFoBgNVHR8EggFfMIIBWzCCAVegggFToIIBT4YxaHR0cDovL2Ny
# bC5taWNyb3NvZnQuY29tL3BraWluZnJhL2NybC9hbWVyb290LmNybIYjaHR0cDov
# L2NybDIuYW1lLmdibC9jcmwvYW1lcm9vdC5jcmyGI2h0dHA6Ly9jcmwzLmFtZS5n
# YmwvY3JsL2FtZXJvb3QuY3JshiNodHRwOi8vY3JsMS5hbWUuZ2JsL2NybC9hbWVy
# b290LmNybIaBqmxkYXA6Ly8vQ049YW1lcm9vdCxDTj1BTUVSb290LENOPUNEUCxD
# Tj1QdWJsaWMlMjBLZXklMjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1
# cmF0aW9uLERDPUFNRSxEQz1HQkw/Y2VydGlmaWNhdGVSZXZvY2F0aW9uTGlzdD9i
# YXNlP29iamVjdENsYXNzPWNSTERpc3RyaWJ1dGlvblBvaW50MIIBqwYIKwYBBQUH
# AQEEggGdMIIBmTBHBggrBgEFBQcwAoY7aHR0cDovL2NybC5taWNyb3NvZnQuY29t
# L3BraWluZnJhL2NlcnRzL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUHMAKG
# K2h0dHA6Ly9jcmwyLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYI
# KwYBBQUHMAKGK2h0dHA6Ly9jcmwzLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9v
# dC5jcnQwNwYIKwYBBQUHMAKGK2h0dHA6Ly9jcmwxLmFtZS5nYmwvYWlhL0FNRVJv
# b3RfYW1lcm9vdC5jcnQwgaIGCCsGAQUFBzAChoGVbGRhcDovLy9DTj1hbWVyb290
# LENOPUFJQSxDTj1QdWJsaWMlMjBLZXklMjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxD
# Tj1Db25maWd1cmF0aW9uLERDPUFNRSxEQz1HQkw/Y0FDZXJ0aWZpY2F0ZT9iYXNl
# P29iamVjdENsYXNzPWNlcnRpZmljYXRpb25BdXRob3JpdHkwDQYJKoZIhvcNAQEL
# BQADggIBAFAQI7dPD+jfXtGt3vJp2pyzA/HUu8hjKaRpM3opya5G3ocprRd7vdTH
# b8BDfRN+AD0YEmeDB5HKQoG6xHPI5TXuIi5sm/LeADbV3C2q0HQOygS/VT+m1W7a
# /752hMIn+L4ZuyxVeSBpfwf7oQ4YSZPh6+ngZvBHgfBaVz4O9/wcfw91QDZnTgK9
# zAh9yRKKls2bziPEnxeOZMVNaxyV0v152PY2xjqIafIkUjK6vY9LtVFjJXenVUAm
# n3WCPWNFC1YTIIHw/mD2cTfPy7QA1pT+GPARAKt0bKtq9aCd/Ym0b5tPbpgCiRtz
# yb7fbNS1dE740re0COE67YV2wbeo2sXixzvLftH8L7s9xv9wV+G22qyKt6lmKLjF
# K1yMw4Ni5fMabcgmzRvSjAcbqgp3tk4a8emaaH0rz8MuuIP+yrxtREPXSqL/C5bz
# MzsikuDW9xH10graZzSmPjilzpRfRdu20/9UQmC7eVPZ4j1WNa1oqPHfzET3ChIz
# J6Q9G3NPCB+7KwX0OQmKyv7IDimj8U/GlsHD1z+EF/fYMf8YXG15LamaOAohsw/y
# wO6SYSreVW+5Y0mzJutnBC9Cm9ozj1+/4kqksrlhZgR/CSxhFH3BTweH8gP2FEIS
# RtShDZbuYymynY1un+RyfiK9+iVTLdD1h/SxyxDpZMtimb4CgJQlMYIZyzCCGccC
# AQEwWDBBMRMwEQYKCZImiZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1F
# MRUwEwYDVQQDEwxBTUUgQ1MgQ0EgMDECEzYAAAIBHbrxII1Q4GgAAgAAAgEwDQYJ
# YIZIAWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYB
# BAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIMvB0hHsHFmM
# /oV473+OB5nA/TnzI4Bdtq4uCkRjwkTsMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBN
# AGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJ
# KoZIhvcNAQEBBQAEggEArb1L9AJW0j8qxICY6v0fAPnERtD+Br5jTVlCLRXbcjPc
# ORv6FK4J6GUHxStVP1bBkmjz681T1Zec0j36r/1KbXWqe2ZtaMdMaT2Dqlat+vm2
# Uq3VC89nu4vWIjN7au7pWqJ+ZPml+syMLogI31A3CSnxq8bti9Gf3e5t55J/KJLz
# 6kLuSO65wIL+2+43+YT/4u+eH1dGejED2TM+ivm+udjd+QcJ7QGa8uMRX39DdSzD
# 3xV2NBP7NFZnXJB1Q8k8enFvSkpaepn4UrXhfUkYjtEOf/DWZPWDnogeXHYPZ3OO
# q9y4I3NYffQYOaf25JUcskTuaUGPU9CMzRm4sMqZtKGCF5MwghePBgorBgEEAYI3
# AwMBMYIXfzCCF3sGCSqGSIb3DQEHAqCCF2wwghdoAgEDMQ8wDQYJYIZIAWUDBAIB
# BQAwggFRBgsqhkiG9w0BCRABBKCCAUAEggE8MIIBOAIBAQYKKwYBBAGEWQoDATAx
# MA0GCWCGSAFlAwQCAQUABCAVLeYgraEdiK1MVfWiGi2Px5wbeEB0mPQDGNIxV+MJ
# vAIGaNr1e80HGBIyMDI1MTAxMzE4NDI0NC4zOFowBIACAfSggdGkgc4wgcsxCzAJ
# BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
# MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jv
# c29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGllbGQgVFNTIEVT
# Tjo5NjAwLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAg
# U2VydmljZaCCEeowggcgMIIFCKADAgECAhMzAAACBNjgDgeXMliYAAEAAAIEMA0G
# CSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9u
# MRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRp
# b24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI1
# MDEzMDE5NDI0N1oXDTI2MDQyMjE5NDI0N1owgcsxCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9w
# ZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjo5NjAwLTA1RTAtRDk0
# NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZTCCAiIwDQYJ
# KoZIhvcNAQEBBQADggIPADCCAgoCggIBAPDdJtx57Z3rq+RYZMheF8aqqBAbFBdO
# erjheVS83MVK3sQu07gH3f2PBkVfsOtG3/h+nMY2QV0alzsQvlLzqopi/frR5eNb
# 58i/WUCoMPfV3+nwCL38BnPwz3nOjSsOkrZyzP1YDJH0W1QPHnZU6z2o/f+mCke+
# BS8Pyzr/co0hPOazxALW0ndMzDVxGf0JmBUhjPDaIP9m85bSxsX8NF2AzxR23GMU
# gpNdNoj9smGxCB7dPBrIpDaPzlFp8UVUJHn8KFqmSsFBYbA0Vo/OmZg3jqY+I69T
# GuIhIL2dD8asNdQlbMsOZyGuavZtoAEl6+/DfVRiVOUtljrNSaOSBpF+mjN34aWr
# 1NjYTcOCWvo+1MQqA+7aEzq/w2JTmdO/GEOfF2Zx/xQ3uCh5WUQtds6buPzLDXEz
# 0jLJC5QxaSisFo3/mv2DiW9iQyiFFcRgHS0xo4+3QWZmZAwsEWk1FWdcFNriFpe+
# fVp0qu9PPxWV+cfGQfquID+HYCWphaG/RhQuwRwedoNaCoDb2vL6MfT3sykn8UcY
# fGT532QfYvlok+kBi42Yw08HsUNM9YDHsCmOv8nkyFTHSLTuBXZusBn0n1EeL58w
# 9tL5CbgCicLmI5OP50oK21VGz6Moq47rcIvCqWWO+dQKa5Jq85fnghc60pwVmR8N
# 05ntwTgOKg/VAgMBAAGjggFJMIIBRTAdBgNVHQ4EFgQUGnV2S0Bwalb8qbqqb6+7
# gzUZol8wHwYDVR0jBBgwFoAUn6cVXQBeYl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgw
# VjBUoFKgUIZOaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jcmwvTWlj
# cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUF
# BwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0cDovL3d3dy5taWNyb3NvZnQuY29tL3Br
# aW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBUaW1lLVN0YW1wJTIwUENBJTIwMjAxMCgx
# KS5jcnQwDAYDVR0TAQH/BAIwADAWBgNVHSUBAf8EDDAKBggrBgEFBQcDCDAOBgNV
# HQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQELBQADggIBAF5y/qxHDYdMszJQLVYkn4VH
# 4OAD0mS/SUawi3jLr0KY6PxHregVuFKZx2lqTGo1uvy/13JNvhEPI2q2iGKJdu2t
# eZArlfvL9D74XTMyi1O1OlM+8bd6W3JX8u87Xmasug1DtbhUfnxou3TfS05HGzxW
# cBBAXkGZBAw65r4RCAfh/UXi4XquXcQLXskFInTCMdJ5r+fRZiIc9HSqTP81EB/y
# VJRRXSBsgxrAYiOfv5ErIKv7yXXF02Qr8XRRi5feEbScT71ZzQvgD96eW5Q3s9r2
# 85XpWLcE4lJPRFj9rHuJnjmV4zySoLDsEU9xMiRbPGmOvacK2KueTDs4FDoU2DAi
# 4C9g1NTuvrRbjbVgU4vmlOwxlw0M46wDTXG/vKYIXrOScwalEe7DRFvYEAkL2q5T
# sJdZsxsAkt1npcg0pquJKYJff8wt3Nxblc7JwrRCGhE1F/hapdGyEQFpjbKYm8c7
# jyhJJj+Sm5i8FLeWMAC4s3tGnyNZLu33XqloZ4Tumuas/0UmyjLUsUqYWdb6+Djc
# A2EHK4ARer0JrLmjsrYfk0WdHnCP9ItErArWLJRf3bqLVMS+ISICH89XIlsAPiSi
# KmKDbyn/ocO6Jg5nTBSSb9rlbyisiOg51TdewniLTwJ82nkjvcKy8HlA9gxwukX0
# 07/Uu+hADDdQ90vnkzkdMIIHcTCCBVmgAwIBAgITMwAAABXF52ueAptJmQAAAAAA
# FTANBgkqhkiG9w0BAQsFADCBiDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hp
# bmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jw
# b3JhdGlvbjEyMDAGA1UEAxMpTWljcm9zb2Z0IFJvb3QgQ2VydGlmaWNhdGUgQXV0
# aG9yaXR5IDIwMTAwHhcNMjEwOTMwMTgyMjI1WhcNMzAwOTMwMTgzMjI1WjB8MQsw
# CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
# ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNy
# b3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDCCAiIwDQYJKoZIhvcNAQEBBQADggIP
# ADCCAgoCggIBAOThpkzntHIhC3miy9ckeb0O1YLT/e6cBwfSqWxOdcjKNVf2AX9s
# SuDivbk+F2Az/1xPx2b3lVNxWuJ+Slr+uDZnhUYjDLWNE893MsAQGOhgfWpSg0S3
# po5GawcU88V29YZQ3MFEyHFcUTE3oAo4bo3t1w/YJlN8OWECesSq/XJprx2rrPY2
# vjUmZNqYO7oaezOtgFt+jBAcnVL+tuhiJdxqD89d9P6OU8/W7IVWTe/dvI2k45GP
# sjksUZzpcGkNyjYtcI4xyDUoveO0hyTD4MmPfrVUj9z6BVWYbWg7mka97aSueik3
# rMvrg0XnRm7KMtXAhjBcTyziYrLNueKNiOSWrAFKu75xqRdbZ2De+JKRHh09/SDP
# c31BmkZ1zcRfNN0Sidb9pSB9fvzZnkXftnIv231fgLrbqn427DZM9ituqBJR6L8F
# A6PRc6ZNN3SUHDSCD/AQ8rdHGO2n6Jl8P0zbr17C89XYcz1DTsEzOUyOArxCaC4Q
# 6oRRRuLRvWoYWmEBc8pnol7XKHYC4jMYctenIPDC+hIK12NvDMk2ZItboKaDIV1f
# MHSRlJTYuVD5C4lh8zYGNRiER9vcG9H9stQcxWv2XFJRXRLbJbqvUAV6bMURHXLv
# jflSxIUXk8A8FdsaN8cIFRg/eKtFtvUeh17aj54WcmnGrnu3tz5q4i6tAgMBAAGj
# ggHdMIIB2TASBgkrBgEEAYI3FQEEBQIDAQABMCMGCSsGAQQBgjcVAgQWBBQqp1L+
# ZMSavoKRPEY1Kc8Q/y8E7jAdBgNVHQ4EFgQUn6cVXQBeYl2D9OXSZacbUzUZ6XIw
# XAYDVR0gBFUwUzBRBgwrBgEEAYI3TIN9AQEwQTA/BggrBgEFBQcCARYzaHR0cDov
# L3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9Eb2NzL1JlcG9zaXRvcnkuaHRtMBMG
# A1UdJQQMMAoGCCsGAQUFBwMIMBkGCSsGAQQBgjcUAgQMHgoAUwB1AGIAQwBBMAsG
# A1UdDwQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB8GA1UdIwQYMBaAFNX2VsuP6KJc
# YmjRPZSQW9fOmhjEMFYGA1UdHwRPME0wS6BJoEeGRWh0dHA6Ly9jcmwubWljcm9z
# b2Z0LmNvbS9wa2kvY3JsL3Byb2R1Y3RzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIz
# LmNybDBaBggrBgEFBQcBAQROMEwwSgYIKwYBBQUHMAKGPmh0dHA6Ly93d3cubWlj
# cm9zb2Z0LmNvbS9wa2kvY2VydHMvTWljUm9vQ2VyQXV0XzIwMTAtMDYtMjMuY3J0
# MA0GCSqGSIb3DQEBCwUAA4ICAQCdVX38Kq3hLB9nATEkW+Geckv8qW/qXBS2Pk5H
# ZHixBpOXPTEztTnXwnE2P9pkbHzQdTltuw8x5MKP+2zRoZQYIu7pZmc6U03dmLq2
# HnjYNi6cqYJWAAOwBb6J6Gngugnue99qb74py27YP0h1AdkY3m2CDPVtI1TkeFN1
# JFe53Z/zjj3G82jfZfakVqr3lbYoVSfQJL1AoL8ZthISEV09J+BAljis9/kpicO8
# F7BUhUKz/AyeixmJ5/ALaoHCgRlCGVJ1ijbCHcNhcy4sa3tuPywJeBTpkbKpW99J
# o3QMvOyRgNI95ko+ZjtPu4b6MhrZlvSP9pEB9s7GdP32THJvEKt1MMU0sHrYUP4K
# WN1APMdUbZ1jdEgssU5HLcEUBHG/ZPkkvnNtyo4JvbMBV0lUZNlz138eW0QBjloZ
# kWsNn6Qo3GcZKCS6OEuabvshVGtqRRFHqfG3rsjoiV5PndLQTHa1V1QJsWkBRH58
# oWFsc/4Ku+xBZj1p/cvBQUl+fpO+y/g75LcVv7TOPqUxUYS8vwLBgqJ7Fx0ViY1w
# /ue10CgaiQuPNtq6TPmb/wrpNPgkNWcr4A245oyZ1uEi6vAnQj0llOZ0dFtq0Z4+
# 7X6gMTN9vMvpe784cETRkPHIqzqKOghif9lwY1NNje6CbaUFEMFxBmoQtB1VM1iz
# oXBm8qGCA00wggI1AgEBMIH5oYHRpIHOMIHLMQswCQYDVQQGEwJVUzETMBEGA1UE
# CBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9z
# b2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVy
# YXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046OTYwMC0wNUUwLUQ5NDcx
# JTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2WiIwoBATAHBgUr
# DgMCGgMVALo9gdHD371If7WnDLqrNUbeT2VuoIGDMIGApH4wfDELMAkGA1UEBhMC
# VVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNV
# BAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgUENBIDIwMTAwDQYJKoZIhvcNAQELBQACBQDslz1wMCIYDzIwMjUx
# MDEzMDg1NzIwWhgPMjAyNTEwMTQwODU3MjBaMHQwOgYKKwYBBAGEWQoEATEsMCow
# CgIFAOyXPXACAQAwBwIBAAICDNowBwIBAAICEp8wCgIFAOyYjvACAQAwNgYKKwYB
# BAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGG
# oDANBgkqhkiG9w0BAQsFAAOCAQEAZhqtWANzZroZ8sIphgqNM195yGiDpYIxwu01
# NlCBqG5Fqy9u0HmflyObTZ4j2TF3mfZtubh2mizqmtfGLXvFjpn9DNOMaAfW+oe+
# QtBEl9EC+hcBiKnEUwE3UHNDmwZX7gwCIe1uwEko2EQOHd9xePItghvLM1F9Y4ju
# 9mYP8zhBDmad1ugTuf3DZXciALGNcJCY316u1pEQiuoh6PI6tNoxyjDH67d1Byjq
# DzVohi0C4j/aDhIFZZoXAlm9+lKwdnSDZQhuc9GaSojDBNDSUMQrYZShZrbu0/P1
# JyukzLclvoEyALJeY1TF2QF6lrA8P141dnRvbVxCQD2eP/ZUNzGCBA0wggQJAgEB
# MIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMzAAACBNjgDgeXMliY
# AAEAAAIEMA0GCWCGSAFlAwQCAQUAoIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcN
# AQkQAQQwLwYJKoZIhvcNAQkEMSIEIGeskuJOv1umah851wTfhZTyFGqkfACNNsj2
# KlNEAJHhMIH6BgsqhkiG9w0BCRACLzGB6jCB5zCB5DCBvQQg+e14Zf1bCrxV0kzq
# aN/HUYQmy7v/qRTqXRJLmtx5uf4wgZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEG
# A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
# cm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFt
# cCBQQ0EgMjAxMAITMwAAAgTY4A4HlzJYmAABAAACBDAiBCCvXIqzoBg0TtzOUTQi
# 36eYCSFaTJQ840/HGWI1vqJfmDANBgkqhkiG9w0BAQsFAASCAgCVGuFjo3ehj49w
# gosj2COsxtmBoNwVg73thV1OpTgA/dL9HSBJUaf98Pu01Bp3SEhWkx24IMAJpnoU
# 4GRHNjcht4QGdxkDYyWsyNx4uuXrYTPQua9QMdAX4hK6pzvi1uWrpdQyr2K/wgaV
# 5EU/JsTbNo0HJSKku4850YnUjH050PfclDSnIgzdZLLnsFtmmdPiXTZW44ZtDUqb
# zjW5uPE4UC5xj7p3+kBh+MgkTIJp29LwzfHWyeToPUBwQnEKYV0ZlgTjRLTrxFS9
# BVkR4HCGHJqSpQMJPvSAZSdwGLIfIg7+9aC7EzH6ffUys3btNfa/POL7Gp1ilC3l
# a987NrbluJLuAoUxwUx5JXjcYkRxgzKGbMlAdJCKFwh1IMy2P/Ye/YscHWG0jpDC
# hOmUyzDNO2ZdPCISjZ669xGvreq7AkAZEb+Bsjrh4bH/iqKQgh+O1FqC6/2zL0tZ
# tlMK38U146x5xiaTdy5o8X7UjWJIz6v+kwzdZTPFcYi6k5a/lNvnH7Ias1CYwG+n
# F4CRIBbyNRSm9n+1F/Tvps76qWabGHZeb58cAUxVyXl1FSHfcyVe45vtxce3UNHj
# K69w548sa+7cgrO4Sv+p4L+NL0KsnB2l+b1iY3z/NUiM2pbLIavIQfDbXBKBo3xm
# U7U9Qhhyn19yaQfZ6NhE60ZbCw5dIQ==
# SIG # End signature block
