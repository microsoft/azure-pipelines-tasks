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
# MIIr5AYJKoZIhvcNAQcCoIIr1TCCK9ECAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCAkYq9Vp6ptFc/Y
# PS/PWKpmWc/J1i+0gVNpWTgURyq4ZqCCEW4wggh+MIIHZqADAgECAhM2AAACAO38
# jbec3qFIAAIAAAIAMA0GCSqGSIb3DQEBCwUAMEExEzARBgoJkiaJk/IsZAEZFgNH
# QkwxEzARBgoJkiaJk/IsZAEZFgNBTUUxFTATBgNVBAMTDEFNRSBDUyBDQSAwMTAe
# Fw0yNDExMDgxMjQzMjhaFw0yNTExMDgxMjQzMjhaMCQxIjAgBgNVBAMTGU1pY3Jv
# c29mdCBBenVyZSBDb2RlIFNpZ24wggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK
# AoIBAQC5L/UPrOpwYjxcoZC0TqqvMF1WUELvwXN+k27SrA5rohJknn7Cgbxg4hGT
# XKqpcdbtsVTN3ZY896SJ20uQ+INL5OVLzpW408nCNTPYg2LtGJbqHUjpNm0hLCJ+
# gO5Jn2T8DDzIJoUijGXj1m+hRLKb2nOIicCED2GuYBmuWXnaY7INmVEaU3peryty
# ZjDuxdyGDuiPURz8lW1SUiDzoszNp1oswVr+WjDvLDUx4HlxPsG8zUjIst0NnJ6o
# z4tNFKaUBDCetcMjQxpCETn29a1CuRddxZLjPHZHfcotr5sh1S6bNQdzVaMNsxV8
# L3wjHb7XJ6ZVm662mHEiPgpyNcLhAgMBAAGjggWKMIIFhjApBgkrBgEEAYI3FQoE
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
# aG9yaXR5MB0GA1UdDgQWBBST/HE52ZUlmsYqZcZBdrXZ5u4ZnzAOBgNVHQ8BAf8E
# BAMCB4AwRQYDVR0RBD4wPKQ6MDgxHjAcBgNVBAsTFU1pY3Jvc29mdCBDb3Jwb3Jh
# dGlvbjEWMBQGA1UEBRMNMjM2MTY3KzUwMzE1NTCCAeYGA1UdHwSCAd0wggHZMIIB
# 1aCCAdGgggHNhj9odHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpaW5mcmEvQ1JM
# L0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwxLmFtZS5nYmwv
# Y3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwyLmFtZS5n
# YmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmwzLmFt
# ZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGMWh0dHA6Ly9jcmw0
# LmFtZS5nYmwvY3JsL0FNRSUyMENTJTIwQ0ElMjAwMSgyKS5jcmyGgb1sZGFwOi8v
# L0NOPUFNRSUyMENTJTIwQ0ElMjAwMSgyKSxDTj1CWTJQS0lDU0NBMDEsQ049Q0RQ
# LENOPVB1YmxpYyUyMEtleSUyMFNlcnZpY2VzLENOPVNlcnZpY2VzLENOPUNvbmZp
# Z3VyYXRpb24sREM9QU1FLERDPUdCTD9jZXJ0aWZpY2F0ZVJldm9jYXRpb25MaXN0
# P2Jhc2U/b2JqZWN0Q2xhc3M9Y1JMRGlzdHJpYnV0aW9uUG9pbnQwHwYDVR0jBBgw
# FoAUllGE4Gtve/7YBqvD8oXmKa5q+dQwHwYDVR0lBBgwFgYKKwYBBAGCN1sBAQYI
# KwYBBQUHAwMwDQYJKoZIhvcNAQELBQADggEBAEDd8Wf5RkHsB64vgn2slxDtHzSo
# It9xN/Dm3RdFjNZ0diTUPMgSPYQlSk8nIAfudnB9FLavGlvZLlyUpfrPSuikepj3
# i3pqNEFn6fNdNFv/wHMxv7hQTIDCmuoR1v1rX+w3oeleBPMnN3QmH4ff1NsynyV4
# dZdYgN9Cw9sC/S3pWZpJrbOs7YOM3vqyU6DciHhC4D9i2zByHCF2pu9nYfiQf5A2
# iUZenRvyo1E5rC+UP2VZXa4k7g66W20+zAajIKKIqEmRtWahekMkCcOIHFBY4RDA
# ybgPRSGur4VDAiZPjTXS90wQXrX9CwU20cfiCC6e76F4H95KtQjKYpzuNVAwggjo
# MIIG0KADAgECAhMfAAAAUeqP9pxzDKg7AAAAAABRMA0GCSqGSIb3DQEBCwUAMDwx
# EzARBgoJkiaJk/IsZAEZFgNHQkwxEzARBgoJkiaJk/IsZAEZFgNBTUUxEDAOBgNV
# BAMTB2FtZXJvb3QwHhcNMjEwNTIxMTg0NDE0WhcNMjYwNTIxMTg1NDE0WjBBMRMw
# EQYKCZImiZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1FMRUwEwYDVQQD
# EwxBTUUgQ1MgQ0EgMDEwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDJ
# mlIJfQGejVbXKpcyFPoFSUllalrinfEV6JMc7i+bZDoL9rNHnHDGfJgeuRIYO1LY
# /1f4oMTrhXbSaYRCS5vGc8145WcTZG908bGDCWr4GFLc411WxA+Pv2rteAcz0eHM
# H36qTQ8L0o3XOb2n+x7KJFLokXV1s6pF/WlSXsUBXGaCIIWBXyEchv+sM9eKDsUO
# LdLTITHYJQNWkiryMSEbxqdQUTVZjEz6eLRLkofDAo8pXirIYOgM770CYOiZrcKH
# K7lYOVblx22pdNawY8Te6a2dfoCaWV1QUuazg5VHiC4p/6fksgEILptOKhx9c+ia
# piNhMrHsAYx9pUtppeaFAgMBAAGjggTcMIIE2DASBgkrBgEEAYI3FQEEBQIDAgAC
# MCMGCSsGAQQBgjcVAgQWBBQSaCRCIUfL1Gu+Mc8gpMALI38/RzAdBgNVHQ4EFgQU
# llGE4Gtve/7YBqvD8oXmKa5q+dQwggEEBgNVHSUEgfwwgfkGBysGAQUCAwUGCCsG
# AQUFBwMBBggrBgEFBQcDAgYKKwYBBAGCNxQCAQYJKwYBBAGCNxUGBgorBgEEAYI3
# CgMMBgkrBgEEAYI3FQYGCCsGAQUFBwMJBggrBgEFBQgCAgYKKwYBBAGCN0ABAQYL
# KwYBBAGCNwoDBAEGCisGAQQBgjcKAwQGCSsGAQQBgjcVBQYKKwYBBAGCNxQCAgYK
# KwYBBAGCNxQCAwYIKwYBBQUHAwMGCisGAQQBgjdbAQEGCisGAQQBgjdbAgEGCisG
# AQQBgjdbAwEGCisGAQQBgjdbBQEGCisGAQQBgjdbBAEGCisGAQQBgjdbBAIwGQYJ
# KwYBBAGCNxQCBAweCgBTAHUAYgBDAEEwCwYDVR0PBAQDAgGGMBIGA1UdEwEB/wQI
# MAYBAf8CAQAwHwYDVR0jBBgwFoAUKV5RXmSuNLnrrJwNp4x1AdEJCygwggFoBgNV
# HR8EggFfMIIBWzCCAVegggFToIIBT4YxaHR0cDovL2NybC5taWNyb3NvZnQuY29t
# L3BraWluZnJhL2NybC9hbWVyb290LmNybIYjaHR0cDovL2NybDIuYW1lLmdibC9j
# cmwvYW1lcm9vdC5jcmyGI2h0dHA6Ly9jcmwzLmFtZS5nYmwvY3JsL2FtZXJvb3Qu
# Y3JshiNodHRwOi8vY3JsMS5hbWUuZ2JsL2NybC9hbWVyb290LmNybIaBqmxkYXA6
# Ly8vQ049YW1lcm9vdCxDTj1BTUVSb290LENOPUNEUCxDTj1QdWJsaWMlMjBLZXkl
# MjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1cmF0aW9uLERDPUFNRSxE
# Qz1HQkw/Y2VydGlmaWNhdGVSZXZvY2F0aW9uTGlzdD9iYXNlP29iamVjdENsYXNz
# PWNSTERpc3RyaWJ1dGlvblBvaW50MIIBqwYIKwYBBQUHAQEEggGdMIIBmTBHBggr
# BgEFBQcwAoY7aHR0cDovL2NybC5taWNyb3NvZnQuY29tL3BraWluZnJhL2NlcnRz
# L0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUHMAKGK2h0dHA6Ly9jcmwyLmFt
# ZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUHMAKGK2h0dHA6
# Ly9jcmwzLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQwNwYIKwYBBQUH
# MAKGK2h0dHA6Ly9jcmwxLmFtZS5nYmwvYWlhL0FNRVJvb3RfYW1lcm9vdC5jcnQw
# gaIGCCsGAQUFBzAChoGVbGRhcDovLy9DTj1hbWVyb290LENOPUFJQSxDTj1QdWJs
# aWMlMjBLZXklMjBTZXJ2aWNlcyxDTj1TZXJ2aWNlcyxDTj1Db25maWd1cmF0aW9u
# LERDPUFNRSxEQz1HQkw/Y0FDZXJ0aWZpY2F0ZT9iYXNlP29iamVjdENsYXNzPWNl
# cnRpZmljYXRpb25BdXRob3JpdHkwDQYJKoZIhvcNAQELBQADggIBAFAQI7dPD+jf
# XtGt3vJp2pyzA/HUu8hjKaRpM3opya5G3ocprRd7vdTHb8BDfRN+AD0YEmeDB5HK
# QoG6xHPI5TXuIi5sm/LeADbV3C2q0HQOygS/VT+m1W7a/752hMIn+L4ZuyxVeSBp
# fwf7oQ4YSZPh6+ngZvBHgfBaVz4O9/wcfw91QDZnTgK9zAh9yRKKls2bziPEnxeO
# ZMVNaxyV0v152PY2xjqIafIkUjK6vY9LtVFjJXenVUAmn3WCPWNFC1YTIIHw/mD2
# cTfPy7QA1pT+GPARAKt0bKtq9aCd/Ym0b5tPbpgCiRtzyb7fbNS1dE740re0COE6
# 7YV2wbeo2sXixzvLftH8L7s9xv9wV+G22qyKt6lmKLjFK1yMw4Ni5fMabcgmzRvS
# jAcbqgp3tk4a8emaaH0rz8MuuIP+yrxtREPXSqL/C5bzMzsikuDW9xH10graZzSm
# PjilzpRfRdu20/9UQmC7eVPZ4j1WNa1oqPHfzET3ChIzJ6Q9G3NPCB+7KwX0OQmK
# yv7IDimj8U/GlsHD1z+EF/fYMf8YXG15LamaOAohsw/ywO6SYSreVW+5Y0mzJutn
# BC9Cm9ozj1+/4kqksrlhZgR/CSxhFH3BTweH8gP2FEISRtShDZbuYymynY1un+Ry
# fiK9+iVTLdD1h/SxyxDpZMtimb4CgJQlMYIZzDCCGcgCAQEwWDBBMRMwEQYKCZIm
# iZPyLGQBGRYDR0JMMRMwEQYKCZImiZPyLGQBGRYDQU1FMRUwEwYDVQQDEwxBTUUg
# Q1MgQ0EgMDECEzYAAAIA7fyNt5zeoUgAAgAAAgAwDQYJYIZIAWUDBAIBBQCgga4w
# GQYJKoZIhvcNAQkDMQwGCisGAQQBgjcCAQQwHAYKKwYBBAGCNwIBCzEOMAwGCisG
# AQQBgjcCARUwLwYJKoZIhvcNAQkEMSIEIGX5h3kHjVsHheebXGkwMuAQqDffcoBl
# 0dMRWDRnQ95LMEIGCisGAQQBgjcCAQwxNDAyoBSAEgBNAGkAYwByAG8AcwBvAGYA
# dKEagBhodHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20wDQYJKoZIhvcNAQEBBQAEggEA
# FoaqVxabLjaC7Tb15n7HIUOoLchi0fM2saR/rcsmmThN4onGl8/CcNS6WzDwzKQL
# YyEKefNlE1e0rWi80oQ8cnNgBFMQts2xFGNvC7XIHRjFQkDSctqyTZD1Ag6mDcsa
# NpDuHKRSQOyZ1T9FGRnL1oSfYoSVHeJVW65PyDXRSzUEmmQSl56Kr3TfS1Ehp6n9
# X6+UD9lBaHF69B8mTkn9ReCxK7tKx97a6W6v29YEBTEDKyJQNCd3dow8cntLky4e
# ObaZb2jJVnasDnbt7lLjduh7R4v8qqGGCGR96CDgG94MKY1cJTu1M2kTITZk8HUw
# Cxb0LPm9yucsYhCO+h8MlaGCF5QwgheQBgorBgEEAYI3AwMBMYIXgDCCF3wGCSqG
# SIb3DQEHAqCCF20wghdpAgEDMQ8wDQYJYIZIAWUDBAIBBQAwggFSBgsqhkiG9w0B
# CRABBKCCAUEEggE9MIIBOQIBAQYKKwYBBAGEWQoDATAxMA0GCWCGSAFlAwQCAQUA
# BCBHClpaXBHq2O0YBzFhVwu5meWb8JwJbpueuzLsblyiSAIGaKOoCd/TGBMyMDI1
# MTAxMzE4NDI0NS4wMzdaMASAAgH0oIHRpIHOMIHLMQswCQYDVQQGEwJVUzETMBEG
# A1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWlj
# cm9zb2Z0IENvcnBvcmF0aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBP
# cGVyYXRpb25zMScwJQYDVQQLEx5uU2hpZWxkIFRTUyBFU046ODkwMC0wNUUwLUQ5
# NDcxJTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2WgghHqMIIH
# IDCCBQigAwIBAgITMwAAAg4syyh9lSB1YwABAAACDjANBgkqhkiG9w0BAQsFADB8
# MQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVk
# bW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1N
# aWNyb3NvZnQgVGltZS1TdGFtcCBQQ0EgMjAxMDAeFw0yNTAxMzAxOTQzMDNaFw0y
# NjA0MjIxOTQzMDNaMIHLMQswCQYDVQQGEwJVUzETMBEGA1UECBMKV2FzaGluZ3Rv
# bjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0
# aW9uMSUwIwYDVQQLExxNaWNyb3NvZnQgQW1lcmljYSBPcGVyYXRpb25zMScwJQYD
# VQQLEx5uU2hpZWxkIFRTUyBFU046ODkwMC0wNUUwLUQ5NDcxJTAjBgNVBAMTHE1p
# Y3Jvc29mdCBUaW1lLVN0YW1wIFNlcnZpY2UwggIiMA0GCSqGSIb3DQEBAQUAA4IC
# DwAwggIKAoICAQCs5t7iRtXt0hbeo9ME78ZYjIo3saQuWMBFQ7X4s9vooYRABTOf
# 2poTHatx+EwnBUGB1V2t/E6MwsQNmY5XpM/75aCrZdxAnrV9o4Tu5sBepbbfehsr
# OWRBIGoJE6PtWod1CrFehm1diz3jY3H8iFrh7nqefniZ1SnbcWPMyNIxuGFzpQiD
# A+E5YS33meMqaXwhdb01Cluymh/3EKvknj4dIpQZEWOPM3jxbRVAYN5J2tOrYkJc
# dDx0l02V/NYd1qkvUBgPxrKviq5kz7E6AbOifCDSMBgcn/X7RQw630Qkzqhp0kDU
# 2qei/ao9IHmuuReXEjnjpgTsr4Ab33ICAKMYxOQe+n5wqEVcE9OTyhmWZJS5AnWU
# Tniok4mgwONBWQ1DLOGFkZwXT334IPCqd4/3/Ld/ItizistyUZYsml/C4ZhdALbv
# fYwzv31Oxf8NTmV5IGxWdHnk2Hhh4bnzTKosEaDrJvQMiQ+loojM7f5bgdyBBnYQ
# Bm5+/iJsxw8k227zF2jbNI+Ows8HLeZGt8t6uJ2eVjND1B0YtgsBP0csBlnnI+4+
# dvLYRt0cAqw6PiYSz5FSZcbpi0xdAH/jd3dzyGArbyLuo69HugfGEEb/sM07rcoP
# 1o3cZ8eWMb4+MIB8euOb5DVPDnEcFi4NDukYM91g1Dt/qIek+rtE88VS8QIDAQAB
# o4IBSTCCAUUwHQYDVR0OBBYEFIVxRGlSEZE+1ESK6UGI7YNcEIjbMB8GA1UdIwQY
# MBaAFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMF8GA1UdHwRYMFYwVKBSoFCGTmh0dHA6
# Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUyMFRpbWUt
# U3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBsBggrBgEFBQcBAQRgMF4wXAYIKwYB
# BQUHMAKGUGh0dHA6Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMvTWlj
# cm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIwMTAoMSkuY3J0MAwGA1UdEwEB
# /wQCMAAwFgYDVR0lAQH/BAwwCgYIKwYBBQUHAwgwDgYDVR0PAQH/BAQDAgeAMA0G
# CSqGSIb3DQEBCwUAA4ICAQB14L2TL+L8OXLxnGSal2h30mZ7FsBFooiYkUVOY05F
# 9pnwPTVufEDGWEpNNy2OfaUHWIOoQ/9/rjwO0hS2SpB0BzMAk2gyz92NGWOpWbpB
# dMvrrRDpiWZi/uLS4ZGdRn3P2DccYmlkNP+vaRAXvnv+mp27KgI79mJ9hGyCQbvt
# MIjkbYoLqK7sF7Wahn9rLjX1y5QJL4lvEy3QmA9KRBj56cEv/lAvzDq7eSiqRq/p
# Cyqyc8uzmQ8SeKWyWu6DjUA9vi84QsmLjqPGCnH4cPyg+t95RpW+73snhew1iCV+
# wXu2RxMnWg7EsD5eLkJHLszUIPd+XClD+FTvV03GfrDDfk+45flH/eKRZc3MUZtn
# hLJjPwv3KoKDScW4iV6SbCRycYPkqoWBrHf7SvDA7GrH2UOtz1Wa1k27sdZgpG6/
# c9CqKI8CX5vgaa+A7oYHb4ZBj7S8u8sgxwWK7HgWDRByOH3CiJu4LJ8h3TiRkRAr
# mHRp0lbNf1iAKuL886IKE912v0yq55t8jMxjBU7uoLsrYVIoKkzh+sAkgkpGOoZL
# 14+dlxVM91Bavza4kODTUlwzb+SpXsSqVx8nuB6qhUy7pqpgww1q4SNhAxFnFxsx
# iTlaoL75GNxPR605lJ2WXehtEi7/+YfJqvH+vnqcpqCjyQ9hNaVzuOEHX4Myuqcj
# wjCCB3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAAABUwDQYJKoZIhvcNAQEL
# BQAwgYgxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQH
# EwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24xMjAwBgNV
# BAMTKU1pY3Jvc29mdCBSb290IENlcnRpZmljYXRlIEF1dGhvcml0eSAyMDEwMB4X
# DTIxMDkzMDE4MjIyNVoXDTMwMDkzMDE4MzIyNVowfDELMAkGA1UEBhMCVVMxEzAR
# BgNVBAgTCldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1p
# Y3Jvc29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3Rh
# bXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQDk4aZM
# 57RyIQt5osvXJHm9DtWC0/3unAcH0qlsTnXIyjVX9gF/bErg4r25PhdgM/9cT8dm
# 95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjoYH1qUoNEt6aORmsHFPPFdvWGUNzB
# RMhxXFExN6AKOG6N7dcP2CZTfDlhAnrEqv1yaa8dq6z2Nr41JmTamDu6GnszrYBb
# fowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v3byNpOORj7I5LFGc6XBpDco2LXCO
# Mcg1KL3jtIckw+DJj361VI/c+gVVmG1oO5pGve2krnopN6zL64NF50ZuyjLVwIYw
# XE8s4mKyzbnijYjklqwBSru+cakXW2dg3viSkR4dPf0gz3N9QZpGdc3EXzTdEonW
# /aUgfX782Z5F37ZyL9t9X4C626p+Nuw2TPYrbqgSUei/BQOj0XOmTTd0lBw0gg/w
# EPK3Rxjtp+iZfD9M269ewvPV2HM9Q07BMzlMjgK8QmguEOqEUUbi0b1qGFphAXPK
# Z6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJNmSLW6CmgyFdXzB0kZSU2LlQ+QuJYfM2
# BjUYhEfb3BvR/bLUHMVr9lxSUV0S2yW6r1AFemzFER1y7435UsSFF5PAPBXbGjfH
# CBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIurQIDAQABo4IB3TCCAdkwEgYJKwYB
# BAGCNxUBBAUCAwEAATAjBgkrBgEEAYI3FQIEFgQUKqdS/mTEmr6CkTxGNSnPEP8v
# BO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWnG1M1GelyMFwGA1UdIARVMFMwUQYM
# KwYBBAGCN0yDfQEBMEEwPwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0
# LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5Lmh0bTATBgNVHSUEDDAKBggrBgEF
# BQcDCDAZBgkrBgEEAYI3FAIEDB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYwDwYD
# VR0TAQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+iiXGJo0T2UkFvXzpoYxDBW
# BgNVHR8ETzBNMEugSaBHhkVodHRwOi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2Ny
# bC9wcm9kdWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcmwwWgYIKwYBBQUH
# AQEETjBMMEoGCCsGAQUFBzAChj5odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtp
# L2NlcnRzL01pY1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNydDANBgkqhkiG9w0BAQsF
# AAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv6lwUtj5OR2R4sQaTlz0xM7U518Jx
# Nj/aZGx80HU5bbsPMeTCj/ts0aGUGCLu6WZnOlNN3Zi6th542DYunKmCVgADsAW+
# iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1bSNU5HhTdSRXud2f8449xvNo32X2
# pFaq95W2KFUn0CS9QKC/GbYSEhFdPSfgQJY4rPf5KYnDvBewVIVCs/wMnosZiefw
# C2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU6ZGyqVvfSaN0DLzskYDSPeZKPmY7
# T7uG+jIa2Zb0j/aRAfbOxnT99kxybxCrdTDFNLB62FD+CljdQDzHVG2dY3RILLFO
# Ry3BFARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/HltEAY5aGZFrDZ+kKNxnGSgkujhL
# mm77IVRrakURR6nxt67I6IleT53S0Ex2tVdUCbFpAUR+fKFhbHP+CrvsQWY9af3L
# wUFJfn6Tvsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmNcP7ntdAoGokLjzbaukz5
# m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9JZTmdHRbatGePu1+oDEzfbzL6Xu/OHBE
# 0ZDxyKs6ijoIYn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNYs6FwZvKhggNNMIICNQIB
# ATCB+aGB0aSBzjCByzELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
# EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlv
# bjElMCMGA1UECxMcTWljcm9zb2Z0IEFtZXJpY2EgT3BlcmF0aW9uczEnMCUGA1UE
# CxMeblNoaWVsZCBUU1MgRVNOOjg5MDAtMDVFMC1EOTQ3MSUwIwYDVQQDExxNaWNy
# b3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNloiMKAQEwBwYFKw4DAhoDFQBK6HY/ZWLn
# OcMEQsjkDAoB/JZWCKCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYDVQQIEwpX
# YXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQg
# Q29ycG9yYXRpb24xJjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBDQSAy
# MDEwMA0GCSqGSIb3DQEBCwUAAgUA7JdKRjAiGA8yMDI1MTAxMzA5NTIwNloYDzIw
# MjUxMDE0MDk1MjA2WjB0MDoGCisGAQQBhFkKBAExLDAqMAoCBQDsl0pGAgEAMAcC
# AQACAge7MAcCAQACAhH0MAoCBQDsmJvGAgEAMDYGCisGAQQBhFkKBAIxKDAmMAwG
# CisGAQQBhFkKAwKgCjAIAgEAAgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQEL
# BQADggEBAOL+LrjNtmOyLD0MxZ7jPZXzwztjBCpIo9NDX1/Q0HyWG2lz+lEWiRSf
# DHZXL0wxoftZtv7DdwMiLCtX5AVnmebShSbK++DXFu+jGqSujZ8Qb2ET0VVe/UZF
# siGtpuk4mINW88KLNGoV1Q1dqRxTyUT6m74aE9ejaly7WxnvPb/TOtEub0ZK4v9u
# AuJwcgOcGDwFHk7lHZx9VMsmPliOSuOXW1dbW+m8NFdiHpN2qD0N1etIpqZ4z1U8
# QdEOIod1pIFY1yUHCWP7XZfsJPjuUTSk/q4KAaQJY09m3mkpuIvEqjA7eLb5jljW
# LUOdkBxFzKKckB3gBLvGZFWT+FVu7IoxggQNMIIECQIBATCBkzB8MQswCQYDVQQG
# EwJVUzETMBEGA1UECBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEeMBwG
# A1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYwJAYDVQQDEx1NaWNyb3NvZnQg
# VGltZS1TdGFtcCBQQ0EgMjAxMAITMwAAAg4syyh9lSB1YwABAAACDjANBglghkgB
# ZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3DQEJEAEEMC8GCSqGSIb3
# DQEJBDEiBCDzf9ZBrqgSFMqe1Nh6L4XhFc013m+3/t2s1WzygwB+oDCB+gYLKoZI
# hvcNAQkQAi8xgeowgecwgeQwgb0EIAF0HXMl8OmBkK267mxobKSihwOdP0eUNXQM
# ypPzTxKGMIGYMIGApH4wfDELMAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0
# b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3Jh
# dGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRpbWUtU3RhbXAgUENBIDIwMTACEzMA
# AAIOLMsofZUgdWMAAQAAAg4wIgQg/DNOWcqzSR12D2yTSGwY9Tq4SkbDtoCR+UNU
# sgjd2DUwDQYJKoZIhvcNAQELBQAEggIAA5rGhrtFjGMgKbmh6BDr1mrpqz25pYdj
# 29EDEIU7Ft5T6bKPZtIvFMRNOanMkvmVx/PCm9oBlzT2fQJZZwSvvLJ/882f3Zvz
# 7NePB5c9GFVPRywTSMdArDNB61BvN+s68P0ozweYbypWfGnZSKdtD63nl9BWbb2U
# ZQtXXDi4k/PidbVmecMbNJz05nQFR2FwMoH9RVQ8Cv2Oxn9w/xUggzqCe7R327Jc
# dBoKu1pz8Ha8gbUWwWhuKnRNoW66Bpn/ABQvIUNyRtfzmkBdd5TuwDUlhByBSDt1
# tVa45L8VesXBcQmx64pBVYZ+mOFfsnvjjQfJmoPh3BQvLRoLqNXoK1bsqs5mVR8X
# BaVMQNdndxi3VNxPYhjgxJ5nSlcx0VXS2p6FRu0VVDAagaQOOeTINSmfsr77iqr5
# EQlDYt/wUlPYPuyRKiQ2eOL2lQEkkmfgEoXBT2/tJrdyUhB3F+FQNwoblwK1A7ge
# 940L1jOkhsZ3jp/ZkJz2IN1qjtOHSn+8aMy7H8MxTx9QStwR0ySn9vH/mGq3oSm8
# 9uZatPwLwqXmjmu6Rco4rLRdiAEDqT6KZ0JyXX/Wsw+Vmjx/nTlQ4TnEhqSVz0na
# X3w5JFhTrYcknPqxUgA2z3PZXhQtDyWazkjJo0VpKuHy0IHB0JWxta0Z0q5d2dn8
# kKie/Yt1FAg=
# SIG # End signature block
