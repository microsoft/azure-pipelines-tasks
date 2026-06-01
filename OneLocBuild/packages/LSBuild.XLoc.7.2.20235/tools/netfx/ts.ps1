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
# MIIpAgYJKoZIhvcNAQcCoIIo8zCCKO8CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCZB/sXMDIEFgqL
# YILeL23ekWDE6cwtUjmfG1Yuyhe1DqCCDdIwgga8MIIEpKADAgECAhMzAAAA0ths
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
# HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIIvg
# 1tZGTYZ52lrZW5/kKUUp7L9I9HgOTakXFbKPUswSMEIGCisGAQQBgjcCAQwxNDAy
# oBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
# b20wDQYJKoZIhvcNAQEBBQAEggGAsOUjerxbpu+XX46rKGhWsUWrx/GV/qavxwdX
# 3OaOZGtMHao5PsaO2xUD+Gsmjnotfs3fCR6drogb2aB1NIAVyHQqNDFIAVyjUwGT
# pHbwLUmsUpCfX6hF6C+nedfLvx2VDkWoOl8LghbAjvVDeMc9maoY4AxQGfHP7nf2
# shYZHfKmgh0DgI9HqCTLCkr8CKLHYmtYKZo6cgYD1grAJu7h8N+nmiil0uzleowh
# Xw0Mdu73fyshCWZQ0H1oP1GQCByKaJXRT+KmotBbjo5frLnoGWN+E7SOILZKfb6c
# AvbnxXja+pFn5XOFPRy2TnPDVkW/SBuFIJ+kvGqtLbEQ6lPec6eh/zGmdRo7BkuQ
# FGJbfpPO7lKtVfEHvR30RYTCCJtMtxWglP+E0kqLcl/NiJF5LfFCEI6OTvxPI4FC
# 2wCu5dCUBOnGuI3feUV6ch2YUeouwwGuDF26jRHWC9bxYliH1KD2FhaXT7wE3gTK
# NQOVWoyCNsQgTiI1Bn+CfIQ8dNlMoYIXrTCCF6kGCisGAQQBgjcDAwExgheZMIIX
# lQYJKoZIhvcNAQcCoIIXhjCCF4ICAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqG
# SIb3DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUD
# BAIBBQAEICCUr43dXr1InYiZG24J5o+b2PbFQ47voPLVj6Fdy2wMAgZp63bZM08Y
# EzIwMjYwNTIwMTgzNTE5LjYxN1owBIACAfSggdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjMyMUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloIIR+zCCBygwggUQoAMCAQICEzMAAAIaqaAdBqAPQ6oAAQAAAhowDQYJ
# KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUw
# ODE0MTg0ODI4WhcNMjYxMTEzMTg0ODI4WjCB0zELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3Bl
# cmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046MzIxQS0w
# NUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Uw
# ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCZgQDBJPPv2rZXdlbNDkS/
# tEqBp1C0wHLv5XddDxHQ0vxH2a6nFyolD8o95kYlMRH71Cr+3sc5B8FsPLp7RN6m
# 8EVX9FjfD4s48wqfRSiHb/wi91JsnyoBZFWjPZL1WsnNmkHz9/mtBxEROBf+3w3r
# oPYmURe/h9lAHtfNwkxevWm6G5ds631FgTI3VDdntiNGSF8GxFz5IP8L0XiLBmp9
# CCjzYYbjCC4iGMlTv5cx+u/i/EAU1WDeafU+gxYZlaKj57Xj48Zg9UsqVp37QiF0
# crkCA/JcqSoCERmliFhhUQi0c46+qvC6TFUAlcy9YDcZq1aRFmffdYMlW2CEJbpc
# 8uLVwMqIYTlRxdlJXg6NAhQHy+nYtQxFe53kjj0UgFwT2dPTTPwD4R6Ss8z44CTT
# toN/Blt2ZnnqPu5vl80Mt/zIhvxDFnwyvhHBbL9zMG5XmuRZBD6ayMnkAq1hnEl2
# dpl6FSBQ0CtT+7fpIfV5coxAZFev/F4oUYjy++/kmXWSdnxSoRCv0/ENuKzs5enZ
# ZIwrmUsZ1hUfxWjCdgXexs6JGTHlDkZoTJN6E5CnZJ91uwlmWDRJeYemEaehbX+B
# D/k/oGBKrg8BYhloMmPoC8ssJ1tRGBHlqk1BB53bNhSBRuMAID9OiYDwuXsCuu/a
# hkaJQ7lV2LjHG0DcFFNBNQIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFPCrIgndAyg9
# qwNwZ0ai9tpjwiU2MB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
# A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y3JsL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
# BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
# MDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUH
# AwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQDVrvZYWrsHpslP
# dU4nbWedOg8n07+rnVvDVuE99DLru7L5/zHxqSKnM0vaTlvqa3G49tkakGqkEqC4
# PBCbFWlfxwaZp96jfAavhrxiTpLLT20SH83DCWzKrsFGsk2fpsY4HyIbg5PL6mYx
# SHsV6M09GC+B6j84/K2bg02swyD3xRWWtnEY05iyJ+lEkWDmMT9i7qWoVrWVOb1w
# e49jFZragTALSwQCxMVvr2Iqk3Sw7X3EFkKvSHkKVT0+Cjp6SIlvtAmgPOsOg9Af
# Bs0DzsK2jtMu6mGPSb2X8jvSAuMSrndIeO5RHPCmY3F2bXxCD6uWRowLpjYq6Q58
# nugJK729w0ZAz6KeX2Cw2CKtnrImT1WxcSyhO2hHt8w1To/Lq58lAYxOarpkKrZ4
# gY5dYwFvv1kXq2IpNripqaLdRLSZNjjUnXb1eYCCVXL66NJmQe7aUckNEezsWOch
# dlVQTmmXrJQiXbeMbnR9FMtBxK13Bj8u8lSAQcIjOO+UtOou3olVHltyzlo3gOHR
# g8b3kH2IMxmuriuWLlKcY1Z6/ksuwNjV9usrq5WkP6my9Iuw2mG3btBwdGxh0AwA
# tcz4c2zPYtnzGI5/C3qs6xVZeiIdXzr9N4zLlNkVSXuoHn0g2gxImANGVp1Vd5P1
# /A66KsUiiqCMoaTe87ZsQutgw3RBXDCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
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
# OjMyMUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQDxiu62YqlKu5sJoBixTim3UW3wNqCBgzCB
# gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUA
# AgUA7bg6ezAiGA8yMDI2MDUyMDEzNDk0N1oYDzIwMjYwNTIxMTM0OTQ3WjB0MDoG
# CisGAQQBhFkKBAExLDAqMAoCBQDtuDp7AgEAMAcCAQACAhXSMAcCAQACAhQKMAoC
# BQDtuYv7AgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
# AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEBACdO2s8fU/Tknk0F
# jpIOvTzu7N7hUT5n53pxD8qkUzoL8jPya7qFj07z3YhFGRx7VSGt/t0S9utg83yt
# lpZEZCalbOuMkn5uW2Pyx1FpIC9FOI5KVQEC2pRajlflVwCHKS1QyX6c0azZ3apr
# KjxNzM904ebot8Dj022WhZZQlw8pcG+a4xFosdj5ZkLNnF7iR50um8lnSinrKRbm
# ctp04jerUm2rbTFDfy9erp/JbIDsnuHbFqq7yOKsL5m7EzB9d8Br/0RIDWvAssIZ
# DsYSdxvieiWTbiiGRRdHQytY+4/0Q+Fxh5NyRvL2ih/UWPDzObFgOZa6Xan4oudZ
# TiPhitwxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
# aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
# MAITMwAAAhqpoB0GoA9DqgABAAACGjANBglghkgBZQMEAgEFAKCCAUowGgYJKoZI
# hvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCA8PMSzq5C/AwSB
# 44mMTcU3zPS8SZVoZqo7ETVfc2zV+jCB+gYLKoZIhvcNAQkQAi8xgeowgecwgeQw
# gb0EIJ16Icetu2kpzAHbR2hVTz1Ycg4fxLvDfu5odwOZ6Yr7MIGYMIGApH4wfDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
# bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
# cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIaqaAdBqAPQ6oAAQAAAhow
# IgQgMafystLxf0srHug/ZeIAFadk3NUQi7IbeZgB0cVClg0wDQYJKoZIhvcNAQEL
# BQAEggIADPk1qR2cWb2z/+AjGOuUQfxekAMJiHbW7d1UcjNFM2RtbGxzRuMJ4QVi
# 3v3f5nVqz5UadAbHkLl47wjo4JasXwFBbM7KCrcWrY5+p4Z3cOQZVPbDbQG0c/TA
# DyZfS7Vc+ZF+YGD/KDv4v+8HaNaCv8z1I00KcyvYSpwPwTlvI4LjtY5NUPjO1Ne+
# 8j39A79ote6x7lQUpyR+TFpG0BQO2U9dfaPbe9Ks5HXACcOLGRuS8EEw/JZdj/Ma
# knxBdaM7V8W5XueInW9zYyuJu4eTW+kxcWd3PCVYo+1/qPYH7VU2WOWnnmlOuerZ
# oqZk9Vo1/YqKLuwAfnXJC0KkoStTdX9gY225UeYZ0DPXRo3Aa7lMiJWDLoNjcweQ
# FVtjzRnQpRmefKZMkts/O0klwvRALknQzRIkBgCtPuAO3gNkiKQ4aHqdOLjF726q
# qG8CFkmk2/hkteyP30tFHHgwo9d8Uwve2v9PdGvjKX7qgTEtdT3H58D8BByAAFQc
# 2oYLqeWLB3okLEGGRUQJyxHFEnZGYCoR7OnTDgr598XB7ceZWWWBSLrJLkE/0TfG
# B7dDTZHkqvw1kDCM8RVkoiUsh63BFb8lR3de3LMo6RCOpbGOOBkU7riPv6Dgb8Dd
# 6wiI60hZsMzpdyeioF+Xfwd9fkLIcjsAaR8bbNcdAytmite6vsw=
# SIG # End signature block
