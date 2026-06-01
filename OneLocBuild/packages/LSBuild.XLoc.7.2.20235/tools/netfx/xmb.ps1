<#
.DESCRIPTION
    Resource parser for .xmb files.

.NOTES
    Version 1.3

.SYNOPSIS
    .xmb files are the src files for the Chromium Anaheim project.
    The parser reads in the .xmb files and generates localized files
    which will be later renamed to .xtb in the post processing.

.PARAMETER
    Hidden parameters from the AnyParse host.

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
    02/2020
    mailto:jurgen.eidt@microsoft.com?subject=AnyParse
#>

<#
# Debug
#
# Default output file gets deleted by the parser.
$filePath = "edge_strings.xmb"
$debugFilePath = "$($filePath).debug.xmb"
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
$scriptRoot = "."
#>

Add-Type -Path $ScriptRoot/ICUParserLib.dll

<#
.SYNOPSIS
    Helper function for removing duplicate LocVer instructions.
    Checks if the match items contain the text.

.PARAMETER matchItems
    Regex match result.

.PARAMETER text
    Text to match.
#>
function notContains($matchItems, $text) {
    foreach ($matchItem in $matchItems) {
        if ($matchItem.Value.contains($text)) {
            return $false
        }
    }

    $true
}

# Setup variables.
[string]$maxLengthRegex = '\[\s*CHAR-LIMIT\s*=\s*(?<MaxLength>\d+)\s*\]'

# Read the .xmb file.
[xml]$xml = New-Object xml
$xml.Load($filePath)

# Create the parent 'Msg' node.
[int]$childDbid = $parentDbid
$this.SubmitNode([ref]$childDbid, 0, 1, $null, "Msg", $true, $true, [ManagedLSOM.ELSIconType]::elsIconString)

# Select all 'msg' nodes.
$messageNodes = $xml.SelectNodes("/messagebundle/msg")

# Prepare the header for the .xtb file.
if ($isGenerating) {
    # Check if the language is supported.
    if (-not [ICUParserLib.ICUParser]::IsLanguageSupported($langCultureInfoTgt)) {
        # If the language is not supported, the ICUParserLib will fall back to the en-US plural range
        # when ComposeMessageText() is run and the language Locked instructions are wrong.
        $this.LogWarning("The language '$($langCultureInfoTgt.Name)' is not supported by the ICUParserLib. This might result in invalid plural ranges for that language.")
    }

    # The pseudo languages return 'en' as the TwoLetterISOLanguageName.
    if ($langCultureInfoTgt.Name -match "qps-ploc") {
        $lang = $langCultureInfoTgt.Name
    }
    else {
        $lang = $langCultureInfoTgt.TwoLetterISOLanguageName
    }

    # Generate the localized .xtb file.

    # Create the .xtb document.
    [System.Xml.XmlDocument]$xtbDoc = New-Object System.Xml.XmlDocument

    # <?xml version="1.0"?>
    [System.Xml.XmlDeclaration]$declaration = $xtbDoc.CreateXmlDeclaration("1.0", $null, $null)
    [void]$xtbDoc.InsertBefore($declaration, $xtbDoc.DocumentElement)

    # <!DOCTYPE translationbundle PUBLIC "" ""[]>
    [System.Xml.XmlDocumentType]$doctype = $xtbDoc.CreateDocumentType("translationbundle", $null, $null, $null)
    [void]$xtbDoc.InsertBefore($doctype, $xtbDoc.DocumentElement)

    # <translationbundle lang="de">
    [System.Xml.XmlElement]$rootNode = $xtbDoc.CreateElement("translationbundle")
    [System.Xml.XmlAttribute]$xmlAttTranslationbundle = $xtbDoc.CreateAttribute("lang")
    $xmlAttTranslationbundle.Value = $lang
    [void]$rootNode.Attributes.Append($xmlAttTranslationbundle)
    [void]$xtbDoc.AppendChild($rootNode)
}

