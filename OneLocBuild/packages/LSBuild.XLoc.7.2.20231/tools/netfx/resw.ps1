<#
.DESCRIPTION
    Resource parser for .resw files with ICU plural format.

.NOTES
    Version 1.6

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
    ParserId=466
#>

# Debug
#
<#
# Default output file gets deleted by the parser.
#$filePath = "C:\test\resw\Resources.resw"
$filePath = "C:\test\resw\test.resx"
$debugFilePath = "$($filePath).debug.resw"
Copy-Item $filePath -Destination $debugFilePath
$filePath = $debugFilePath

$isGenerating = $true

class TargetString {
    [String]$String
}

class LSItemClass {
    [TargetString]$TargetString
}

class ParserStub {
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType) {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating) { 
        Write-Host "Comment='$comment'"
        Write-Host "id='$strResID', text='$resStr'"
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [string]SubmitResource([int]$parentDBID, [ref]$childDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [int]$stringType, [int]$iconType, [bool]$devSourceLock, [string]$comment, [string]$termNote, [bool]$isGenerating) { 
        Write-Host "id='$strResID', text='$resStr'"
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [hashtable]SubmitResource([int]$parentDBID, [ref]$childDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [int]$stringType, [int]$iconType, [bool]$devSourceLock, [string]$comment, [string]$termNote, [bool]$isGenerating, [bool]$parseHotKey) { 
        Write-Host "id='$strResID', text='$resStr'"
        $lsitem = @{}
        $lsitem.TargetString = "[ソボミダゾ$resStr !!! !!! !!! ]"
        $lsitem.TranslationStatus = [ManagedLSOM.ELSTransStatus]::elsLocalized
        $lsitem.IsLocked = $false
        $lsitem.UserSourceLock = $false
        return $lsitem
    }

    [void]SetParserID([int]$parserId) {
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
            // src\sdktools\LocStudio\DinoSource\OM\LSOM\OMIDL\OMIDL.idl
            public static int elsIconExpandable = 4;
            public static int elsIconString = 9;
        }
        public class ELSStringType 
        {
            public static int elsStrText = 1;
        }
        public class ELSTransStatus 
        {
            public static int elsNotLocalized = 1;
            public static int elsTransStatusUpdated = 2;
            public static int elsLocalized = 4;
            public static int elsTransStatusNotApplicable = 5;
        }
    }
'@

$this = New-Object ParserStub
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo("ar-SA")
$scriptRoot = $PSScriptRoot
#>

Add-Type -Path $ScriptRoot/ICUParserLib.dll

# Read the .resw file.
[xml]$resw = [xml]::new()
$resw.Load($filePath)

# Create the parent node using the src file name.
[int]$childDbid = $parentDbid
[string]$srcFileName = [System.IO.Path]::GetFileName($srcFilePath)
$this.SubmitNode([ref]$childDbid, 0, 0, $null, $srcFileName, $true, $true, [ManagedLSOM.ELSIconType]::elsIconExpandable)

# Create the sub parent 'Strings' node.
$this.SubmitNode([ref]$childDbid, 0, 0, $null, "Strings", $false, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Check if the language is supported.
if ($isGenerating -and -not [ICUParserLib.ICUParser]::IsLanguageSupported($langCultureInfoTgt)) {
    # If the language is not supported, the ICUParserLib will fall back to the en-US plural range
    # when ComposeMessageText() is run and the language Locked instructions are wrong.
    $this.LogWarning("The language '$($langCultureInfoTgt.Name)' is not supported by the ICUParserLib. This might result in invalid plural ranges for that language.")
}

# Process all 'data' nodes.
$resw.root.data | % { 
    if (-not $_.Attributes["type"]) {
        [string]$id = $_.name
        [string]$text = $_.value
        [string]$comment = $_.comment

        # Setup the ICU message format parser.
        [ICUParserLib.ICUParser]$icuParser = New-Object ICUParserLib.ICUParser $text
        if (-not $icuParser.Success) {
            # Add warning message if the content could not be parsed correctly.
            # The content is parsed as literal content.
            $errorMsgs = $icuParser.Errors | % { $_ }
            $this.LogWarning("The resource '$text' with id '$id' does not follow the ICU parser syntax ($errorMsgs) and is used as literal content.")
        }

        # Process the message text using the ICU message format parser.
        $messageItems = $icuParser.GetMessageItems()

        # Add item as dev locked resource for context. 
        if ($icuParser.IsICU) {
            [string]$lockedParentStringComment = "Parent string for ICU MessageFormat."
            [string]$icuId = "$id.icu.content"
            [int]$dbid = 0
            $this.SubmitResource($childDbid, [ref]$dbid, 1, $null, $null, $icuId, $text, [ManagedLSOM.ELSStringType]::elsStrText, [ManagedLSOM.ELSIconType]::elsIconString, $true, $lockedParentStringComment, "", $false)
        }

        # Get the loc status. Only localized (not locked) items will be in the generated file.
        [bool]$localized = $false

        # Process the result of the ICU  message format parser.
        foreach ($messageItem in $messageItems) {
            [string]$msg = $messageItem.Text
            [string]$instruction = $comment

            # Add locked substrings for ICU resources.
            if ($icuParser.IsICU) {
                [string]$lockedSubstrings = $messageItem.LockedSubstrings | % { " {PlaceHolder=`"$_`"}" }
                $instruction += " (ICU)$lockedSubstrings"
            }
        
            if ($messageItem.Plural) {
                # Add comment for the plural.
                $instruction += " [Add language specific translation for the plural selector '$($messageItem.Plural)'.]"
            }
    
            # Add language specific lock.
            if ($messageItem.Data) {
                $instruction += " {Locked=$($messageItem.Data)}"
            }

            [string]$msgId = $id
            if ($messageItem.ResourceId) {
                $msgId += "#$($messageItem.ResourceId)"
            }

            [int]$dbid = 0
            [hashtable]$lsitem = $this.SubmitResource($childDbid, [ref]$dbid, 0, ".resx", $null, $msgId, $msg, [ManagedLSOM.ELSStringType]::elsStrText, [ManagedLSOM.ELSIconType]::elsIconString, $false, $instruction, "", $isGenerating, $true)

            if ($isGenerating) {
                $messageItem.Text = $lsitem.TargetString

                # Get the loc status of the item.
                if ($lsitem.TranslationStatus -eq [ManagedLSOM.ELSTransStatus]::elsLocalized -and -not $lsitem.IsLocked -and -not $lsitem.UserSourceLock) {
                    $localized = $true
                }
            }
        }

        if ($isGenerating) {
            # Include only localized (not locked) resources.
            if ($localized) {
                try {
                    [string]$messageText = $icuParser.ComposeMessageText($messageItems, $langCultureInfoTgt)

                    # Validate generated ICU content.
                    if ($icuParser.IsICU) {
                        [ICUParserLib.ICUParser]$icuParserGenerated = New-Object ICUParserLib.ICUParser $messageText
                        if (-not $icuParserGenerated.Success) {
                            $errorMsgs = $icuParserGenerated.Errors | % { $_ }
                            $this.LogError("The generated resource '$messageText' with id '$id' is not a valid ICU format message:'$errorMsgs'")
                            return
                        }
                    }
        
                    $_.value = $messageText
                }
                catch {
                    throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$id'`nTranslation: '$messageText'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
                }
            }
            else {
                # Exclude the not localized item.
                [void]($resw.root.RemoveChild($_))
            }
        }
    }
}

if ($isGenerating) {
    # Save .resw as UTF-8 with BOM.
    $resw.Save($filePath)
}

# SIG # Begin signature block
# MIIr8wYJKoZIhvcNAQcCoIIr5DCCK+ACAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBVL8X8G4m2vcaX
# hOv1qdrw9q9DImem2Da8A8uy57r2p6CCEX0wggiNMIIHdaADAgECAhM2AAACAR26
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
# RtShDZbuYymynY1un+RyfiK9+iVTLdD1h/SxyxDpZMtimb4CgJQlMYIZzDCCGcgC
# AQEwWDBBMRMwEQYKCZImiZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1F
# MRUwEwYDVQQDEwxBTUUgQ1MgQ0EgMDECEzYAAAIBHbrxII1Q4GgAAgAAAgEwDQYJ
# YIZIAWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYB
# BAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEINnegaNiGRS3
# pBmKVSVhtoTbYJ+3FKUGTTRKkFShCZqqMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBN
# AGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJ
# KoZIhvcNAQEBBQAEggEAB59iWCo2PfCDpkFKA9Qyo+RBrq8VQBXPeQxclgsJCZsE
# L6evmMxl+TYCfn4fqV7qOQx7xYUO6xxfkHczEv/R26PuYGusHmd6mSlapWcGU0Ct
# sWr5odtzDeyauI8kvLZ+rbcZoEuxP/MnmOai79yya+zdVRjAibLYA5HgRHmFv28Z
# mWcCx9NNHaKKoqt3nzPapSlpfQePHPDjvBZMdjPiNIWU0C5EYROLrvIZsFl1QZd7
# juroDFjnchudM5PW/mLeLij+ypTjaCMRcxRvsQMCqOGF2C82f7oFwnae3oYtGDla
# fPgJfo3PPgWpUytmEMli/KPtrQa5frsis18OIW/6fKGCF5QwgheQBgorBgEEAYI3
# AwMBMYIXgDCCF3wGCSqGSIb3DQEHAqCCF20wghdpAgEDMQ8wDQYJYIZIAWUDBAIB
# BQAwggFSBgsqhkiG9w0BCRABBKCCAUEEggE9MIIBOQIBAQYKKwYBBAGEWQoDATAx
# MA0GCWCGSAFlAwQCAQUABCD+owUh+Xrwamk2Rl3jTLhu0lAtIfN/DfvNQUUXWq/3
# OQIGaNr1e80vGBMyMDI1MTAxMzE4NDI0NC45NjlaMASAAgH0oIHRpIHOMIHLMQsw
# CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
# ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNy
# b3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBF
# U046OTYwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFNlcnZpY2WgghHqMIIHIDCCBQigAwIBAgITMwAAAgTY4A4HlzJYmAABAAACBDAN
# BgkqhkiG9w0BAQsFADB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
# bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
# aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0y
# NTAxMzAxOTQyNDdaFw0yNjA0MjIxOTQyNDdaMIHLMQswCQYDVQQGEwJVUzETMBEG
# A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
# cm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBP
# cGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046OTYwMC0wNUUwLUQ5
# NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2UwggIiMA0G
# CSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDw3Sbcee2d66vkWGTIXhfGqqgQGxQX
# Tnq44XlUvNzFSt7ELtO4B939jwZFX7DrRt/4fpzGNkFdGpc7EL5S86qKYv360eXj
# W+fIv1lAqDD31d/p8Ai9/AZz8M95zo0rDpK2csz9WAyR9FtUDx52VOs9qP3/pgpH
# vgUvD8s6/3KNITzms8QC1tJ3TMw1cRn9CZgVIYzw2iD/ZvOW0sbF/DRdgM8Udtxj
# FIKTXTaI/bJhsQge3TwayKQ2j85RafFFVCR5/ChapkrBQWGwNFaPzpmYN46mPiOv
# UxriISC9nQ/GrDXUJWzLDmchrmr2baABJevvw31UYlTlLZY6zUmjkgaRfpozd+Gl
# q9TY2E3Dglr6PtTEKgPu2hM6v8NiU5nTvxhDnxdmcf8UN7goeVlELXbOm7j8yw1x
# M9IyyQuUMWkorBaN/5r9g4lvYkMohRXEYB0tMaOPt0FmZmQMLBFpNRVnXBTa4haX
# vn1adKrvTz8VlfnHxkH6riA/h2AlqYWhv0YULsEcHnaDWgqA29ry+jH097MpJ/FH
# GHxk+d9kH2L5aJPpAYuNmMNPB7FDTPWAx7Apjr/J5MhUx0i07gV2brAZ9J9RHi+f
# MPbS+Qm4AonC5iOTj+dKCttVRs+jKKuO63CLwqlljvnUCmuSavOX54IXOtKcFZkf
# DdOZ7cE4DioP1QIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFBp1dktAcGpW/Km6qm+v
# u4M1GaJfMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8GA1UdHwRY
# MFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01p
# Y3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBsBggrBgEF
# BQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
# a2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
# MSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgwDgYD
# VR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQBecv6sRw2HTLMyUC1WJJ+F
# R+DgA9Jkv0lGsIt4y69CmOj8R63oFbhSmcdpakxqNbr8v9dyTb4RDyNqtohiiXbt
# rXmQK5X7y/Q++F0zMotTtTpTPvG3eltyV/LvO15mrLoNQ7W4VH58aLt030tORxs8
# VnAQQF5BmQQMOua+EQgH4f1F4uF6rl3EC17JBSJ0wjHSea/n0WYiHPR0qkz/NRAf
# 8lSUUV0gbIMawGIjn7+RKyCr+8l1xdNkK/F0UYuX3hG0nE+9Wc0L4A/enluUN7Pa
# 9vOV6Vi3BOJST0RY/ax7iZ45leM8kqCw7BFPcTIkWzxpjr2nCtirnkw7OBQ6FNgw
# IuAvYNTU7r60W421YFOL5pTsMZcNDOOsA01xv7ymCF6zknMGpRHuw0Rb2BAJC9qu
# U7CXWbMbAJLdZ6XINKariSmCX3/MLdzcW5XOycK0QhoRNRf4WqXRshEBaY2ymJvH
# O48oSSY/kpuYvBS3ljAAuLN7Rp8jWS7t916paGeE7prmrP9FJsoy1LFKmFnW+vg4
# 3ANhByuAEXq9Cay5o7K2H5NFnR5wj/SLRKwK1iyUX926i1TEviEiAh/PVyJbAD4k
# oipig28p/6HDuiYOZ0wUkm/a5W8orIjoOdU3XsJ4i08CfNp5I73CsvB5QPYMcLpF
# 9NO/1LvoQAw3UPdL55M5HTCCB3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAA
# ABUwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290IENlcnRpZmljYXRlIEF1
# dGhvcml0eSAyMDEwMB4XDTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIyNVowfDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
# bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
# cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEBAQUAA4IC
# DwAwggIKAoICAQDk4aZM57RyIQt5osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/
# bErg4r25PhdgM/9cT8dm95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjoYH1qUoNE
# t6aORmsHFPPFdvWGUNzBRMhxXFExN6AKOG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2
# Nr41JmTamDu6GnszrYBbfowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v3byNpOOR
# j7I5LFGc6XBpDco2LXCOMcg1KL3jtIckw+DJj361VI/c+gVVmG1oO5pGve2krnop
# N6zL64NF50ZuyjLVwIYwXE8s4mKyzbnijYjklqwBSru+cakXW2dg3viSkR4dPf0g
# z3N9QZpGdc3EXzTdEonW/aUgfX782Z5F37ZyL9t9X4C626p+Nuw2TPYrbqgSUei/
# BQOj0XOmTTd0lBw0gg/wEPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlMjgK8Qmgu
# EOqEUUbi0b1qGFphAXPKZ6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJNmSLW6CmgyFd
# XzB0kZSU2LlQ+QuJYfM2BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzFER1y
# 7435UsSFF5PAPBXbGjfHCBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIurQIDAQAB
# o4IB3TCCAdkwEgYJKwYBBAGCNxUBBAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS
# /mTEmr6CkTxGNSnPEP8vBO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWnG1M1Gely
# MFwGA1UdIARVMFMwUQYMKwYBBAGCN0yDfQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6
# Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5Lmh0bTAT
# BgNVHSUEDDAKBggrBgEFBQcDCDAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTAL
# BgNVHQ8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+ii
# XGJo0T2UkFvXzpoYxDBWBgNVHR8ETzBNMEugSaBHhkVodHRwOi8vY3JsLm1pY3Jv
# c29mdC5jb20vcGtpL2NybC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0y
# My5jcmwwWgYIKwYBBQUHAQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8vd3d3Lm1p
# Y3Jvc29mdC5jb20vcGtpL2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNy
# dDANBgkqhkiG9w0BAQsFAAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv6lwUtj5O
# R2R4sQaTlz0xM7U518JxNj/aZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6
# th542DYunKmCVgADsAW+iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1bSNU5HhT
# dSRXud2f8449xvNo32X2pFaq95W2KFUn0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnD
# vBewVIVCs/wMnosZiefwC2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU6ZGyqVvf
# SaN0DLzskYDSPeZKPmY7T7uG+jIa2Zb0j/aRAfbOxnT99kxybxCrdTDFNLB62FD+
# CljdQDzHVG2dY3RILLFORy3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/HltEAY5a
# GZFrDZ+kKNxnGSgkujhLmm77IVRrakURR6nxt67I6IleT53S0Ex2tVdUCbFpAUR+
# fKFhbHP+CrvsQWY9af3LwUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmN
# cP7ntdAoGokLjzbaukz5m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9JZTmdHRbatGe
# Pu1+oDEzfbzL6Xu/OHBE0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNY
# s6FwZvKhggNNMIICNQIBATCB+aGB0aSBzjCByzELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3Bl
# cmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOjk2MDAtMDVFMC1EOTQ3
# MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYF
# Kw4DAhoDFQC6PYHRw9+9SH+1pwy6qzVG3k9lbqCBgzCBgKR+MHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUAAgUA7Jc9cDAiGA8yMDI1
# MTAxMzA4NTcyMFoYDzIwMjUxMDE0MDg1NzIwWjB0MDoGCisGAQQBhFkKBAExLDAq
# MAoCBQDslz1wAgEAMAcCAQACAgzaMAcCAQACAhKfMAoCBQDsmI7wAgEAMDYGCisG
# AQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMB
# hqAwDQYJKoZIhvcNAQELBQADggEBAGYarVgDc2a6GfLCKYYKjTNfechog6WCMcLt
# NTZQgahuRasvbtB5n5cjm02eI9kxd5n2bbm4dpos6prXxi17xY6Z/QzTjGgH1vqH
# vkLQRJfRAvoXAYipxFMBN1BzQ5sGV+4MAiHtbsBJKNhEDh3fcXjyLYIbyzNRfWOI
# 7vZmD/M4QQ5mndboE7n9w2V3IgCxjXCQmN9ertaREIrqIejyOrTaMcowx+u3dQco
# 6g81aIYtAuI/2g4SBWWaFwJZvfpSsHZ0g2UIbnPRmkqIwwTQ0lDEK2GUoWa27tPz
# 9ScrpMy3Jb6BMgCyXmNUxdkBepawPD9eNXZ0b21cQkA9nj/2VDcxggQNMIIECQIB
# ATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAgTY4A4HlzJY
# mAABAAACBDANBglghkgBZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3
# DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCDhi0loAghAFxuoi50LoikHn1RCl3TvxUzR
# +hAQt5xJJDCB+gYLKoZIhvcNAQkQAi8xgeowgecwgeQwgb0EIPnteGX9Wwq8VdJM
# 6mjfx1GEJsu7/6kU6l0SS5rcebn+MIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
# bXAgUENBIDIwMTACEzMAAAIE2OAOB5cyWJgAAQAAAgQwIgQgr1yKs6AYNE7czlE0
# It+nmAkhWkyUPONPxxliNb6iX5gwDQYJKoZIhvcNAQELBQAEggIA3IcKrOf/J7IB
# 1rXOVcS2IGD0CJDvibiHwfcc5emvK/8LCHalu9xIIsCYe24l6noF6uLj6p96RzD5
# 6vfEVZM0XHQ0vmkmYUrvC/r1gCKXQhO6y2Z4kDGqLaJiGLKcy0H9/6RrrAxNDEOt
# MHXBn5C5PJEYUpRyxwWsK+vNMW2wodGFritOPVWP2arkMEwK7dDsPmazptc29fGg
# jpBrCw8RXs8jrB+GBpsiqa59yIzpxOxS6S5mpS2IdiwklJ0AvQ9nYHk9EExeOQ0c
# +hGlwOFVs2yUQqa32xAkbnxSoyDnquq2f0IRwgDU+Wi9BteI40L4bs61olP9EWgO
# epP3PLERB/pr/dZpu3W+OgNNWHDWJWfRsWZAy027VXkyfKGulQYMfqIRQ/mjNKJm
# wVRjyCHXdmXuSGZRF6q0mTkdGcHkzgQ2H+YRIv3+JTm2dLlie46v1+oc6G9fRT7J
# wKySIkkiSVJo2xl+y/RArEKdlM40sFai5Vs2P//Z7rsC5bsmJ83khfy7JHQNOvXc
# qZxlyg2l0WlbB6eYh9fpwk0+B0pRvWdxlNtkKDXxYJ9l4kS6BBS7eUReDNebqj/r
# Z5OWWh9VLEzlndBaHbb8oqQnZghj4tMei91uE1oZnE0PGsmSzclLgOM5OYRc4Chq
# rSyDgu0dgP8ek8jmtUu2OtjsgMWAS/E=
# SIG # End signature block
