
#
# Resource parser for .storyboard files.
#
# 01/2019
# mailto:jurgen.eidt@microsoft.com?subject=AnyParse
# 

<#
param(
    [string]$srcFilePath                # Path of the src file. 
    [string]$filePath                   # Path of the file to be read/write. 
    [int]$parentDbid                    # Internal parent id to create content nodes.
    [CultureInfo]$langCultureInfoSrc    # Source language CultureInfo.
    [CultureInfo]$langCultureInfoTgt    # Target language CultureInfo.
    [bool]$isGenerating                 # True if generating the target file.
    [string]$scriptRoot                 # Path of the script.
    )
#>

<#
# Debug
#
$filePath = "$PSScriptRoot\About.storyboard"
$isGenerating = $false
Add-Type -Path "$PSScriptRoot\managedlsom.dll"

class ParserStub
{
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType)
    {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating)
    { 
        Write-Host "id='$strResID', text='$resStr', comment='$comment'"

        # etalsnarT
        [string]$tgt = -join ($resStr[$resStr.Length..0])
        #return $tgt
        return "!!$tgt!!"
    }
}
$this = New-Object ParserStub
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo("ar-SA")
#>


# Read the .storyboard file.
[xml]$xml = New-Object xml
$xml.Load($filePath)

# Create the parent 'Strings' node.
$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 10, $null, "Strings", $true, $true, [ManagedLSOM.ELSIconType]::elsIconNone)

