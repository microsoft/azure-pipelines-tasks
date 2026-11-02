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
# BxDnPugLzbmE5YdPe6j5OHePxdm6tlIZAgZqF1Iqyg4YEzIwMjYwNjA4MjI0MjQ1
# LjgxNVowBIACAfSggdGkgc4wgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNo
# aW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29y
# cG9yYXRpb24xJTAjBgNVBAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMx
# JzAlBgNVBAsTHm5TaGllbGQgVFNTIEVTTjozMzAzLTA1RTAtRDk0NzElMCMGA1UE
# AxMcTWljcm9zb2Z0IFRpbWUtU3RhbXAgU2VydmljZaCCEeowggcgMIIFCKADAgEC
# AhMzAAACITPANfvSDyGkAAEAAAIhMA0GCSqGSIb3DQEBCwUAMHwxCzAJBgNVBAYT
# AlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYD
# VQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBU
# aW1lLVN0YW1wIFBDQSAyMDEwMB4XDTI2MDIxOTE5Mzk1NFoXDTI3MDUxNzE5Mzk1
# NFowgcsxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xJTAjBgNV
# BAsTHE1pY3Jvc29mdCBBbWVyaWNhIE9wZXJhdGlvbnMxJzAlBgNVBAsTHm5TaGll
# bGQgVFNTIEVTTjozMzAzLTA1RTAtRDk0NzElMCMGA1UEAxMcTWljcm9zb2Z0IFRp
# bWUtU3RhbXAgU2VydmljZTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIB
# ANtxMAKpTVi9GhzJYvY8v1/J//5QuzaortTVpmxGcNlKeUKvsruOADd4UIQkvkFn
# t1RMLQN5l6l/5kL7scRsHgh3OYl9ABQMUV6upjlVMeZC8/ZcDeVZIWPvjSJ1wZQe
# CU/kf89sIlTsYAdY/Yd1wKN3HWVgCjQD7MsjvHCdNB4zI5dfbXYSDhSYM88mDF1M
# zDpYVVawE9ZEGLmAOLHLaz7tHwAOTmVsEEUMHmHQKOs1Yg3u4IDMXmDu2usvydcg
# qnXSaP1HGFwZD62WG3pUi93KBFVNQZ3MUHb+cG8mpD2THEWW1BJPvR8R3HhPJoqj
# D9/n4FKHjPj/1/s1chVVMuf/yRwkB9GoWZGusW3cgpvLtWvOZi6hBYPSWY0W0ZDn
# sGsmQ+s8UA96TUAu1xtvsUfedCm+LyeDP8wVf/5yeY0VYVTb1VUubMH1e8tnFti+
# R5623SaHmV+1543asTBTKt2sq5/P2HZLqltq174LaHTYKtfBKRrTHp7OlOYaQgks
# W3bm5v9Rhc0t0d2zEYPoR9yQ4igliybgxL0X+9Kos0crz0jS9MsGeBASnosgWQg1
# qdFPc+03Hek0pEolEAtzovqaFbiEvhocvvj2o99Dva3moAybnGIpgyAnZZqeJ1Es
# 24jbnUkg3utpp4D/a9vRcWRlwhtNHWl9AaxyjhTSDm2PAgMBAAGjggFJMIIBRTAd
# BgNVHQ4EFgQU5iMizmprql+6q4/LIrUVOvlAMKcwHwYDVR0jBBgwFoAUn6cVXQBe
# Yl2D9OXSZacbUzUZ6XIwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL3d3dy5taWNy
# b3NvZnQuY29tL3BraW9wcy9jcmwvTWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBD
# QSUyMDIwMTAoMSkuY3JsMGwGCCsGAQUFBwEBBGAwXjBcBggrBgEFBQcwAoZQaHR0
# cDovL3d3dy5taWNyb3NvZnQuY29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBU
# aW1lLVN0YW1wJTIwUENBJTIwMjAxMCgxKS5jcnQwDAYDVR0TAQH/BAIwADAWBgNV
# HSUBAf8EDDAKBggrBgEFBQcDCDAOBgNVHQ8BAf8EBAMCB4AwDQYJKoZIhvcNAQEL
# BQADggIBADgj/duR2dPEPasW6bcwXzFUp0SSiEA5tt4+tD7R+vltGKaPP2xWQpP/
# uByPg4xwKVJgb4h1foyncRiwsdZ+O/B/MWh5kT7JNt0GP/VUdlBG4KbDpCp5UJNv
# DaedLucHGdZ32hlds9SmoRrAfkOpdBpYWBH0DgpZUr8i9dUMyPU+U8IRLU/cmic1
# t2GSSTPj2sm4o6blvt78EfyWioCZc5dFzbbLFZVMxasSnimyWa/x5PtWhjxf+N0p
# hM9URex+YttUVyrMy4Hy8UZ9TJaxZE5LzCCruVBh9ZxiqHs3KagBNf7BZgrfNYbt
# pFyI8ZQDPOdd1/5oe0hadAs1rkcWZJeSJqTd9K6mtZhmIeG5iMTXqGugClwEemb7
# xL+Q2qGb1aNBf7YHGdi/4l6PLqWpOLx8sEtLTr1ZdXD+m1/khX4W1iXfga9Wh6Df
# VShSZVVl7VINQmSb10NdzyX+oENiIAhPYIKw9PK31cD0lW4fF0/refsKG9YA7/jt
# BG4IOxSUUmhbDIHCXuN5ilpFUy1C3SK4kwYaOARolfVD/aPyxdRG9Nx4scMP2Kla
# 3T3ZkNYxByINGaEc0U5fV2eMG+T+TVQxyD33uPmhjOcCdKkm+WD/gE/dpUTSH9gf
# YqCwptTg1dkcCMlePZKWqjULXXkIbqoFloWQzxbq89kKbmqdJ7M6MIIHcTCCBVmg
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
# IFRTUyBFU046MzMwMy0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1l
# LVN0YW1wIFNlcnZpY2WiIwoBATAHBgUrDgMCGgMVAAtsSBlmfJgdcnUMZvl8aOmV
# em25oIGDMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwDQYJKoZI
# hvcNAQELBQACBQDt0aEIMCIYDzIwMjYwNjA4MjAxNDAwWhgPMjAyNjA2MDkyMDE0
# MDBaMHQwOgYKKwYBBAGEWQoEATEsMCowCgIFAO3RoQgCAQAwBwIBAAICBFwwBwIB
# AAICGmgwCgIFAO3S8ogCAQAwNgYKKwYBBAGEWQoEAjEoMCYwDAYKKwYBBAGEWQoD
# AqAKMAgCAQACAwehIKEKMAgCAQACAwGGoDANBgkqhkiG9w0BAQsFAAOCAQEAJo05
# KRRgedlO/68e0vRpMMEAtG+Skw38XlPh2OA+fwV3xuYPjI4AKm9nVeJney/wrXLg
# nLLNYfFFUajj7jlsr/afQXETJT+iooZHuiAYqFlhVaNKirgqbqerC7XEUx9UYNdQ
# cM+weTKI/fGZXNenRjrfpk92n4Wv+CAGltd8KtScA/jaF4yVC1GKqwEPbFpfSZ8R
# Mc/+VSYMizJskg5FyahZHq8vgG+MSi50JDFm5Du5zVh/U2U0XD+MetvM+Ih3Z5Ds
# gEQParpgvr/ldJ4Kg+1J9LPcmLQwCW5503y/ePlls75zMpJjIbzSE6wzmjW4mZTa
# z8dzPQxL7/zXmpWoYjGCBA0wggQJAgEBMIGTMHwxCzAJBgNVBAYTAlVTMRMwEQYD
# VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNy
# b3NvZnQgQ29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1w
# IFBDQSAyMDEwAhMzAAACITPANfvSDyGkAAEAAAIhMA0GCWCGSAFlAwQCAQUAoIIB
# SjAaBgkqhkiG9w0BCQMxDQYLKoZIhvcNAQkQAQQwLwYJKoZIhvcNAQkEMSIEIJw9
# /y6o+iEmlvoYOPxac5Mgu7FH0+5FpilNcLCMyoqVMIH6BgsqhkiG9w0BCRACLzGB
# 6jCB5zCB5DCBvQQgAO8hB58VVRrgEnLwhnLAwC+YZIp1RWoSbL0D748KPUQwgZgw
# gYCkfjB8MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UE
# BxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYD
# VQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAiEzwDX70g8h
# pAABAAACITAiBCAFXyHo+WD9GCJbge8EasdcdOWdyh2zjfCtllo55FIVcDANBgkq
# hkiG9w0BAQsFAASCAgCawflfMsUofDsldFrDVhSqrdLw6yV6eCCOgS91rqc9FwaA
# 5orNHx7ss013JvwhLKJ5gWAm+WutDkLDAkwhbHN9KyINiMczqzdnWCkd1cqbT7zT
# wVPtTLtUg9wZ4J4EkyWVoAyU5usquS6tNi7douyz/rb54StKxxvhT+ta0M6ORR3i
# MM4gyviiH8pepzrxtfQdpKobZGh7rKcmtUtfiQ/05NiXHc9CHJ7eo/g+wq59iSYO
# +o5yY8Rtn6Mn9TPFzlarklwENE1D9Zz4alCmKOtCEfEldIdQwAFIStMcOfwwqusA
# YkyigZYDh1AYQTbIqHnDAtvg7OK74iqeS+sWFkDf5BTOMfOENG5LaQFPaPZPmXm9
# JLAyJqn28TUHQ+FCnUQfapiTNe8sHvD97Zq3K5m/AfhQ1uYlSGQua798Z0KDYnd+
# 58poPBBIpa5kg9NHqtZpGn+R3A4xFJvGHrBf06AeHLOW9EJ8pCPeBoKIMDP1UH1W
# m0oQ3fntvP0Mk4eyEdoFJ1SO+/VjoxdCwWHtipKrszttjm7ARyi6c0E1PKp65iai
# RnZLrybfOuP4StnmsEc0sCW9nskGAFln4xY6eW0a150E6pMnx0CFphTJCJVvm28W
# Cl4VutNtkJmkyFag8ztKwPsJxubD/s16h0MfKRl0tMgCrDFIa+wDDA7tHjxMcA==
# SIG # End signature block