# Process each message node.
foreach ($messageNode in $messageNodes) {
    # The id of the message.
    [string]$id = $messageNode.Attributes['id'].Value
    [string]$name = $messageNode.Attributes['name'].Value
    [string]$text = $messageNode.InnerXml.Trim()

    if ($isGenerating) {
        [System.Xml.XmlElement]$translationNode = $xtbDoc.CreateElement("translation")

        [System.Xml.XmlAttribute]$translationIdAttr = $xtbDoc.CreateAttribute("id")
        $translationIdAttr.Value = $id
        [void]$translationNode.Attributes.Append($translationIdAttr)

        # Add name attribute to support DevTools V2.
        [System.Xml.XmlAttribute]$translationNameAttr = $xtbDoc.CreateAttribute("name")
        $translationNameAttr.Value = $name
        [void]$translationNode.Attributes.Append($translationNameAttr)
    }

    # Setup the ICU message format parser.
    [ICUParserLib.ICUParser]$icuParser = New-Object ICUParserLib.ICUParser $text
    if (!$icuParser.Success) {
        # Do not return with an error if the content could not be parsed correctly but print out a warning message.
        # The content is parsed as literal content.

        #$this.LogError("Error parsing '$text': '$errorMsgs'")
        #return

        $errorMsgs = $icuParser.Errors | % { $_ }
        $this.LogWarning("The resource '$text' with id '$id' does not follow the ICU parser syntax ($errorMsgs) and is used as literal content.")
    }

    # The name attribute of the message node provides the ID from the GDRP source file which is added to the
    # parsed XMB file. The ID is pre-pended to the existing instructions
    [string]$comment = $messageNode.Attributes['name'].Value

    # A description of the message giving enough context to the translator to translate the message correctly
    # (e.g. the message "Shut" might be a description of an action you need to take or the description of the status
    #  of something, so a description like e.g. "Shut the current dialog; button label" would help translators do the
    #  right thing).

    # CHAR-LIMIT guidelines:
    # Certain strings need character limits to prevent a long translation from breaking the UI.
    # Translators will ensure the translation fits within the limit, but may be forced to use odd
    # abbreviations to do so. There is a tradeoff here, so only use character limits when they're
    # necessary.

    # For example, a main menu item needs a character limit because the menu item can't wrap, so a long
    # translation will be cut off. On the other hand, an error message that can wrap over multiple lines
    # doesn't need a limit.

    # * Most strings - No limit. Omit "[CHAR-LIMIT=...]" altogether.
    # * Main menu items - 27, or 24 characters if it has a checkbox
    # * Settings headers - 32 characters
    # * Settings items - 32 characters
    # * Half-screen buttons - 20 characters
    # * Context menu items - 30 characters
    # * Action bar items - 32 characters

    [int]$maxLengthValue = -1
    [string]$desc = $messageNode.Attributes['desc'].Value
    if ($desc) {
        # Check if CHAR-LIMIT is used.
        if ($desc -match $maxLengthRegex) {
            [string]$maxLength = $matches['MaxLength']
            $maxLengthValue = [int]$maxLength
            # Remove CHAR-LIMIT
            $desc = $desc -replace $maxLengthRegex, ""
        }

        $comment += " " + $desc
    }

    # The meaning attribute: You can use this field to ensure that two messages that have the same text will not necessarily
    # share the same translation. This can provide a bit of context to the translators along with the 'desc' attribute.
    [string]$meaning = $messageNode.Attributes['meaning'].Value
    if ($meaning) {
        $comment += " " + $meaning
    }

    # Process the message text using the ICU message format parser.
    $messageItems = $icuParser.GetMessageItems()

    # Add item as locked resource for context. 
    if ($icuParser.IsICU) {
        [string]$lockedParentStringComment = "{Locked} Parent string for ICU MessageFormat."
        [string]$icuId = "$id.icu.content"
        $this.SubmitResource($childDbid, 1, $null, $null, $icuId, $text, $lockedParentStringComment, "", $false)
    }

    # Process the result of the ICU  message format parser.
    foreach ($messageItem in $messageItems) {
        [string]$msg = $messageItem.Text
        [string]$instruction = $comment

        # The <ph> element has a single attribute, 'name', which you use to give the placeholder a name (which must be
        # uppercase and should usually be descriptive, e.g. USER_NAME or TIME_REMAINING). Apart from the non-translatable
        # text, the <ph> element can contain a single<ex> element containing an example of what the placeholder could be
        # replaced with. This is shown to the translators, and could be e.g. "Jói" for a placeholder with a name of USER_NAME.
        # Strings can contain the same placeholder multiple times, so we only add unique placeholders to the instructions to
        # keep them as simple as possible.
        $placeholders = ([regex]::Matches($msg, '(<ph(?s).*?</ph>)'))

        # Add the length of the placeholders to the CHAR-LIMIT value as the new MaxLength instruction. 
        if ($maxLengthValue -gt 0) {
            [int]$placeholdersLength = $maxLengthValue
            $placeholders | % { $placeholdersLength += $_.Length }
            if ($placeholdersLength -gt 0) {
                $instruction += " {MaxLength=$placeholdersLength}"
            }
        }

        $placeholdersUnique = $placeholders | Select-Object -unique
        [string]$placeholder = $placeholdersUnique | % { " {Placeholder=`"$_`"}" }
        $instruction += $placeholder

        # Add locked substrings for ICU resources.
        if ($icuParser.IsICU) {
            [string]$lockedSubstrings = $messageItem.LockedSubstrings | ? { notContains $placeholdersUnique $_ } | % { " (ICU){PlaceHolder=`"$_`"}" }
            $instruction += $lockedSubstrings
        }
        
        if ($messageItem.Plural) {
            # Add comment for the plural.
            $instruction += " [Add language specific translation for the plural selector '$($messageItem.Plural)'.]"
        }

        # Add language specific lock.
        if ($messageItem.Data) {
            $instruction += " (ICU){Locked=$($messageItem.Data)}"
        }
        
        [string]$msgId = $id
        if ($messageItem.ResourceId) {
            $msgId += "#$($messageItem.ResourceId)"
        }

        $messageItem.Text = $this.SubmitResource($childDbid, 1, $null, $null, $msgId, $msg, $instruction, "", $isGenerating)
    }

    if ($isGenerating) {
        [string]$messageText = $icuParser.ComposeMessageText($messageItems, $langCultureInfoTgt)

        # Validate generated ICU content.
        if ($icuParser.IsICU) {
            [ICUParserLib.ICUParser]$icuParserGenerated = New-Object ICUParserLib.ICUParser $messageText
            if (!$icuParserGenerated.Success) {
                $errorMsgs = $icuParserGenerated.Errors | % { $_ }
                $this.LogError("The generated resource '$messageText' with id '$id' is not a valid ICU format message:'$errorMsgs'")
                return
            }
        }
        
        try {
            $translationNode.InnerXml = $messageText
        }
        catch {
            throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$id'`nTranslation: '$messageText'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
        }

        # Content with a leading tag will be formatted according to the XML rules, but this breaks the content in Edge.
        # If the content starts with a tag, add a space to disable the automatic formatting.
        if ($translationNode.InnerXml.StartsWith("<")) {
            $translationNode.InnerXml = " " + $translationNode.InnerXml
        }

        [void]$rootNode.AppendChild($translationNode)
    }
}