# Create the 'StringKeys' sub node.
$childStringKeyDbid = $childDbid
$this.SubmitNode([ref]$childStringKeyDbid, 0, 10, $null, "StringKeys", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Create the 'Title' sub node.
$childTitleDbid = $childDbid
$this.SubmitNode([ref]$childTitleDbid, 0, 10, $null, "Title", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Select all 'string' nodes with 'key="title"' attribute.
$keyNodes = $xml.SelectNodes("//string[@key='title']")
foreach($keyNode in $keyNodes)
{
    # Get optional loc comment.
    [string]$comment = $keyNode.ParentNode.ParentNode.attributedString.fragment.content

    # The parent node contains the id.
    [string]$id = $($keyNode.ParentNode.Attributes['id'].Value)
    $keyNode.InnerText = $this.SubmitResource($childStringKeyDbid, 13, $null, $null, $id, $keyNode.InnerText, $comment, "", $isGenerating)
}

# Select all nodes with 'title' and 'id' attribute.
$titleAttrNodes = $xml.SelectNodes("//*[@title and @id]")
foreach($titleAttrNode in $titleAttrNodes)
{
    # Get optional loc comment.
    [string]$comment = $titleAttrNode.ParentNode.attributedString.fragment.content

    # Get resource Id.
    [string]$id = $($titleAttrNode.Attributes['id'].Value)
    $titleAttrNode.Attributes["title"].Value = $this.SubmitResource($childTitleDbid, 13, $null, $null, $id, $titleAttrNode.Attributes["title"].Value, $comment, "", $isGenerating)
}

if($isGenerating)
{
    $xml.Save($filePath)
}

# SIG # Begin signature block
# MIIpAgYJKoZIhvcNAQcCoIIo8zCCKO8CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBi2RWGza0O87W2
# t+a/DVgk/WCQnSPuzRtuQUwjhtJqEKCCDdIwgga8MIIEpKADAgECAhMzAAAArfwg
# b4sisLFgAAAAAACtMA0GCSqGSIb3DQEBDAUAMGIxCzAJBgNVBAYTAlVTMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMzAxBgNVBAMTKkF6dXJlIFJTQSBQ
# dWJsaWMgU2VydmljZXMgQ29kZSBTaWduaW5nIFBDQTAeFw0yNTA2MTkxODU1NTZa
# Fw0yNjA2MTcxODU1NTZaMIGCMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGlu
# Z3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBv
# cmF0aW9uMSwwKgYDVQQDEyNBenVyZSBQdWJsaWMgU2VydmljZXMgUlNBIENvZGUg
# U2lnbjCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBAImX7ktXR4nHu/z+
# Qlmg6WqeAX2lXZwwA27jX6s4Fwe/ut783uedwijPYIysN9s36cNmShOC25McggS7
# +uadZMzf1Y5cu2ZBcDv/x3MS+1T1/092YcKanWut0hb+us0w0Y8AL1H3nUDTCqKt
# RHmNrhE8QoV8S09xCwK3C8z1GyIzJEpzYcIQResT6XkUI/JanHIX18z4b+UCSm6K
# bDlWkg92Bmc+UwMPOUJq7BBsZFV6Es4Q5DLjy2JVb2/6Q1ukhovBlUkC7D/DCEvN
# yyDPqHa8CBu5G94+IO3WBde5jT5hBoXKy8BfSy+XvqiutsBQgqVuFc0lMpk2IUlq
# afKVlbG2mNpUT69DTIUpdxajN8cPvwRwOWjqq4QinSXNAC2UdbmVuJ2EsmD1Uvzy
# 1dJPwXJzoD8IuMVT6e31LFcdfaY6fEUlIKrUvh9ow80zMAtlUBHCG0ayShRAz1dK
# W0ttY11wT2uFcZpzyFK2kOKn2uFOeAfGPEYCZx69kiDxXhSGuQIDAQABo4IByDCC
# AcQwDgYDVR0PAQH/BAQDAgeAMB8GA1UdJQQYMBYGCCsGAQUFBwMDBgorBgEEAYI3
# WwEBMB0GA1UdDgQWBBRAhLEl/+uJfjQyWgp+AsIrZk2UTDBUBgNVHREETTBLpEkw
# RzEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVk
# MRYwFAYDVQQFEw00Njk5ODErNTA1MzAyMB8GA1UdIwQYMBaAFPEvupEWfN59Uicx
# 9Xr71VhZaTo9MG8GA1UdHwRoMGYwZKBioGCGXmh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY3JsL0F6dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMl
# MjBDb2RlJTIwU2lnbmluZyUyMFBDQS5jcmwwfAYIKwYBBQUHAQEEcDBuMGwGCCsG
# AQUFBzAChmBodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3BzL2NlcnRzL0F6
# dXJlJTIwUlNBJTIwUHVibGljJTIwU2VydmljZXMlMjBDb2RlJTIwU2lnbmluZyUy
# MFBDQS5jcnQwDAYDVR0TAQH/BAIwADANBgkqhkiG9w0BAQwFAAOCAgEAIpoW76rb
# za/ZUlt5vS0Ppx28/SGUHHkCWxqUIf2n6QEiGh3seVfQzvC3X82AO7bJTa4dC3ub
# jmYsoDm87TO5mkLQsJtBYaQOf8F52fEzGTRAZEO3h8IOKFsTrqPAL2hK576/Y2y0
# rYu5guye+z8M+gVtKjjW7J9qmqUpPvmScJoV8H+Lqa3YSWnvvcBcgtW44IU6sSKn
# iD6xVCXXPeUvb5wlXjAdexPCmbizHR2KVDpw9G6w/bNuXZeRXfNgKq6v/vqtdvR4
# CqC0DOyT1IiTY4oeY1FcTgo3a0Cgl2iCHVxDqo+JZJ6el5q/PMvv9fDKs10/z/zi
# eziKqpVA8DJzwxmMfcSoX7L8olU5dvMYGhCO7s+1qPjgHfxyDgoIW4VTVCSmKN3c
# IwzLplGIyh6FZEqxeycsMyJ3saWhuQmmy8X/k9YkALkyS3AGtkACjPltlxlSaGRJ
# Nq78YrhZ1VrH4aYNgBj8tqckBcrhLkKh14omG2nsHYTqp5V3xC2BUSkp1nbhazhw
# H/ErmJOQM71n6xXRjwZLHeRU4mUdaq0LXwzQcRmRsnAp4iVuT/yyBwQc0ZuWCqwI
# OwInfiX0HxxE75ZWw7ALhMgvoll3UkZBNDceuSlYiLVWDQeSq2SPzpex1SKtSAyJ
# JKVMTQwymL3WdXqJUREKCA8DVD16Ara2kFcwggcOMIIE9qADAgECAhMzAAAAArLE
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
# bGljIFNlcnZpY2VzIENvZGUgU2lnbmluZyBQQ0ECEzMAAACt/CBviyKwsWAAAAAA
# AK0wDQYJYIZIAWUDBAIBBQCgga4wGQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQw
# HAYKKwYBBAGCNwIBCzEOMAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIFUp
# jXZnKKFrQbZbZdHpC42/IO/bCgGOAGx0enr8DtqMMEIGCisGAQQBgjcCAQwxNDAy
# oBSAEgBNAGkAYwByAG8AcwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5j
# b20wDQYJKoZIhvcNAQEBBQAEggGASltbblOBr3OF7Y6UPleMxiaOZPsPl82XcFIF
# YtxPhPqxU/4BmWiizl2P1iv6AH+k1oAI8BixRtKCguLUQpvIxR8X/wk7CKGXHiGE
# 7DnEr4b1gVMkzy5u6gpMCtNHL5iX3SAQdafeNW9Zp7rEw5Jx+EI92MGwkqKeCHZI
# 8OVjS0UXhU5ZtLNrryPigFrjYlWT9oE0YzkUun6MDbMd3kU1bj5Rkky3QNuAT+Eb
# NoJMEczDH2m9xAIBQJDR3uq8gxe3s6gLE86hqiuF/EAxpN8UgwdPNSxcENfN91iL
# djqJWDN1qDiBdhinrzEJo/IaX6wrh3mRomXKMIhbxB4Rojo/EFfRlEIlJqWErYVZ
# /T9Urn5CO5Cc2xti/n+lDpukex48lJj3r7iWDM+g4Yt0epNaJd+j1Zc9bE+s7oM7
# VjOG+ubhVI30cYdogC7SO4R+/5clEKwsc0tBcnPdqs2n83V8iJN2pVDg33OodF+X
# H0tux/dJclZqytsFIK704xKAcbdMoYIXrTCCF6kGCisGAQQBgjcDAwExgheZMIIX
# lQYJKoZIhvcNAQcCoIIXhjCCF4ICAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqG
# SIb3DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUD
# BAIBBQAEIITtk6N94h3CjrGyK3hDojDMi7qeFV5NCOMOXfrvlmu+AgZpvNchVeoY
# EzIwMjYwNDIxMTc0NDI3LjQ0MVowBIACAfSggdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjU1MUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloIIR+zCCBygwggUQoAMCAQICEzMAAAIb0LK4Amf3cs8AAQAAAhswDQYJ
# KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUw
# ODE0MTg0ODMwWhcNMjYxMTEzMTg0ODMwWjCB0zELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3Bl
# cmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046NTUxQS0w
# NUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Uw
# ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCOxZ3nZlmTMHld7mD+XYaw
# 6MDPfSyDqNXF8UlX7DjEgNXJojcs7xsimbNi6XcBkeDnRQhDw+tJFkalCoWRE276
# jdgoniDa4ZgFGSwecdhHS5VIJCDnxOGRjJ6mUZfegC8ZFW48ilC0CJOxHvoD+B2h
# TscPARtvvdsnBPKtsoeFH5ZozL0NAcjiTlCjj5tkOzSSPvpu+Em90ZT5LzPFAGnt
# QCGMmcWorEi6xIhMTvMIJHjbYQuGSFVU4WorbDqHUwC8gt7vqHFEhw+PRIEvavw7
# 23HmeNTj62DasB1TXnembKGprN2lRxxgET3ANEVR3970KhbHtN2dSJwH4xqLtFPq
# qx7t7loapfUHtueP9ke+ut8X4EkQiVL2INcBSB6S9dn4VmaO8vA/5037T9yuH76v
# h7wWScXsRfogl+eY14M3/rxnn2RtonV/4/macph/J0J5mbGsalLS1paQOTfoPeM9
# Vl+W/Gtz7WuEIiUzm/1qAsQUjXZCIFN+k4E4GvcAYI+T54fT6Vq2NBqO6D7b8EPX
# apvzbnTQtDK1RZPai1r8didGBK/WO9nT92aXUWzFZjM6cKuN90H/s3qk3JK3i+f4
# 8Y3p0UuKbuTGiz4H1Z9A97MmLd+4rLIMAH3NIc+PVm7ydl95xkn26bjOPsMWC8ld
# MNOcbmqUbhl1sVFr+ut/OQIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFLa+n3f+XEum
# k0rw6Rq4nYC82YhQMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
# A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y3JsL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
# BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
# MDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUH
# AwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQBmRTVfFAPg5Mzc
# ZOG3fZNdKEh88Ggx9KwWwFCoU5mosk7HIk6WUgEWmam860Y0+QLlnyV0bxoKm+AU
# 2j+MNZ5PkWJbnd0CP0qdnGmxDc9/l9HNIYdFzEQw51chXMMnBxlRfRyN/GdrvJ02
# /x5cH9eTobpLKtHY4fpLUscxbXWbdS8oX54uMg+XjmvGKa4MKgR35p3SU4BcDn+9
# k4o3mf949h4/QtFyFlfRDofyf9mZI8yVuWLcw7znVDT1GZP9kYdr78V3L5YsOvBx
# jKRX2ZTL/hNvArDoW11Hpk8fEx0iLWmTxjaYL8bMKrQsKwfS5MV5DpDs1zcxGYRH
# /eYtZSFtpYeBfUVthyG9HbZv4G6n5g9HlD/QGFpoA3oAgF9waz67+cmggHLJkoDx
# xPIKadQj/i9boPi/LCDdcEV/h/YPAUfL96+wL7nwoyX6TbBrTlfaQrRP9sI8uFqi
# /1lfKhtrB804tgaJq4pPYVa9vBnMcgUJPGMHDDo+3m5G8IT+OdRx//GGU4YyfqIo
# 71e3j29lMTZJ8gGT/fiItNEEnoftoY9NNCfNrc59a7X91HJwLpaXmiezc+OcZdNI
# pLFeWUk+aDpH+6Uaic/9QJignqY34ReN/IMs9cuqyv3X5VMbWtjNEKM/AEUAe/gQ
# jBoTRqMKt/vl5QYjf6hdTRQ/quWhnzCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
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
# OjU1MUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQCGhXqvj0zgYF3jUrVFgHVnR/jO4KCBgzCB
# gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUA
# AgUA7ZIr4jAiGA8yMDI2MDQyMTE3MDEyMloYDzIwMjYwNDIyMTcwMTIyWjB0MDoG
# CisGAQQBhFkKBAExLDAqMAoCBQDtkiviAgEAMAcCAQACAhNWMAcCAQACAhIRMAoC
# BQDtk31iAgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
# AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEBAEbVQYLDDe0IiTUB
# uI1cLZJhahH8EDxyuGF6FWw/G2xwVq6iYi1Z65is58pCi/KAtXdoVer6qb70yXa6
# z7VX1SIvRUit63LxjixMXHIyG0AQjJftpQErgQn1zrprFbW8Etirtg8pxnwLoifq
# wl3uyTQnbRsAPy2kuErwHeTA/1Tq0EXPqyGbmkPD82k6AtsE8WkMuEWsa16AtQWJ
# Zm57ryOBMfEImRxx3PsZSlfa6NIoRheOipNxtxISIz3Hjd2QMtLmCBgL3kFpVPJN
# 8CTQjBgr6cbdurR+kr8DdZ1R+eGMfpfD/viurzwtXIIg1PS4q+t3kMTiUOr4ENF7
# aUDl1iYxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2Fz
# aGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENv
# cnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAx
# MAITMwAAAhvQsrgCZ/dyzwABAAACGzANBglghkgBZQMEAgEFAKCCAUowGgYJKoZI
# hvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCDoTMA6jlVM3PEz
# +xeeG5fuJkpia0sVfmYzpVa4bKWWHDCB+gYLKoZIhvcNAQkQAi8xgeowgecwgeQw
# gb0EIDAlFJW4PaOYxxAIVd0u4kDAOlRU1nptzp18lTzdDYuAMIGYMIGApH4wfDEL
# MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1v
# bmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWlj
# cm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIb0LK4Amf3cs8AAQAAAhsw
# IgQgSaEuTpx9zZLzw79te9DB/nsZ6IsrcA0Rh5zLUjRfjRMwDQYJKoZIhvcNAQEL
# BQAEggIAeROkOiAbK3Uow0enRtXjPhUmUgVkkfEc9x0vg4IZFJX7zCcxZvXJXl2u
# UB+tJR8NrLD5LEwE7B+BJWJWRolymgHL2czz1WCWYzak8mXqOL1xrRR5V31Gyo3V
# Ak4PYZ+QSL0le4hljSEbX7PuuLM5f6WmAI66VI+w5HaYkzYffwdt8IBcnXpZuRUB
# SVGBDXYX1C5uxA7yvA6+bUCuBe/5prQZgo5fsbkB1T5ZPyYhqjChMJpzGxDCNkX5
# 616jIw6/HSGEZgYsg/VOXHaOQd+f27UUvipkhjVt+pfjIq/mOswMwojiNxXMWbUo
# 52RIRsPgZ6W9fFidS7YzQbo6mfz3sQ0PoWz1VrKR3JzQRom0x4EOPYIt/r5lEYTi
# 8yUlD433qODXnnW1HEDl/7OjQogjnvKSRB/6hE8rbWgKi4BGnWspcqGpcZc6QpWg
# R+qNWhU4Km98++ZSdnjDJgXfmVV/pdjoumoPwvienIuusuhFW8hGbyAhZybr0j0a
# QBqi2HM0sJnMZKxcbNSAgW9tSjofHNpY3jidNuJK58q51esDAb0cS+KNxkECMkV2
# 5xc+ZibyRJy0hfQLHa5vAlAduvR8nMjYYFThmNDP97gOz5VI8Ss0slLewCUrMc8z
# AhHRDbn/KY1mdDNyfI86tV81b77ccnurjG0dMX3/iSXVgEyKcnw=
# SIG # End signature block
