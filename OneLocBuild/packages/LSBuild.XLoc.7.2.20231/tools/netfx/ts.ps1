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
# MIIr8wYJKoZIhvcNAQcCoIIr5DCCK+ACAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCZB/sXMDIEFgqL
# YILeL23ekWDE6cwtUjmfG1Yuyhe1DqCCEX0wggiNMIIHdaADAgECAhM2AAACAR26
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
# BAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIIvg1tZGTYZ5
# 2lrZW5/kKUUp7L9I9HgOTakXFbKPUswSMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBN
# AGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJ
# KoZIhvcNAQEBBQAEggEAAKXrHjGIBFHAHj++spBCaxjRy1ytYw7eXYqwsNKktnOl
# e+VapQwAf9oyjuBCXa15XrB6nHQPjsMUJoWfPhZOXSCqW2qU9Bmrw6HuWl0Lglos
# Uud9TUEXAPLINfuuaBxAxDLwbNH4M3CuT1vX/1KlgH0XR0oyMnfNu2jpdBNifUBF
# q6/e/kPOdO/dPtRg9sB8pjUp+yIwt5JJe32+ZHADKiuEPHAsDGB736nx8x7mEC3D
# ukMZsNcG8bqQ9vfxv6nrdrmoOxCaQDfeCHi7FQL3UlpkSklmLSQV8yoJYuLVPjjz
# YkBHApRgTL3vLcUKgDhV673K3KpeDrbc2utDdFV22qGCF5QwgheQBgorBgEEAYI3
# AwMBMYIXgDCCF3wGCSqGSIb3DQEHAqCCF20wghdpAgEDMQ8wDQYJYIZIAWUDBAIB
# BQAwggFSBgsqhkiG9w0BCRABBKCCAUEEggE9MIIBOQIBAQYKKwYBBAGEWQoDATAx
# MA0GCWCGSAFlAwQCAQUABCC40q472fHtCo83nhl6gZRlLgCpD04Dco/AmD4znFA2
# QgIGaNfMBhwdGBMyMDI1MTAxMzE4NDI0Ny45MzdaMASAAgH0oIHRpIHOMIHLMQsw
# CQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9u
# ZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNy
# b3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBF
# U046MzMwMy0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFNlcnZpY2WgghHqMIIHIDCCBQigAwIBAgITMwAAAg9XmkcUQOZG5gABAAACDzAN
# BgkqhkiG9w0BAQsFADB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
# bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
# aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0y
# NTAxMzAxOTQzMDRaFw0yNjA0MjIxOTQzMDRaMIHLMQswCQYDVQQGEwJVUzETMBEG
# A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
# cm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBP
# cGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046MzMwMy0wNUUwLUQ5
# NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2UwggIiMA0G
# CSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCl6DTurxf66o73G0A2yKo1/nYvITBQ
# sd50F52SQzo2cSrt+EDEFCDlSxZzWJD7ujQ1Z1dMbMT6YhK7JUvwxQ+LkQXv2k/3
# v3xw8xJ2mhXuwbT+s1WOL0+9g9AOEAAM6WGjCzI/LZq3/tzHr56in/Z++o/2soGh
# yGhKMDwWl4J4L1Fn8ndtoM1SBibPdqmwmPXpB9QtaP+TCOC1vAaGQOdsqXQ8AdlK
# 6Vuk9yW9ty7S0kRP1nXkFseM33NzBu//ubaoJHb1ceYPZ4U4EOXBHi/2g09WRL9Q
# WItHjPGJYjuJ0ckyrOG1ksfAZWP+Bu8PXAq4s1Ba/h/nXhXAwuxThpvaFb4T0bOj
# YO/h2LPRbdDMcMfS9Zbhq10hXP6ZFHR0RRJ+rr5A8ID9l0UgoUu/gNvCqHCMowz9
# 7udo7eWODA7LaVv81FHHYw3X5DSTUqJ6pwP+/0lxatxajbSGsm267zqVNsuzUoF2
# FzPM+YUIwiOpgQvvjYIBkB+KUwZf2vRIPWmhAEzWZAGTox/0vj4eHgxwER9fpThc
# sbZGSxx0nL54Hz+L36KJyEVio+oJVvUxm75YEESaTh1RnL0Dls91sBw6mvKrO2O+
# NCbUtfx+cQXYS0JcWZef810BW9Bn/eIvow3Kcx0dVuqDfIWfW7imeTLAK9QAEk+o
# ZCJzUUTvhh2hYQIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFJnUMQ2OtyAhLR/MD2qt
# J9lKRP9ZMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8GA1UdHwRY
# MFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01p
# Y3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBsBggrBgEF
# BQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9w
# a2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAo
# MSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgwDgYD
# VR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQBTowbo1bUE7fXTy+uW9m58
# qGEXRBGVMEQiFEfSui1fhN7jS+kSiN0SR5Kl3AuV49xOxgHo9+GIne5Mpg5n4NS5
# PW8nWIWGj/8jkE3pdJZSvAZarXD4l43iMNxDhdBZqVCkAYcdFVZnxdy+25MRY6Rf
# aGwkinjnYNFA6DYL/1cxw6Ya4sXyV7FgPdMmxVpffnPEDFv4mcVx3jvPZod7gqiD
# cUHbyV1gaND3PejyJ1MGfBYbAQxsynLX1FUsWLwKsNPRJjynwlzBT/OQbxnzkjLi
# bi4h4dOwcN+H4myDtUSnYq9Xf4YvFlZ+mJs5Ytx4U9JVCyW/WERtIEieTvTRgvAY
# j/4Mh1F2Elf8cdILgzi9ezqYefxdsBD8Vix35yMC5LTnDUoyVVulUeeDAJY8+6YB
# btXIty4phIkihiIHsyWVxW2YGG6A6UWenuwY6z9oBONvMHlqtD37ZyLn0h1kCkkp
# 5kcIIhMtpzEcPkfqlkbDVogMoWy80xulxt64P4+1YIzkRht3zTO+jLONu1pmBt+8
# EUh7DVct/33tuW5NOSx56jXQ1TdOdFBpgcW8HvJii8smQ1TQP42HNIKIJY5aiMkK
# 9M2HoxYrQy2MoHNOPySsOzr3le/4SDdX67uobGkUNerlJKzKpTR5ZU0SeNAu5oCy
# Db6gdtTiaN50lCC6m44sXjCCB3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAA
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
# cmF0aW9uczEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNOOjMzMDMtMDVFMC1EOTQ3
# MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYF
# Kw4DAhoDFQBetIzj2C/MkdiI03EyNsCtSOMdWqCBgzCBgKR+MHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUAAgUA7JdffTAiGA8yMDI1
# MTAxMzExMjIzN1oYDzIwMjUxMDE0MTEyMjM3WjB0MDoGCisGAQQBhFkKBAExLDAq
# MAoCBQDsl199AgEAMAcCAQACAiDyMAcCAQACAhNuMAoCBQDsmLD9AgEAMDYGCisG
# AQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMB
# hqAwDQYJKoZIhvcNAQELBQADggEBAObkoi7BsGkopeZkEQlu8G1SWoJ2AGbakQM/
# nLTdF9QqmGXX/GqG25G5fp4B/o0FJfZhRQpVHBRu+SLpidgOmtezw+9rBRN12Hs9
# 7SiaY6Rj748wdWsF/E+8+5BnpmPbD2kKocpu60C5saXQbFTjCx/twnPfWi3W90tE
# ErnV1+0uuzUx6yL9cRVN+Z4fKUkyTKfw5GPrnEKyufeUQneoMUBFZtjE0CgyzQuw
# cas1N0vhapEb8/ucjuxgbvFnuEzYLL6nFgDPUzp1B1oRF55mInE/Y28LxVISXoys
# ke6GVnPCAcwvWAHaFlrsom+uBEWSAOrRH6a8BZhKEEPN+ogN2ZAxggQNMIIECQIB
# ATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAg9XmkcUQOZG
# 5gABAAACDzANBglghkgBZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3
# DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCAUZlUDis3Zv4SNChYdz3/4ZrUvhOY0Pcg6
# GAtIcaWxnzCB+gYLKoZIhvcNAQkQAi8xgeowgecwgeQwgb0EIN1Hd5UmKnm7FW7x
# P3niGsfHJt4xR8Xu+MxgXXc0iqn4MIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
# bXAgUENBIDIwMTACEzMAAAIPV5pHFEDmRuYAAQAAAg8wIgQgxsYRjd5TPALQcwZC
# J9yuoibYj7nKmm90zX73JP83o7kwDQYJKoZIhvcNAQELBQAEggIAjLWRzUF/SrpC
# 1ou1z4Ok8M+mTK5NuVx2L/qSPK24YSbVtThfXLGV6ErsVKD/cBFBe+qZFSNYk8ne
# dBmm98zhd346NdCICsZaQS4EZn+DzkFjBd9u7VFzyDAtZMNqRSqxEW45rs9yxVWR
# z2Leg+/K/lAiUSPG8hTneQHVfaxsDDjIzsfSrM5T7bfTDYWj2jtIo6HuvGKWfbak
# yuVidOf8MbOQasaiJdyvACv8K+u+7DAEyya0ARlKjqGOI11keHHuJOKcn5r/pu92
# NlXLg5cggClnQoBEJqW35w8m58Z1zO3fL71sZIScNYBOxN8OKteTP6QKiuA83Gld
# FlfqnwPmWoMCzgdj08lYh5z+BGiE7hd0XiJHi9N8pB7Zguc7CBMCaPuq3Acq5ysj
# MEDd7pjjwRx84BMLa82B3ElwDyXQtn1mNA86mNbufu+Cxt+aEDKvR+W0F468iaAE
# y/uzV2IZccrxYctaq2Ks02gDPL1kC9b97oxim92Vi4ocqLGaviPYqhWaB/2HUsXI
# eZQQy/NuRv1U5AbDd3Bq5p2KENbF/sbA4Efm5HukKKYaekSZkkNS5TmXTqpahxm8
# ihQUxSSJzfY9FLrjS3779AC9SXstCznCoRw1PPT/5Njtu8q3hSBpihiXAXeHq967
# 0MbcOVYQKVGhzsM2HzbCyMXn0zJXwhE=
# SIG # End signature block