if ($isGenerating) {
    # Write localized file.
    # The file will be later renamed to .xtb in the post processing.
    $xtbDoc.Save($filePath)
}

# SIG # Begin signature block
# MIIo2gYJKoZIhvcNAQcCoIIoyzCCKMcCAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCAkYq9Vp6ptFc/Y
# PS/PWKpmWc/J1i+0gVNpWTgURyq4ZqCCDcMwggatMIIElaADAgECAhMzAAAA0wKI
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
# MAwGCisGAQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIGX5h3kHjVsHheebXGkwMuAQ
# qDffcoBl0dMRWDRnQ95LMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8A
# cwBvAGYAdKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEB
# BQAEggGApCMsMgJhvYixdcQwK5KqKH8t3HoLPYmciGYeBHKstog7WMB+VBFD7eb8
# 2mIu86+6D34CbjS73kl7oInrVVbVU011atl/VUjY0wZlq9tsFwkXraEzQu11gfZ3
# xx55BuCrYJQJpLCrNP/jU0WRf9nS1hMk+9TdPRDI10tmLNwCQtMr3lOkdmu0/PGg
# JtE592/SgWTKuhVg8KxgwsuhQsSutwIZL8Ma/pARXYsLAnzED1jg2ZdI0P1ioYFw
# GWA/x/7DXm5dqjuQ/0ogopm6AfJvtrk8wX6tBBrEF+ysLlX5qUs6ta3HCVkU/03P
# w6Xc0Po3gXHEXnzaNle/KjTpSX6odfpYoqq2aQJP26pHpm+5ZIeilZxd1/KHVZ2r
# q/3d3quKp18PcoliRpaIUBiIjwHETUhVrueETcaKj1Z4U+48rLeRNV8wKg74vHm0
# on9sxDYk51UpqV6oRi1xYpT9DLtvMz1efslws4ZKkefiMbhrrEd2hLuaULNRxaLd
# HzhyAmNuoYIXlDCCF5AGCisGAQQBgjcDAwExgheAMIIXfAYJKoZIhvcNAQcCoIIX
# bTCCF2kCAQMxDzANBglghkgBZQMEAgEFADCCAVIGCyqGSIb3DQEJEAEEoIIBQQSC
# AT0wggE5AgEBBgorBgEEAYRZCgMBMDEwDQYJYIZIAWUDBAIBBQAEIPIoVHjxzv5e
# BxDnPugLzbmE5YdPe6j5OHePxdm6tlIZAgZqDKyeAakYEzIwMjYwNTIwMTgzNTE5
# LjA2M1owBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
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
# hvcNAQELBQACBQDtuHxqMCIYDzIwMjYwNTIwMTgzMTA2WhgPMjAyNjA1MjExODMx
# MDZaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIFAO24fGoCAQAwBwIBAAICAekwBwIB
# AAICFFswCgIFAO25zeoCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoD
# AqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEALSyA
# tHbkljmWKaVofTzqAKqBFHFfm6fjSrUUwlhZCgDiY3AMf9BhnWoNIOcId+2qZJin
# WJEt8xcsSpQkK+6ez4UuiXGa5I8xWvIumtd8z6cptUKxdV6YjulLitYoT4h7kZco
# CTYoO+0J3sKyiIC4QJEi8y105uCcIgMFIm7KC4dCPZimb0IT9m8ajFoon4UB+Oj5
# 8VmfvG69BaIEmsCSdO0euhv1ieVQWFYeyt6pNL+z+qPe2UeuIv+ntPMeCSPjlCJa
# wrOhNacw/dHzdVbjdgSN/CMl91ABLSJ+sLjIJbfqmhclzDbI9DOtKgmSUrN7pZvM
# bZ2sIGoJx3bje31gXTGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFBDQSAyMDEwAhMzAAACIkHS9qr/yLX/AAEAAAIiMA0GCWCGSAFlAwQCAQUAoIIB
# SjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIPbi
# Hpj2scKEcRzehonKGeou6NKxXeuV6ncIdJbcrjKQMIH6BgsqhkiG9w0BCRACLzGB
# 6jCB5zCB5DCBvQQgBWBdAQoE58aCM2ySYM6ZtwQg6ccY3AD5BxG58NHkCRMwgZgw
# gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiJB0vaq/8i1
# /wABAAACIjAiBCCWiznXxoaFkKq2xnfUXonozW6XuXN/lck9K+qV5kd3XzANBgkq
# hkiG9w0BAQsFAASCAgA2WzTYEb7bsla/7ub/TakRBML8ha1oFh8A6E9OI8bZNKrC
# 6XQWN315W3ilp+IRowgZMDtip2TN/uSKwFJyIkq6l5HGh72POiu1BN4/FAxMnGX2
# bGfK6x4WTzeyWC256cC0uwfhrAdaW95uoWaDdIZn6yMArPT1zmIdXoNaKTb2uT98
# csBrk3LeaStjfVvNT0tHUSnBc6wszRuZUTVR03ctXHHb2f+VZdb3JqXXVtM4HNwA
# UA5byOSprH5QMXuA+zUhVCB9hMS5RWJrUAPmpN6dbjqoyki0qfTtrmtv+i0dyBXF
# Klr51XKOAJvOVzoDReN9fT+ZUKCF1clXhMUdscAuKOQfyjITrYHiicIZDKCQ1Ys+
# mWQU4Em6nhPDnf4v54dUKzigEJO7Ip3BXA3a5GO1wWfV+2e/MTbB/cl4WIZYVZ4u
# oyVua5u5hIOfquQC8fS8ySwMz5mQ3aTPWsweIMZGJCcRa6DkbZ66SY24Gp7pkioO
# TQNO46OObNRg9x1cMuEgExtATJTMwSuOa058KAFdJJftgBOH+231WOSn3NJE8gA6
# dkd6kLH+6A/7b/I23ZgTrO6No8ji1PAtPU74ui6GGD6FfmX3+llFRwJOo+gfl6jl
# qLHlCWoeLVTPHVAcijK32MbFAe/rPzNq9rf7imlmzujq+eBcdrh/WYtqoz1yug==
# SIG # End signature block
