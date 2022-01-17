<#
.DESCRIPTION
    Resource parser for .xmb files.

.SYNOPSIS
    .xmb files are the src files for the Chromium Anaheim project.
    The parser reads in the .xmb files and generates localized files
    which will be later renamed to .xtb in the post processing.

.PARAMETER
    Hidden parameters from the AnyParse host.

    [string]$filePath                   # Path of the file to be read/write. 
    [int]$parentDbid                    # Internal parent id to create content nodes.
    [int]$langIDSrc                     # Source language lcid.
    [CultureInfo]$langCultureInfoSrc    # Source language CultureInfo.
    [int]$langIDTgt                     # Target language lcid.
    [CultureInfo]$langCultureInfoTgt    # Target language CultureInfo.
    [bool]$isGenerating                 # True if generating the target file.

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
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo(1041)
$langIDTgt = $langCultureInfoTgt.LCID
$ScriptRoot = "."
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
function notContains($matchItems, $text)
{
    foreach($matchItem in $matchItems)
    {
        if($matchItem.Value.contains($text))
        {
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
if($isGenerating)
{
    # Check if the language is supported.
    if(-not [ICUParserLib.ICUParser]::IsLanguageSupported($langCultureInfoTgt))
    {
        # If the language is not supported, the ICUParserLib will fall back to the en-US plural range
        # when ComposeMessageText() is run and the language Locked instructions are wrong.
        $this.LogWarning("The language '$($langCultureInfoTgt.Name)' is not supported by the ICUParserLib. This might result in invalid plural ranges for that language.")
    }

    # The pseudo languages return 'en' as the TwoLetterISOLanguageName.
    if($langCultureInfoTgt.Name -match "qps-ploc")
    {
        $lang = $langCultureInfoTgt.Name
    }
    else
    {
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
foreach($messageNode in $messageNodes)
{
    # The id of the message.
    [string]$id = $messageNode.Attributes['id'].Value
    [string]$name = $messageNode.Attributes['name'].Value
    [string]$text = $messageNode.InnerXml.Trim()

    if($isGenerating)
    {
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
    if(!$icuParser.Success)
    {
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
    if($desc)
    {
        # Check if CHAR-LIMIT is used.
        if($desc -match $maxLengthRegex)
        {
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
    if($meaning)
    {
        $comment += " " + $meaning
    }

    # Process the message text using the ICU message format parser.
    $messageItems = $icuParser.GetMessageItems()

    # Add item as locked resource for context. 
    if($icuParser.IsICU)
    {
        [string]$lockedParentStringComment = "{Locked} Parent string for ICU MessageFormat."
        [string]$icuId = "$id.icu.content"
        $this.SubmitResource($childDbid, 1, $null, $null, $icuId, $text, $lockedParentStringComment, "", $false)
	}

    # Process the result of the ICU  message format parser.
    foreach($messageItem in $messageItems)
    {
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
        if($maxLengthValue -gt 0)
        {
            [int]$placeholdersLength = $maxLengthValue
            $placeholders | % { $placeholdersLength += $_.Length }
            if($placeholdersLength -gt 0)
            {
                $instruction += " {MaxLength=$placeholdersLength}"
            }
        }

        $placeholdersUnique = $placeholders | Select-Object -unique
        [string]$placeholder = $placeholdersUnique | % { " {Placeholder=`"$_`"}" }
        $instruction += $placeholder

        # Add locked substrings for ICU resources.
        if($icuParser.IsICU)
        {
            [string]$lockedSubstrings = $messageItem.LockedSubstrings | ? { notContains $placeholdersUnique $_ } | % { " (ICU){PlaceHolder=`"$_`"}"}
            $instruction += $lockedSubstrings
        }
        
        if ($messageItem.MessageItemType -eq [ICUParserLib.MessageItemTypeEnum]::ExpandedPlural)
        {
            # Add comment for the expanded plural.
			$instruction += " [Add language specific translation for the plural selector '$($messageItem.Description)'.]"
        
            # Add language specific lock.
            if ($messageItem.Data)
            {
			    $instruction += " (ICU){Locked=$($messageItem.Data)}"
		    }
		}

        [string]$msgId = $id
        if($messageItem.ResourceId)
        {
            $msgId += "#$($messageItem.ResourceId)"
        }

        $messageItem.Text = $this.SubmitResource($childDbid, 1, $null, $null, $msgId, $msg, $instruction, "", $isGenerating)
    }

    if($isGenerating)
    {
        [string]$messageText = $icuParser.ComposeMessageText($messageItems, $langCultureInfoTgt)

		# Validate generated ICU content.
		if ($icuParser.IsICU)
		{
            [ICUParserLib.ICUParser]$icuParserGenerated = New-Object ICUParserLib.ICUParser $messageText
            if (!$icuParserGenerated.Success)
			{
                $errorMsgs = $icuParserGenerated.Errors | % { $_ }
                $this.LogError("The generated resource '$messageText' with id '$id' is not a valid ICU format message:'$errorMsgs'")
				return
			}
        }
        
        try
        {
            $translationNode.InnerXml = $messageText
        }
        catch
        {
            $this.LogError("The resource '$messageText' with id '$id' is not valid xml:'$_'")
        }

        # Content with a leading tag will be formatted according to the XML rules, but this breaks the content in Edge.
        # If the content starts with a tag, add a space to disable the automatic formatting.
        if($translationNode.InnerXml.StartsWith("<"))
        {
            $translationNode.InnerXml = " " + $translationNode.InnerXml
        }

        [void]$rootNode.AppendChild($translationNode)
    }
}

if($isGenerating)
{
    # Write localized file.
    # The file will be later renamed to .xtb in the post processing.
    $xtbDoc.Save($filePath)
}
