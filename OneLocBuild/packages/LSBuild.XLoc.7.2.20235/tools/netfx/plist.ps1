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
# MIIo3gYJKoZIhvcNAQcCoIIozzCCKMsCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCClTEmP8lNmfYuz
# zmmyiR3hRS5wY8YW+ujliy4VW5ZqNqCCDcMwggatMIIElaADAgECAhMzAAAA0wKI
# 2Gm93wIJAAAAAADTMA0GCSqGSIb3DQEBDAUAMGIxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMzAxBgNVBAMTKkF6dXJlIFJTQSBQ
# dWJsaWMgU2VydmljZXMgQ29kZSBTaWduaW5nIFBDQTAeFw0yNjAzMDUxOTA2MTla
# Fw0yNzAzMDMxOTA2MTlaMIGCMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
# Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
# cmF0aW9uMSwwKgYDVQQDEyNBenVyZSBQdWJsaWMgU2VydmljZXMgUlNBIENvZGUg
# U2lnbjCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAMmsOxnEYc0FiPlE
# +RHIYQgZmVwJCSoTtJ0ZrpzYU8Awa7Ukuoe6vyo1aNHmzB6QwyfRZLPb5ATRzzjz
# Ae+pVUulZX5SfdDTUOfLOOJ9p7iH6TOFBNQiFfaspBsYd2oF7stfIKCR8OtM0tew
# jXEBcDADjYCv4+lV3WS2otKwzqnCqsz8UV8SLOX2HmC2sQhk4On6Oj28RLEq8can
# 8h9xrt78iW4N4l98/gwT98W1TNQIsf8jB66CJRyxpOZ7BKfLih1gu2Zkr/OkG4+M
# ZMulSefgczJZctRI4WWC8WssoI9nFs3FfEGjkRSq7OsVumD02ZBWKklCwoNIo0eW
# 5PA2Jwi0WlmmI8xztjYsbXV00CKXfIkQEsUxD/lGpCm1xaaBIqgbxPHvH5EJhCPh
# KOXbIm37g7KRWf3+RDnCjq/pOYgcdmwp2aAiQwIoG4hFwHYVobAtj5QYw/XGaLAh
# p6SCNSBXBdfwq//ZJgj1deuPJQwTg0uPQlMEg7thfbTWBhg4vwIDAQABo4IBuTCC
# AbUwDgYDVR0PAQH/BAQDAgeAMB8GA1UdJQQYMBYGCCsGAQUFBwMDBgorBgEEAYI3
# WwEBMB0GA1UdDgQWBBToMh9qoEACbff9AUkZiJ9lR5AHcDBFBgNVHREEPjA8pDow
# ODEeMBwGA1UECxMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMRYwFAYDVQQFEw00Njk5
# ODErNTA3MTgxMB8GA1UdIwQYMBaAFPEvupEWfN59Uicx9Xr71VhZaTo9MG8GA1Ud
# HwRoMGYwZKBioGCGXmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3Js
# L0F6dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmlu
# ZyUyMFBDQS5jcmwwfAYIKwYBBQUHAQEEcDBuMGwGCCsGAQUFBzAChmBodHRwOi8v
# d3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL0F6dXJlJTIwUlNBJTIwUHVi
# bGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmluZyUyMFBDQS5jcnQwDAYDVR0T
# AQH/BAIwADANBgkqhkiG9w0BAQwFAAOCAgEAokRajG6jg8NQ4+ul6plkF1wQGMih
# hBmNK8QgxN3R9x/z2tY39+vpxsCzd9m1HUtDaRFajaZiLGYBCmbqKMBi7dCD780g
# eh++I5UIOoeZpAYSLCKgGxvsS31XsH2uqySwmyVPIIlQli4hdoq/fuy48LtwWldp
# pZo0ufSO7PWw8p2SW9M7bd/BxqGBE72ep32BOL2Pp3D+cQlRFajfZ2X6vF3KWe5F
# 3pEemQkp2U9VdGuv9kvyxvJqSgJQ3jM1WK9QwuZSylhEkhXZOmRmidCeuZObpOlc
# ZWAKOPnp25PNVr8ZEAotUEc2byN7p6yOCizC/p4eZiSaAlGO9n54c2Wgudd+oHKD
# cLEnQZ36eNrlFNq9imUhz3N86Co2Dl7o1bwTRD8AjXXlZ+kz6dxZ6dap0+zVguKf
# JR1EPGINOaFhPI3WncWiMa3Iz6atBUi8LaXzNCv8s0JO/P92PaFaqwX/tIOcrjAT
# zXZgCnqk9+C2voF9UPQswm76zp/Y9d6guyQDgBzY+gnPk3sWZ5jtafmyFkF/iE6o
# Imyx3lkGlRu0ZiHeIKdBIk/0SiSjFXF7sPkeaSpNE2deogNDnNbpsvdIMJgUQbkR
# a2pX1i13QyOmXH+zn7DVOdhtcgps/OLgedvdevSbxicy5XKGbEbIdnYKMylByWCh
# yzZA2w7Kvt68sYMwggcOMIIE9qADAgECAhMzAAAAArLEk4h4WezTAAAAAAACMA0G
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
# cTCCGm0CAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVibGljIFNlcnZpY2VzIENv
# ZGUgU2lnbmluZyBQQ0ECEzMAAADTAojYab3fAgkAAAAAANMwDQYJYIZIAWUDBAIB
# BQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIMvB0hHsHFmM/oV473+OB5nA
# /TnzI4Bdtq4uCkRjwkTsMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAh1UiO5dfhV5tHkGFuZZF67NKv8n8Ga522PRWCYjNECvIWtRiPNNfyvsm
# zw4WCXjfgzdAZSwrTJs5rjWM2KdKsh03I85e1vADcsK8icIGBH5EQDuOAD/njhgx
# i0Tn+Y8NKQUC3uK+KDUiN4GMbHOnXMO7wiOw20071rskiPVfa0XWdG33m6rmAv+N
# S3jxsvmEuOKCO+PTseTEw7v2th9RnDI3PHzeYeoKNXOZnO/ThcUTWcybGDNI6CYG
# YO049RXg1PyWiUBaFf4hEG07dJIRYubgQzMFjhiT5lS+JebcyBtdOK9CnljHuQX6
# YiMstWdvUxv4h0McUDKrAUHPaWpmtGPx+LGQbF8SCW0KHpzlB6Byk4aO3/z/wlLs
# SoNHMUIIcNo7qiSiclaGDRfgJAht9mgStZnuNeV4im4d6oyaBgi59+OXI2zFRQRa
# 5smDd2GJgBQihzVdJX3Sn88L+iwEsKHm0Y2gOT5dnj6JPpP4+gka39YvcEeadkg2
# g7K/CSRcoYIXmDCCF5QGCisGAQQBgjcDAwExgheEMIIXgAYJKoZIhvcNAQcCoIIX
# cTCCF20CAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEIOE+V4VPee9m
# laayLfbYokOzzZKkNtr4GwlB6FnG5JgCAgZp+0cZTIMYEzIwMjYwNTIwMTgzNTE4
# LjM1N1owBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjo5MjAwLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEe4wggcgMIIFCKADAgEC
# AhMzAAACI0/ZYCRTz/4rAAEAAAIjMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk1N1oXDTI3MDUxNzE5Mzk1
# N1owgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjo5MjAwLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# AIrpDaeTlZR0rNIJJp+n5SNQBGxbEcpLresmEUL/NJpsW6ZMG5onRA2uap6+5vkN
# vt9KPmq3DAqeMg73b4dcXrvX3Z+6MvsMWi3lYSP8C0Rn9evMUeKYqU3WHqARDA/k
# jrvCLNo9blnNIE2losGDmge8BI85m3B01Shn4NAoXeEmXUpm6giVUr6qLtwuOBqT
# qzmg5lxEIysqe4LdqhVrrBENti8pS6PuuQXH0o7Q+wcn+T4udkyCBGF6HgBV1rDK
# H6g7Mo+OVAZQ19J5ZSDKbZT0Itry23SZBfgPEPPr6tqbnSCPWgB/JDpNDuv3o8AM
# U4oGBpTv5ykedpkbz11N6BDrJ0FEYjJw7DV1FfZ4oNFHPOIrdyfRZoib/s54azJA
# qMjMRC5RMO/QmP/3NDu2u4s46kkP3wElU4ruN7zhLPaFvce9RJPuPWPY3yl4PqiW
# SkUdH/VnwnPgX6aStQXsyY8CKtgdHO6dsiDcesMw3AVg3vIGQMDj9Uyj0JjTL2gZ
# SirbKNsLBOJvP1ViX3ecHdBCJMJP2dbcz5M5YH48ytmkTGrUFIeYo/Mip6EqqtQO
# gzfc8r50QrClgsRPq5erge5BExdZP/+w+5tSdABppQx9CEBlLLbce3HC03d4r35P
# jAJq/bBAW3nt5Q7BRbn8MLMwX225rkd7WE2+BwBdqIbXAgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU1sCHz2/b2c9j1vBBvVBgLPFWB5cwHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBAIdDB7vPm2ng1nAB/VwH7hz0niy/Dc/paoYEzG2rOdLoN3NTNK1ccJo9
# mEzjWDWIoc2eZycuPAu6M4Ro2OFKdQOIBmpCNbllqk4HGBzsSCCGH2T6vvypYB7e
# snhCiEFuFIZ1m0qK9NFp5GqaeHLz5OGsqHMJ4TBpqtcmKZnBKl1BBQNuF5Yd7IDE
# BKq6W13ko7Sb9QW87Te196moZcDi0KD9YYQLAqo6MnOlEB88gHrLUfJWuT6+Yvmu
# kRtPDAs61ftbEUYbz5xguT0eNoOTGtoD8diUpBHHWx3Nr7D+C6UvCA6cHJEkoXau
# vwzsU0iXCiLrLAWlo1zwDsd7BoaODD+19wTbrQjVd6QaW4A0j0ec405haUjsEoFB
# tYTa16jq+xDVWDwHytNlJ49V2ZcvU8+qqzcpV0UozmRihw8IMz7pUvfYhX3qwRJ/
# ZPsOPFqekKDYPZRiPhnWLtzLxTUssMaDnkpazhp/ZFEGMfYy6UeACZbmhsrGJkIN
# CNFqugnZcSVdSGKAT0HO+EIVtP8cNja+lWmXkedKlwJLGYvmLmUhP/FsBAwjsu6H
# vleub4iyV8VY4Y4YyUKn7bioQkSCVcQ/vHCyiU10E2d1eKGHIh59UaUjUNHvEYQu
# ImuTyJ9VZij1cRsRe/+Vu+noXZHZSyfB5ZyS+rTLUdacscOofp0+MIIHcTCCBVmg
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
# f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA1EwggI5AgEBMIH5oYHRpIHO
# MIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
# UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQL
# ExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxk
# IFRTUyBFU046OTIwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVADhFYWz6ROJmehmICPUG1iPz
# MI1qoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDtuDi2MCIYDzIwMjYwNTIwMTM0MjE0WhgPMjAyNjA1MjExMzQy
# MTRaMHgwPgYKKwYBBAGEWQoEATEwMC4wCgIFAO24OLYCAQAwCgIBAAICOxsCAf8w
# CAIBAAIDAQMHMAoCBQDtuYo2AgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQB
# hFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEB
# ABJr+MVdUPNqu2rMcrIcIPDKSpUX34z5UvvlUunXvRRdOXrD1VfhEI2s2AILYLg2
# CF1HRNPciD4I4LPvgvsWOekqsvD8+QFZcc0X1+qej2FTLUuBbzQ2+fVp1W9tylYE
# brsuh1qEVabt0eXLRknv4/rTUvwF9/wthRGhJSzGk3FyBbvaJ8Nm0KXJyQxh6ZVF
# qVfty5elsu5wEPtN/D5EzIVVUZYOHpHNPR4/rA1Atrg5SQHgtbnWfyrlFZGqJ/ON
# lrSemqnh+cewxr0PYeyQDb2ojOWh4oHpBvh0jdUNngWt34/iwNZ+Sd8iKHiasLdh
# orbg8FxrzZkL+phlkfYGHiIxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzET
# MBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMV
# TWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1T
# dGFtcCBQQ0EgMjAxMAITMwAAAiNP2WAkU8/+KwABAAACIzANBglghkgBZQMEAgEF
# AKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEi
# BCBg8bzEWl2hFTQAW5QxR/7eBlLoM+BTOVehLkVLoIJzVzCB+gYLKoZIhvcNAQkQ
# Ai8xgeowgecwgeQwgb0EIJbwMywRbvcGiynjnwjAqcaD47yYvebKZRAvtEAR5u6z
# MIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
# BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEm
# MCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIjT9lg
# JFPP/isAAQAAAiMwIgQgV78r+/+U4mau/1HANoDZ1A0H3uNRkUMJ4cnJlU7QgA8w
# DQYJKoZIhvcNAQELBQAEggIAVNZ6n/7JzMEcvDpcHLbzet5bXOAIKSkGibTY0iPT
# c6JJ5AeuI+yJlhR92is6ZPAWkf4WeoHO7GtxCaF0HYOWH+gZD7w3D2rNbtiy1Q3a
# 4eFBhhYYyLpcrR5Mh96LYykyqB7PCKsZsHUZloohDhwJdtXi+ZuBWD6RVHjDVYwZ
# Zm+y4bJEZNzosmOlDGwMycey46LEfL9wXwObUroiJzQl/jVapbhdS7b8pEVxH1I6
# Kedx+hZs/tAVrOeY/1uo480e4jKambs/8P3zbJ1G+f2PalAYLF9/7F6fkcg9achR
# zGXeeDs+zIaWaCnRpCwl/CNlmIf45wEKwxCB/WwPwdGbB/1esdi8WPNS7IfbJoPb
# nqMVu+isi3mNFwy652y02zDw+n/4MY1t6VhjSck1mqOeORx5oFDClkb6UKz4gtdK
# pICLSAMGs9gx2HLGJLboj0pdNzRCl+4r0XGWyGpuojptkDBI6PQOxb+nJ268oMOD
# OwK/fpo5itO4BDtctnKZILv3xmjzeo6c30mhNUFbRli0NEwaMUYBjxmVYdJvWqVT
# /b9d0cgxX8iUEMAN6FQqzOFZZxszNXa26odjRrQgdT6I4QaiRmylQDi5UrdD2RUG
# aGqBZcihPegA6sESSRyDYQeMvIJX/9qPiT+p+8IqUpDPpaRAfML7qg/Uo4KptE1z
# RpQ=
# SIG # End signature block
