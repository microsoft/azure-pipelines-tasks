
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
# MIIpBQYJKoZIhvcNAQcCoIIo9jCCKPICAQExDzANBglghkgBZQMEAgEFADB5Bgor
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
# 7XkStEJ8NBGHBKIFMYIaiTCCGoUCAQEweTBiMQswCQYDVQQGEwJVUzEeMBwGA1UE
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
# H0tux/dJclZqytsFIK704xKAcbdMoYIXsDCCF6wGCisGAQQBgjcDAwExghecMIIX
# mAYJKoZIhvcNAQcCoIIXiTCCF4UCAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqG
# SIb3DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUD
# BAIBBQAEIITtk6N94h3CjrGyK3hDojDMi7qeFV5NCOMOXfrvlmu+AgZpvDD0/PoY
# EzIwMjYwNDIzMjEwMjIyLjEyOFowBIACAfSggdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjQzMUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloIIR/jCCBygwggUQoAMCAQICEzMAAAIdS8CShziFfjkAAQAAAh0wDQYJ
# KoZIhvcNAQELBQAwfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUw
# ODE0MTg0ODMzWhcNMjYxMTEzMTg0ODMzWjCB0zELMAkGA1UEBhMCVVMxEzARBgNV
# BAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
# c29mdCBDb3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IElyZWxhbmQgT3Bl
# cmF0aW9ucyBMaW1pdGVkMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046NDMxQS0w
# NUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2Uw
# ggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQCitKBoADyg6XimHnvjPDb1
# 6BQ3wMN6lEctfwUzXMc0mZcboqtKpQrDNwpp+im5h09MRNMK9v1ol8RK4BTSIY1Q
# Uj8PpHSS91+l7ag9f4TextNC8aLgk8fmp0hhRonjlX/hup7x429tbOkL5kqMfX3c
# N6IjVcAj3XwmhCYGGURej9OifXvbWW5kmCKdyx/kuMxjeNfzhbJdRJfd2xLuH/vF
# Uj7DXKODulr7TLej+Z7ZOy/pQlR1JNBqnk5EZJ8KdyWc/XPciKJYhavdWjtog9ay
# AnOrebkbGnFQcJCTyrNSGTnTL+4H4sYTdYgrYLvuLL2IWxJ9ItSfIwTMZENb2Zcd
# Pg8fs7PPoIepASI2/BweqW+UKHWkdCHU1dBICo6hUGzmaLp5qx/rLFZN97kOtHv3
# nTevylTpWoLZj1cxFTjAf1BthdiwhRnfcmad3LbZbUsEMBvEE9AcIGWdwYNTcGB2
# FVRUt7zSaCAU73wV2RaGjrvDiQ90JNGS92+Rjw+tBgT+dCMdcJrSDstwy21lvp6M
# wd9D61RZe/r6dnhieSvY6RrFyUULDhEhg0xYPboBZtCP9YR3OBrXx8q3DrovmDNc
# /NrqMUF88l4oTcfxAC7CmKuYfiaz7mdSM01A6Y2ComfRTX7difsKWzAPv1g3Svd9
# 1tgEwMCkFkmk2UrursddGwIDAQABo4IBSTCCAUUwHQYDVR0OBBYEFIRZ8HE0RqZm
# 1ebyCX3ZirzSN/FdMB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8G
# A1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMv
# Y3JsL01pY3Jvc29mdCUyMFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
# BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvY2VydHMvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUy
# MDIwMTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUH
# AwgwDgYDVR0PAQH/BAQDAgeAMA0GCSqGSIb3DQEBCwUAA4ICAQCR3B4HjLG8uyks
# qrQP6aLIPhDQRzFUWk1m4nGJHniBZGR5MMO7KY14HTcmGWwGlvBJgnm5lKAMEK/A
# cQPZUvyUmkWU6msnPGxdYLY1N8D47487kWTmPDoseHqN4EAMMR1ADHceqLtmbQnC
# 9D3fPl/p23GSbb1ao5wdhdFd8BDDLWFKstfJ95uWpHrqOk//2fR8KRZTiCCxSNCl
# DY2CPUNXT0nhjfLun013zX5ezqpij77tEqbyqIH/k0N6KA4uOUB4WCIRchFQlb6Y
# nKqlDD445GVqpwWNHwe7Qb7/tsx16Trxhf6Q+kMGTtR74j/GCJgnXFwNEGf+9zMu
# 03vb5EiUPhSBdgu4FIKT/+kMQ9fnPf0Kv6uRzoThjbwU+TgGGWgDK+nrbw/jF8SV
# BjxNzGtpRtlKHKmhwTqfL3kPUrUGSW1masdUoLGaCWe46UzXk0oitcWVcLN2qkK0
# jBDjXvA0BUX9AM+/PNu6Y91OLp9vS0ttJxihtXrO9sGwywoQwThOPVv2ghcLx3Js
# mridtugRdilHCLVABulI2uf4/EZb25/WrrcWcwm7iCbc6HreeNb+JV/vbeq7PIet
# KKNYyBjQeJGIdCLQnK7SHwx2FFSnubFuYtByQ+I4XACUhpQ3+TvbnL9otamRFTp+
# qYuUQ7IflanIt3bcBjL2vy/5ChtrqzCCB3EwggVZoAMCAQICEzMAAAAVxedrngKb
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
# ELQdVTNYs6FwZvKhggNZMIICQQIBATCCAQGhgdmkgdYwgdMxCzAJBgNVBAYTAlVT
# MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQK
# ExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVs
# YW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNoaWVsZCBUU1MgRVNO
# OjQzMUEtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBT
# ZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQC6g74Ept9fOrJ+L0YsR1YeQIt5P6CBgzCB
# gKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNV
# BAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAyMDEwMA0GCSqGSIb3DQEBCwUA
# AgUA7ZTRNjAiGA8yMDI2MDQyMzE3MTExOFoYDzIwMjYwNDI0MTcxMTE4WjB3MD0G
# CisGAQQBhFkKBAExLzAtMAoCBQDtlNE2AgEAMAoCAQACAjZUAgH/MAcCAQACAhKG
# MAoCBQDtliK2AgEAMDYGCisGAQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAI
# AgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQADggEBABsTmmbcsJ0E
# ZqyuhZ7wQKp1vKBLC8weya8kzuxIHpmICQsA5AjwcjepN4YqFzgFaFjTpKGPveQV
# YHE4fT17A9yX5YGeWEHxPm0OKybDU/n6ttZzbm+BqDg1M/2CAkyzbOHVmuFtnNes
# 9VGbmHsNuUDNQVqIEJC0ADJHDSTJAPN9Qp6lP7aWbhn/qhyKo2nFDdPUVcmOBIR3
# GhOvoQy7d5Awc/bz8tZJ43XetOH4T65znJPbSRBrjS1hkSX/CO28MAJQaT7jU2WP
# ogWLRMXWpgf9iywWP+XZuFesLXUt+JczM4g3kxdKT9CXF4lKlHeQTZkQrroi4bpc
# UpYWZEFabCcxggQNMIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMK
# V2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0
# IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
# MjAxMAITMwAAAh1LwJKHOIV+OQABAAACHTANBglghkgBZQMEAgEFAKCCAUowGgYJ
# KoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCCz23ArRtz3
# EOM9JQvL0xQA+2jaIVBvaW91oi64ndl0ZzCB+gYLKoZIhvcNAQkQAi8xgeowgecw
# geQwgb0EILG2lcxcSIsnOuozvt6nitM3Csw6PqClY32Fm+mPlAVRMIGYMIGApH4w
# fDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1Jl
# ZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMd
# TWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIdS8CShziFfjkAAQAA
# Ah0wIgQgaDDM/MFPHCFwbuAuDvUFflBMNpFET+s24CJJECLeWAYwDQYJKoZIhvcN
# AQELBQAEggIAFAGL0Av4YHZ6xjB/u20DRjpW+D9BF16ARaVxFTubcbxIxwZG4yHy
# UTFXF59S8b1jubVgCXuh4EzHceKhd+fWae1jhZ5gL2BZzgije7EK0xe0hoCy3ak4
# k3cGf9lFid7jVkH/5H0Pu+5L9ZBIvGFrN0ItuSckHGgh86JSwiXlLzMGdUIdIXUl
# NIr+k6YjLBI9qjie9nVe+hEIngn6vjrjL8uBhvoW5jK3qz1X5/cXQ3gVlHn97xG2
# UPyX0yCHAj04PwUZ2NZZAIFxDxRoEA+SYhZjnLSbvCl8ddlg9RHfGCYvPOIebTqT
# 38ceMzHkfWK8Pp4DgAh467RZvObVRCLoiogKEzcll5LYGehyx/MkuSD3xFmQ8NEU
# wC2iVq5JBEF+aH0BLOmCDJ9kZiAm81Jrve/Qy9tJxWshA6Mceicc0yCQRWxSqOPZ
# bE0uSIgEzlpgwVx94xQf795dcyiCAOQZnTrvlTHpFyhOFzidDKVeox3go+VnMqZu
# IROQEQUEI3XCY5OW0YJO6UcWLHdb8txNJZos3lX2dumCZqpjh7qFmL826KL6tpP8
# BcRE7q0+/KYW8Cs/C6BRCz9fTAq2MrkytXiN8ZRfb8c9eEyR/eEZ07bkCTwc4gsf
# wJoKnwrPegn25uCO+2oe52nuCkMWCsv7KvNZS5XvkHMhQ+QrldC02BU=
# SIG # End signature block
