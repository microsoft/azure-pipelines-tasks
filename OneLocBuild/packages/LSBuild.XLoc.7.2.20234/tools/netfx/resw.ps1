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
# MIIo2gYJKoZIhvcNAQcCoIIoyzCCKMcCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBVL8X8G4m2vcaX
# hOv1qdrw9q9DImem2Da8A8uy57r2p6CCDcMwggatMIIElaADAgECAhMzAAAArn9k
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
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEINnegaNiGRS3pBmKVSVhtoTb
# YJ+3FKUGTTRKkFShCZqqMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAPiEikVSwvASbzoWasy1fdu2HEt9RKpK5qPvifYKkZq8sL91WjXUBaSF0
# Tx0VdyQHAqmgWzc+CRdcEeNC2bsI74wteNX/oJpm4rZPWsazk28U6Nmd6tnhAaOu
# LB/zrDLsSlKHhRkRULyX16J2BK2IKBueky486+PXx3Z3H4ImOocMW7YnNLgL2Pqd
# 1xy+XvUWLGkT1izFnlEhRHnq/19n2nNel5YylZHu8AiDashZlgQpEoOgTav14jk5
# 9o3UQgmfA2JtyXphGtwP+aZ2YF0JE5icYrt8MJwywojecrPZm+V5gJOagA9k1ooJ
# /jHwDDY64IZkyNhvknBT2FZxLWlBNFfY2TjP1uIL77KFLHNeQcsTv5Jmpuz2ovTd
# UZjlSooC7YwkaE2tEdBxQ6kY/+XfkXFRE3gV988EmGGEfuojD3MeT0+HGxYiiXK5
# L4zIKaLC0U0IShCZq0HfPP9J2ivwnSPRmBdAXxYVFljOjSMga99EdCbh8W2w9siH
# yuAAqclFoYIXlDCCF5AGCisGAQQBgjcDAwExgheAMIIXfAYJKoZIhvcNAQcCoIIX
# bTCCF2kCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEINbRnktAx56e
# HBFUScWJddHq6/BOdUaKtaR1ePdEXW0QAgZp56/S+5gYEzIwMjYwNDIzMjEwMjIx
# LjQ5OFowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
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
# SjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIBq9
# GJli33kNY0XeH7Cyu39Quvk8FaYtutLtPEx9wtn3MIH6BgsqhkiG9w0BCRACLzGB
# 6jCB5zCB5DCBvQQgBWBdAQoE58aCM2ySYM6ZtwQg6ccY3AD5BxG58NHkCRMwgZgw
# gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiJB0vaq/8i1
# /wABAAACIjAiBCAc7jx0b/N+U1ruwTY9shYrASYwxbl5w4bA1czIKRI6RTANBgkq
# hkiG9w0BAQsFAASCAgB71yQCww7DKXaeUVJGZcukZf+P+SQOulNr/EDj85cVOMRI
# o/DddWCVP0t7ROxjhY2vNDRxmHBdsLF2nybPdoZ2ljzPUZRNRMq35ElFn9ZChUIk
# gJDt0a9pVJNxTWKOIK3E1ojhRcJGvl0Rg0qGVgrrvVRUSF1GgVBiu9J9ObDnG+En
# u0p/dgkufXhEv8qPGOcO06X4XeYwpmdk17BdoVVbNIJpSjq35J6AOQhsTbmlcXl7
# so05vJCPI1SD2ehlv5wSWdL7Qk59JIvkUnsgHXEGPN2qVMWRnCIkBKYPgd8+sZBC
# 8FKMQLI2LHESO4ZVyXln4ZxqH29SpvTSGTEaHkB8zYBMUVylXn3FOrrFeCamVfpP
# +Tp6Vgd87GY+qi3/eANJOHr2KJgnM0ikyMglfoT1+wjwYTe+datbIIRn85ToHdHn
# QrN9rAJNpZc3oTw3clsIsmJJOuIID5pSygg76zqx+9fyct7aHEYObGYXaHAqRax6
# BA5JDqEjFlIy1I1dDSJxSPBXM5e4eERH7eEjtyNPKCif66WwyxaSlm3GRhQLmRLq
# BniPT5YNSqxfMuntCNhx+l9fwmAsaGmWuDEqAyHWkqOklX6bMN3c/H1RdYR+ypw/
# S4lqQjuibAkJQquAOcfOcK0ju7ScC5jQRdZI5V3PgRBLJI5NmIrllUcO6mC3jg==
# SIG # End signature block
