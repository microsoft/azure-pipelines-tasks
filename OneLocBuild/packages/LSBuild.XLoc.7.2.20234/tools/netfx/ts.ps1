<#
.DESCRIPTION
    Resource parser for .ts files.

.SYNOPSIS
    Read TS file and parse all id/value/comment pairs.
    Writes TS file with id/value pairs.

.PARAMETER
    Hidden parameters from the AnyParse host.

    [string]$srcFilePath                # Path of the src file. 
    [string]$filePath                   # Path of the file to be read/write. 
    [int]$parentDbid                    # Internal parent id to create content nodes.
    [CultureInfo]$langCultureInfoSrc    # Source language CultureInfo.
    [CultureInfo]$langCultureInfoTgt    # Target language CultureInfo.
    [bool]$isGenerating                 # True if generating the target file.
    [string]$scriptRoot                 # Path of the script.
#>


<#
# Uncomment this block for local debug.
#
# Default output file gets deleted by the parser.
# Make a copy of the input file.
$filePath = "$PSScriptRoot\..\en.ts"
$debugFilePath = "$($filePath).debug.ts"
Copy-Item $filePath -Destination $debugFilePath
$filePath = $debugFilePath

$isGenerating = $true

class ParserStub
{
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType)
    {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating)
    { 
        Write-Host "Comment='$comment'"
        Write-Host "id='$strResID', text='$resStr'"
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [void]LogInfo([string]$msg)
    {
        Write-Host "Info: $msg"
    }

    [void]LogWarning([string]$msg)
    {
        Write-Host "Warning: $msg"
    }

    [void]LogError([string]$msg)
    {
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
#>

# Read the .ts file.
[string]$tsContent = Get-Content $filePath

# Create the parent 'Strings' node.
$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 1, $null, "Strings", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Get key/value content from .
$match = [regex]::Match($tsContent,'(?<=export const lang = )(.*)(?=;)')
if (-not $match.Groups[1].Value)
{
    $this.LogError("No content matched. Ensure list of strings {} is in between 'export const lang = ' and ';'")
    return
}

# Read key/value into hashtable, keep the order in the way it is defined.
$hashtable = [ordered]@{}
# Only available in pwsh 6.0.
# $hashtable = $match.Groups[1].Value | ConvertFrom-Json -AsHashtable
(ConvertFrom-Json $match.Groups[1].Value).psobject.properties | ForEach-Object { $hashtable[$_.Name] = $_.Value }

# Store parsed results.
$generatedContent = New-Object -TypeName psobject

foreach($key in $hashtable.Keys)
{
  if ($key.startswith('_') -And $key.endswith(".comment"))
  {
    continue;
  }
  
  # Get Comment for Key/Value pair.
  [string]$comment = $hashtable["_" + $key + ".comment"]
  if (-not $comment)
  {
    $this.LogError("No comment for Key '$key'. Add comment to give context to translators.")
    return
  }

  # Get the text to translate.
  [string]$text = $hashtable[$key]

  # Protect all variables enclosed in curly brackets.
  # 'Uploading video... {percent}%' -> '{Placeholder="{percent}"}'
  [string]$locver = [regex]::Matches($text, '{.*?}') | Select-Object -unique | % { " {Placeholder=`"$_`"}" }

  # The instruction consists of the comment and LocVer rules.
  # Replace the reserved LocVer rules delimiter in the comment.
  [string]$instruction = $comment.Replace("{", "'").Replace("}", "'") + $locver

  # Submit resource.
  $value = $this.SubmitResource($childDbid, 1, $null, $null, $key, $text, $instruction, "", $isGenerating)

  if ($isGenerating)
  {
    $generatedContent | Add-Member NoteProperty -Name $key -Value $value
  }
}

# Generate file.
if ($isGenerating)
{
  Set-Content -Path $filePath -Value "export const lang = " -Encoding UTF8
  $generatedContent | ConvertTo-Json | Add-Content $filePath -Encoding UTF8
  Add-Content -Path $filePath -Value ";" -Encoding UTF8
}


# SIG # Begin signature block
# MIIo3QYJKoZIhvcNAQcCoIIozjCCKMoCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCZB/sXMDIEFgqL
# YILeL23ekWDE6cwtUjmfG1Yuyhe1DqCCDcMwggatMIIElaADAgECAhMzAAAArn9k
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
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIIvg1tZGTYZ52lrZW5/kKUUp
# 7L9I9HgOTakXFbKPUswSMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGAax5vdbPeGNaWpXoQLX+auYnfvkQmSCAAcoeLawanduZMxbLcwUUu8ggl
# Dn0N8LNK86Gt5macOoLu6NPebJ2MbYEBah78KgGFpAjEIEeBNR5TgRKKQ0vR/SZP
# dpnq09/9bb9rrbT9VmynXRzhdeyxWUCXYrmk5dFR4fByVHWNZLhOTcgkSZf0Ga0u
# dURwe+OAzLgRXrstJJ7DfVmYU9DeCi5JBpvEQinEfuM58k8KCnfmncQU+hDelCsY
# A4lWNCnF1Qy9LrmxAD4U+NWjKbjZyVEbMCagQ87WJTHlM5LxTEEZxBRjPSuIE/jK
# WYCYbHZESy3zkhKqPL1dM0uCWB4zSGYclb223E9NgTLcDF7ciVSpcxCd6Cnnk3/K
# 2lBILaX33Dx2TQjK3VUe8JC0kgilYsxaZQ2N8V44m8aE2VVaQ+T41I9DYLnGQt5Z
# jkdhNqQe8Bp5xe8jEXkYf+uRYHAnv1qi+j9ZCVKtFq3x5ZnyI9IPgHXMoMg3z6yJ
# tCuboHNMoYIXlzCCF5MGCisGAQQBgjcDAwExgheDMIIXfwYJKoZIhvcNAQcCoIIX
# cDCCF2wCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEIKxlpn+X24iH
# 8T5qUNnZ1DuY68ixrATLGOVETni1UkUeAgZp58CHSw0YEzIwMjYwNDIzMjEwMjIy
# Ljk1M1owBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjozNzAzLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEe0wggcgMIIFCKADAgEC
# AhMzAAACHzpwaeSiMC6VAAEAAAIfMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk1MVoXDTI3MDUxNzE5Mzk1
# MVowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjozNzAzLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# AMs7xcU5x8aoCqCLPT4CZCYWXd1nRpMbhQUmSqo10wfLbwNqF4IGzo425+6TJ7nH
# jYJaTOBEjL2QTZVbASe1nxmSDKvKQLRsiqwgPv7oXGC6x5Nd/VXC+bUPzXThWZ62
# gEmUni4Zu7IllS9cPHnmdWHnTKAtPNnbhaRCyc+m9Fm/aQ9zf1/duEvIdW2cexr9
# b/zpWt+134B8W94D6o38Rj5caPlz8M8xcJgQJvRqthv3Z0Mla3DOnIGuniB8eWBj
# VQSlziXgAYQut/YnjCvFPNNb5IzxeFXV044+tiMPTzQhtmovwH4gXREJ2fbr1hes
# YrpAgeKnOcplwJLyM3fRgAedMlU3lnOzq3/ZiyoEYOq68Np3v3fgUVPDO9Rw7dWg
# jJ33ddbC8/z9IIVUmHbVbygZBOm0YfKXL4WXiF6dUxVkXW/qiw62KtfwYVOISGd/
# ydF06DvJlgAnTHL0K0N9tdpOf9x/curc38YJgoWML7mZQIT4AmGbEy4x29JQaYqI
# AV2I8CNROqxZYEFkmbR4LCB4YkWaZAD5Xv/3wEpwT6BQvs715ZENDAp4By+jqvE2
# /ZjiMqscDpn/CLdr98pSEsI1kRLyoZ2ukMCbuqH7oWNjHK0BuSIozq5M3L9Qs+XC
# 2VhmgAkMNA/t5gLLDBVs1NsddEFJL41xwLSxIHhbtTrvAgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU2TvawYOUfSvkPC98ZHlfAkjwHtswHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBAGVu7cijKec/PQrWI9t42ex6PZvXmXmx2XYUAUEEZP2VF1zaA1XwsAi6
# w9gceFS9ENyzHiVsw2FUo8a7hMMtqo238Ij5IW0a6p1EulU/VcT1wIvIqso+lwkU
# kKo+lX55+gC1gGYhRBzHHBPtYhDuBqDz6uQq+syQKhGopLSYq/wnWwp+Lzn4ba6F
# n/VG15JV1hk5k6P5JvjDOidMJOPsS2Aw38Ffflbl1PN3vAl0Z6liRWLzvV1KsLZO
# vVkXMBHtLjh2sJZmknqmElptU06w3EUkqBLKS6A4ZbNDfXxGvcxM+DazcGez6lQ9
# WAyKN3htQ4fYGUSwswzA5yiVNNmqDUdit1jWPGlQAj2KmMFBEg0v87vTln79/YuM
# 2YlCigJUlVfbhp2lnnX1Kx9rMaipca33VuaoqjR8jT0iXixQeHiKHqumJAMGXIvu
# +a8J6PBXFh69jipXBNn+jeC+X5HSUXFhL194gzg14bT5awNnuMtyLkwV643CixBj
# fPbpeDWiPRT276dxH25NT7EGYnwG2UJ2FDXdE0xfk/6StFg8HdcKn0mbpdo7X33m
# rfYAhmbWbMEYjrIeW+JdoQLlPMaI7Ute4+1dlTZf3ehAlsyh7e/z7kI8qtBqUZbJ
# i6HZrdXWnBuP5bQUSYQU+m7xMj6pg7UghBZRJG8WNe2Hk5vTaEwyMIIHcTCCBVmg
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
# IFRTUyBFU046MzcwMy0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVAEsgyDU/uw24JemZsfYhdPa1
# d4QQoIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDtlOGlMCIYDzIwMjYwNDIzMTgyMTI1WhgPMjAyNjA0MjQxODIx
# MjVaMHcwPQYKKwYBBAGEWQoEATEvMC0wCgIFAO2U4aUCAQAwCgIBAAICFvcCAf8w
# BwIBAAICE+YwCgIFAO2WMyUCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGE
# WQoDAqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEA
# uX+i+bgBkbS8wArhPKoPWnmJTDv2dZC9oa//0xriFQzjaGErzumVvKL7BXzPmEna
# 9si4AatJzmxomexEJIAkcRMgJ+8oc+NOahAh/UYnEqySkwW3amwWRXX106mUZzwz
# Xwlx7Vrf5NBNgchdHGRN4hdjuGNAS/Y8BOXAuEXoFB+K+ec6gVFSptji76EHobjm
# Vs4IEBK+KhUVwktc0ByfpxApCOY0YJB80yruP+jjW5iimM51N/g+lV14sHPx3Vk5
# xiBlxJ3qBVcnNPdgyfi1Uvo/6Sbduyxz/VcwpcLU5OK6Qpe8GLKQ7+1TJ3ti459K
# Bsi8nR+Fzr9DqXkub+cVVTGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMw
# EQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVN
# aWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0
# YW1wIFBDQSAyMDEwAhMzAAACHzpwaeSiMC6VAAEAAAIfMA0GCWCGSAFlAwQCAQUA
# oIIBSjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIE
# IMaBtANrxVlYaK7Cdk+bh3uGMQqxaVY/2Zd7N+o1BWN/MIH6BgsqhkiG9w0BCRAC
# LzGB6jCB5zCB5DCBvQQgsCQK31aQKwy1RGQW7pNjQ/dRd1GcKJi49mF7fKQt/BQw
# gZgwgYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4G
# A1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
# JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAh86cGnk
# ojAulQABAAACHzAiBCBveTjFDwHxWRMrHT6KJ4r9yKFf3QOENgpWE+w+cwYr2DAN
# BgkqhkiG9w0BAQsFAASCAgBBi8fgBOFeZIebsHQCEUksfgTMqn1yKeM4hsZlrECW
# 0yxx/sacny4ak8l4SkoZoH9xpRV764zb7FuoNlAUe2d1GAWWVKZYetx5bWRVizIF
# L0UaCBZ+VGr2xRnN3QO6tm6HLpFaAamXnbt4SF6TIYt5g5Pfef534MrwtMZM3I+/
# F8k4vFiyITZaxU2v8jMBbCbIEMCSi4iz7rqu8naBBbN+zkuBdQvQMDglXCMYLAIk
# GdXr0+V0+/0LMXKQfjbb9Ea9QHmPfitsBLmpPYgsKJAOSzPCetiYupOLfGricg4N
# xmYQzWV3h1UcJthrK51vPOouhdbj040dhejvjGHWaGsjFkVXaRfGQVWw68P5d8uD
# /OmKcsgRSSe952ygVAkcsFNqPOL7Q3k+85ns8RRU+1UkaAMbzBoXHbnLFDnN+OC+
# 8H0nyazKdrmS1CgB9Qvc0ye8Lc3VbkIpcXniRCP6Fx1Qr1Q0ERZ6sQapdgcmW8s1
# CuUxFqMQSyxPZyipGFdR2RmRCUrWKxwSi6UDSDfuuhDe5mfyqrp18nI1x/LLxA+u
# Ov/pkDgu32ZJymbjdSQzUW+z5SQ44b/HsKWGyn+1TaAxctUPEyIovlOUd4SsThS0
# A/rrGDW+ovp4od+M4vdWr3HMwEtdZ7NLEeZZQ+UxLdGwS9RPtZdY+DQm4PeDgiwm
# fg==
# SIG # End signature block
