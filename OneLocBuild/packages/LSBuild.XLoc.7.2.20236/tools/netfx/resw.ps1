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
# hOv1qdrw9q9DImem2Da8A8uy57r2p6CCDcMwggatMIIElaADAgECAhMzAAAA0wKI
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
# bTCCGmkCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMTMwMQYDVQQDEypBenVyZSBSU0EgUHVibGljIFNlcnZpY2VzIENv
# ZGUgU2lnbmluZyBQQ0ECEzMAAADTAojYab3fAgkAAAAAANMwDQYJYIZIAWUDBAIB
# BQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEO
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEINnegaNiGRS3pBmKVSVhtoTb
# YJ+3FKUGTTRKkFShCZqqMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAMKa5qXmEMNDy8YFZxwdH+wdounEK/KkFphrxTsCEzxbyWSxGsFazttZb
# RaqSTXJJbZe+qUSFLAxQ9asnObuN71wWWWeV7WE5gh72puUu8DUWuSvecQgXcI0S
# EDyQwuHWinF6pCsb5Zk8h0/psRi39cjBP2b7S5/dWVXWp6VQ7EejEf0D57EUGHvP
# LrGiO7mSvAP+EgBsjoJAN4ETTMWl2qzc6oQ2oza7tt+GoTBAWcIybjx9lF0xxvGM
# zqAX3fcXhCcMZVKnYjYcVj8NKtjNtqECmW53YxzSt0c2zkR9DEj3cbf8Xbve/SWM
# z1jd6+A8FCKd1JmVyoRbzkvEIrqeoWNXvsrY/lEoLSBo0BcH9yPhvJHviJlKihWo
# c+c513r00+i4bTlK+oIC66OiMWH7wpwDLEVm9n7D2/AVJOYDg08XE4xPbvNbIJd2
# ty5c7eOoaETortlmdKpqvTWJy0h0Op4Qw5YaxWDZ9K60tDUqhGvylTUEhQC/kgZD
# Xr0vzYKtoYIXlDCCF5AGCisGAQQBgjcDAwExgheAMIIXfAYJKoZIhvcNAQcCoIIX
# bTCCF2kCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEILul9cGLzTZ1
# glR3zCZRz0RBn9Wuuy5DwY5t879UqqUvAgZqF1BTjRoYEzIwMjYwNjA4MjI0MjQ2
# LjI1OFowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjo3RjAwLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEeowggcgMIIFCKADAgEC
# AhMzAAACHqOspG45b3xJAAEAAAIeMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk0OVoXDTI3MDUxNzE5Mzk0
# OVowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjo3RjAwLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# AKXROO1sPCxHsV7xpzqiXmzXOG1Op3YBalyFCEun0bmaZIzbc3l/JAYJDUPTqs4D
# c+BcoX7vq9e84KzZWwu/WjCPiYcTISqKrwYnnIL79A1hGlk8Dx7s6B6TMM7pL/i/
# L+NMxhuneuG4WIooLNNY5C10VwX4PSTfr0jumb8TTtLI0waS413mWPlIn3VSoW5l
# +MwHpxDbCHvua2JFRV2PnfKN02qP4ZCX5hrPb0GOvOftTWWf4mkuWdvTF0aZmgg8
# plvAFVxa3Ivi7KEwvtJJOaI59ZdT6D7I2XQJ2gsYvwu1YcSLwWy5M95J1KqZ4yu8
# toSaJtNVNLi9BBjw0+dvq4jnLqI1X28EVybwtT+UNOMZOo9rtQFPiB1/kmbfBit8
# IVng/+PkyipPQk41xrnSO3hMYj3RKKFdoMRiqTbdLQglndSRSm6QNFOMrvXcEjKR
# 9/HIGox5Cp87TO9Z9THsGuZSm6BBzD334PEuXaB/65ASlGaeVutUn129b12zh+oQ
# 83aMbRDAXU8FKCU1xXVKmpkqK1CAEZLC7/zYArO2gIfBhEdE3DPBNV7/Uo1O+aoB
# 3hSB6zjLA4fTaFpqBPzBhjw51Z2MqfeTTnbD6SZzRQLQX6JVdMZkgzG+j2IFlChd
# 6HNG1Yn9U60q8LJLdywrM3utK1YnCNJbPp205/SX7K0tAgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU5goWmuoEHQlmYlwULhw8+Z4XgmQwHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBAKShkHk2clUVvnAp6NGieTnXxrZME1ikpwEy18voFLQBFoAE4wZguU82
# 6EjUfCZ6U/2FfeirdNoSb9wOSTM1ADMN50+ChEjZHv7ymg1Ja8dcQCztJk4Ob3Hs
# qqUGQ1kz17HhdjXI2ZU4CZYONGvuMqNqJBue1/sQLgY2KTEYZpVY6N9i3dD1fSv8
# qzwoGVvMNH3OMD9MJy1HhyjValTVlEsWsH1uXx1HGxufJPapDjUTt1PXZHfR4gZT
# OISzkY37bpX+i9c6LbR0mIzXeFha/LU00kCGQo6UsHU426d3p9+E91Rwday7xX6V
# HRpqQxXrgeoNsu6ZmsI3BSh9XHfEyTwXi0Jgm1DEtPLBzfSxkAPVLawLX3n3HoqL
# ED6njUUtSXyDrigfLdt9icfnF3gk4GBChqqd0aNxy3Gv7wSSeOErKuADOtNwoslt
# R7OCjJ7xusIsn7Lo8CgSOldGRJgBTzB9DdhZFyToAvChXtSKfz6ukZBJteEXpzV1
# MVqReYKEKW53ggANj+3olGQn7ToXMv6MN3wotXxCPvsl+K5OI8gbkb/GWcahkVxf
# 7LIG0O/NkTjx35j4dhR39y+EfUUqXsAf7kDKi2olIWa8z8G5hHHYHbRqxVeKVXaT
# Yls07csYLPdD52kSXPCx8muRrU3+B62Zrt9amjCw2+ghoRC+Np3xMIIHcTCCBVmg
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
# IFRTUyBFU046N0YwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVAIP9A2QoMhbhUgXuPeiLaput
# HRr/oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDt0Z8sMCIYDzIwMjYwNjA4MjAwNjA0WhgPMjAyNjA2MDkyMDA2
# MDRaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIFAO3RnywCAQAwBwIBAAICC+cwBwIB
# AAICEuUwCgIFAO3S8KwCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoD
# AqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEAaI9b
# THVrglvdpa35FJ+V4+Xwr9CFWhIJki/rjNon+UnJWFX62HseFqen59Brp65SnLrY
# SbYWXxtfRRZgkCIn2ZHMc6/8s+IWCbeBQvHlFNjRoWsVty9VsAdlmWvK+iji3mfp
# IfUMx13L6sparA8xZzKMntMLdqeV2CUdUCfKzeABjn+ySAElny7gsE2+Lu/pOC+F
# Vri26R4Aj7v9PH1rpPxVj0YI5yFKG+vqKSns7p5QovpaLi69dtC2jZt2BeBR9nEb
# LG826ZMfPj8EcL4SFQCcaM2uNPVmWUG0xa3No5F5rhUTINnwxQroV506NuFqFdEA
# yCPbymILMAQjKzeLVTGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFBDQSAyMDEwAhMzAAACHqOspG45b3xJAAEAAAIeMA0GCWCGSAFlAwQCAQUAoIIB
# SjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIFKY
# vH0umJx7BphidIwIHLDURVVB1bAYGIlT0ik3IYdGMIH6BgsqhkiG9w0BCRACLzGB
# 6jCB5zCB5DCBvQQgL4FdavP2B4yAzwG+fxurEeOEdcnb0QGLMhMjDQH284IwgZgw
# gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAh6jrKRuOW98
# SQABAAACHjAiBCDvgZmxSeL4fsQocWAbAPCY5CcjFFf+q7vI5GyecHS/WDANBgkq
# hkiG9w0BAQsFAASCAgCE1DVzM7hwO4jrym/DxmiaiZ+2DbjnV6rEzL8WEvAN+XFE
# ofvsIIbgsm8OS1wcrW9bF33K36iNatP/7unr0bc1XEJvzGDrqGcA+5nzEwA/MLh0
# 06aYe5oYiRtPtFGGgpStqo1ZJoCzRGEvN+M/rvR+w/m6aTGqpvwj4l/oJSZ/CzED
# DmIX3efesHtxjo8+n2XIUrblmRE/mUuizdxRrSHk6SLExe657/9a22fxQbOCoMt6
# pdARDP6fc3HDljKwoRpvWADp3jtf4fGbky7hwyXVNkfrAVlNsRk+3LMmuuuXDjFN
# nGAWLTgjPLNMAr0ZXksyVE4vJ91WGZ5uWAeXHq+5RikL7U+DKVxgQ/woagsSZFA4
# Ycn34rL+aE5x82D899GRiQ18A/9wQNTegpOInOh7sBQXIDM43tzlRyxzwbC5PGsy
# poKeVbkhk2RL3z5LogV2f5V7XldbW7xdd5A041wnRoRfRO516yKl4wLnfpiwp6+D
# 0k1lO3xwQ5QaehSDhXoNAUAmxUFpDtAiOKfQX79pJsqGwiWHtFwjsTe5Sanz3yii
# B8WqlzOjDvQAxw+vTO///qyS8YbUGacRI69msZCUBD0q697n3s8yL/Ec+AoMNX3H
# ydDrYHfLo5ODj0X3/5H6bk8bHCDzx9MXiclI8JUmyPcLh+gYq0QERsmTrM4sHA==
# SIG # End signature block
