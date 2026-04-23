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
# MIIo3AYJKoZIhvcNAQcCoIIozTCCKMkCAQExDzANBglghkgBZQMEAgEFADB5Bgor
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
# bzCCGmsCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
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
# yuAAqclFoYIXljCCF5IGCisGAQQBgjcDAwExgheCMIIXfgYJKoZIhvcNAQcCoIIX
# bzCCF2sCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEINbRnktAx56e
# HBFUScWJddHq6/BOdUaKtaR1ePdEXW0QAgZp522XgDgYEzIwMjYwNDIxMTc0NDI3
# LjgyOVowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjpBOTM1LTAzRTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEewwggcgMIIFCKADAgEC
# AhMzAAACJ9XAg8OxLlctAAEAAAInMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5NDAwNFoXDTI3MDUxNzE5NDAw
# NFowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjpBOTM1LTAzRTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# AOLFbLV8M5IviqPcDWlp3L56UgMvCcXdS4vMkg5bAYdwSCvHHC2fK+JQgOabHKVN
# SXW77asE+nbNPgHDBCG8ZomkTGq88uUMWVt+ZJ+Uojzp4Wqh+JnuPw1NE7iXvAaD
# 02Ob6a41q5NwVbap18iMoT3nQ6Sub0ycw4ZjL5+Js1h3FM9E+rVPgwtkreze90zI
# wQ6V1w5CRIqnEPr/UaTqA6YK7YqAjx/R7Hq9jGcoOX1bQ4tIRr/rLzaghuyb7VAG
# J85DjvFYpMbUKa+0avzkvMDvn8wBxSZHDn+h/+oRPRQVXVa6UxwmsjoMBICw0I0H
# 7pYuui24FkCP5UyWpuflExnpDghjsnBoCIheHtWPGufBQ5hkbxYQaF+sD3x2L7ss
# Sf0Cq+8Q7Ib5RByNWEIJswZeKAldICl7J5a6kKwPSOBAw0LF8HkEsENbGB1jd0kE
# Q+DF+SBMNAsGCC1W/Z3kJjEcqAgi0Hhsjl5JvmOQgbZai2cV61PSV6CnD8SjPB/f
# 1qjq0Q1jbV5VYjNHD8aya/CNhAXq9WvE4PSkZWx+oYXyzdU95juEjZPEcUyo0DQg
# H9rY0tjslPFgAoA//XUQlm3vFuoMsyAPVgN0YTMalCKObecA8IvYJ5s/+Oa73Rps
# nZbjbnKCUYdMj+cIGvBKl9EKDDOt8V6UloIozr7floV/AgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU0tbnw3gwZIbq53uNaqBP3ait9F4wHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBACqdy53g9ILW15vYfqdG7LuwOIorXcVcmKtUHhN/CN2jYxv5AviPvBn+
# Tgb0/QIA0dkWsNBwrRUUNPKyti7xnQCFrXhpwNk+zIig+8AZFGFocS5/s1yRGOR9
# r/KWjUrIgjyNsv032wkCoE8vxXgU0GOWO/7UYcM7DXbutnPllJM+gA9vZIDS/nIO
# BylQx/GCU/Knpyc8+hClO0P04bHwPCbY/6jVM/EEjLojRP1Fq66WiBUK8rB+V94t
# NwoC+dIbWsKN6tJeZTUM1c6wAP9uytKOBtfmYBsPtdNEwX+9rABYRIVyf8GOOLPF
# 5ZlvTRphKWQkDatW0WUwzjzVpVZd0Btc8/lHNSJZOWDId/8buULEdhYYhm4HXdPd
# ojpjyYSCf+i7jRqIUmjyvT6LQ/kZ02d5a3GJHQIwpR+Sj7mz/vdzB7VZ+nwEpdrb
# vRyJxVBqwV/mxFXukWb5Xt81FfAK7tqdM6aBrvrM7v/a37M6WJu+mFP5Dpl34Hap
# ixKfjEFpj5jMemfJwtbly8nKE/EEJxvWhFh+FHMIANva60jYS0YKNzY/aKLgvJHh
# Axv+fxw7B4v0ipVMorPNWT7NknFXe+ungvK5BfDQ7fSVroFwd00AAAH1QLzfOzcb
# 134CUh9ksz3u0xQ0paNsGkiKsXHotMMVdW1lB3uGrMtgHKNuMfS6MIIHcTCCBVmg
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
# f9lwY1NNje6CbaUFEMFxBmoQtB1VM1izoXBm8qGCA08wggI3AgEBMIH5oYHRpIHO
# MIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMH
# UmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQL
# ExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxk
# IFRTUyBFU046QTkzNS0wM0UwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVACMfOq2E/A7QYNyQMwDrHniU
# iIwqoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDtkewPMCIYDzIwMjYwNDIxMTIyOTAzWhgPMjAyNjA0MjIxMjI5
# MDNaMHYwPAYKKwYBBAGEWQoEATEuMCwwCgIFAO2R7A8CAQAwCQIBAAIBJAIB/zAH
# AgEAAgISEjAKAgUA7ZM9jwIBADA2BgorBgEEAYRZCgQCMSgwJjAMBgorBgEEAYRZ
# CgMCoAowCAIBAAIDB6EgoQowCAIBAAIDAYagMA0GCSqGSIb3DQEBCwUAA4IBAQBh
# ngZ2OmRdC8f6JZYXkSqlbA2hUsZf7JDghxt2sXQasjb9jGkxjK+4e0aVQApMiOEq
# bC/NKJ+wM8m5fIa6zvCcL3MExwsyk8NaxAQ2s1WDxfyJncVTATXeIrw5teGXaH79
# 20/1PkepSGPV1LKIyouTBiuB08RaXKF3AfGB3YPiZNDMcwYaDFZ9I6hWYJ/xJX82
# 4VOby4Kp1nTdIkGVC+DiAMMM2ZeQCzeVKh1/1Ty6rCzApvkK/cVDXn+AY1Nlum/N
# FtQrJij2YJj5dsci8FybasFRp4OA/aMcQKxVHzpL8VqTPXMb6yZ4uLDirHJJnym+
# ACl0GuBrncSkc1NMWX7bMYIEDTCCBAkCAQEwgZMwfDELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
# bXAgUENBIDIwMTACEzMAAAIn1cCDw7EuVy0AAQAAAicwDQYJYIZIAWUDBAIBBQCg
# ggFKMBoGCSqGSIb3DQEJAzENBgsqhkiG9w0BCRABBDAvBgkqhkiG9w0BCQQxIgQg
# 2gYF4M42+F+W1Yu4qJJVkMp7zOQv7IWw/vb8oaSq5mUwgfoGCyqGSIb3DQEJEAIv
# MYHqMIHnMIHkMIG9BCDl5wEaNaFSHDiySg6pRNGnav42fU13ZZ11kXFxk4QRcjCB
# mDCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYD
# VQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAk
# BgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwAhMzAAACJ9XAg8Ox
# LlctAAEAAAInMCIEIP4XqQhw38mAyR/Jv8788/KDAlvdWz4RUsND0/OpqziGMA0G
# CSqGSIb3DQEBCwUABIICAKP6vtc2FGDreRZmtvFednRd96hn6GZss8zOUuy12JVH
# n7hj7kFgx6fDXTES5ZJecYXKqJgDzVPedOFZQ0DthsDbhZrEubte8YlQGIIr2EJb
# Bzzzv/Dl3YZG/HDauaxjmu8k3B7Sn/B9OcyVxLWF7uRiy6kmQjv8EgaqCTmvf/7b
# LsqBuSENJwNDcq7HH7hiG+ZwBgSDkZqfQ7kGR+Rtgj2ikNba1rVS1MPBd9mxpn4n
# x1rPQPgA/kxJPQZKJnmUKvyZumVBdjpIZqZQHB8c81xR/jALcT8dfZTsD/Y9gYdM
# /YsuVgr2Jv2Kzcxv2DPwXBx/SkdSLEpWd2BLX3lI7lQOYhtZaxENtyrPkG3vLHct
# hpCQd5X11i5o639z5Yq/dlo7+8n8osIDvU9AaYDsZNJRXg4v/dBwKLSwwPdIyFUt
# wC3p7gxj5saBS4sTc7UeQG0oihNMuGiX3Mro0sQLXpCqgbuMZ2gBGPk1R/dJC/4c
# IzdQKBm/KhODWfkYrr4NkNijACkWsIRvAtBFspr3zY924ApxMpi4e1+n8IXXMdIJ
# qORa5GZC8A6Lby3Bf7qtcmMwNRlpbelggbqeY7awx8kePiP9ePvQ7DiEtM1QB7DQ
# amjkmW7c+a+0keRVRiX+X4wWiQXqGK7fCliDNlMz+kAzdHqIV7WSO3WWo0D2I1M4
# SIG # End signature block
