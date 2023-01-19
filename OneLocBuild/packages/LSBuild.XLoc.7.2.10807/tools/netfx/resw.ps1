<#
.DESCRIPTION
    Resource parser for .resw files with ICU plural format.

.NOTES
    Version 1.1

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
    02/2022
    mailto:jurgen.eidt@microsoft.com?subject=AnyParse

.NOTES
    ParserId=466
#>

# Debug
#
<#
# Default output file gets deleted by the parser.
$filePath = "C:\test\resw\Resources.resw"
$debugFilePath = "$($filePath).debug.resw"
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

    [void]SetParserID([int]$parserId)
    {
    }

    [void]LogInfo([string]$msg)
    {
        Write-Host "Info: $msg"
    }

    [void]LogWarning([string]$msg)
    {
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
    }
'@

$this = New-Object ParserStub
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo("ar-SA")
$scriptRoot = $PSScriptRoot
#>

Add-Type -Path $ScriptRoot/ICUParserLib.dll

# Set parser id to match the legacy parser id.
#$this.SetParserID(211)

# Read the .resw file.
[xml]$resw = New-Object xml
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

            # Add locked substrings for ICU resources.
            if ($icuParser.IsICU) {
                [string]$lockedSubstrings = $messageItem.LockedSubstrings | % { " (ICU){PlaceHolder=`"$_`"}" }
                $instruction += $lockedSubstrings
            }
        
            if ($messageItem.MessageItemType -eq [ICUParserLib.MessageItemTypeEnum]::ExpandedPlural) {
                # Add comment for the expanded plural.
                $instruction += " [Add language specific translation for the plural selector '$($messageItem.Description)'.]"
        
                # Add language specific lock.
                if ($messageItem.Data) {
                    $instruction += " (ICU){Locked=$($messageItem.Data)}"
                }
            }

            [string]$msgId = $id
            if ($messageItem.ResourceId) {
                $msgId += "#$($messageItem.ResourceId)"
            }

            $messageItem.Text = $this.SubmitResource($childDbid, 0, ".resx", $null, $msgId, $msg, $instruction, "", $isGenerating)
        }

        if ($isGenerating) {
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
        
            try {
                $_.value = $messageText
            }
            catch {
                throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$id'`nTranslation: '$messageText'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
            }
        }
    }
}

if ($isGenerating) {
    # Save .resw as UTF-8 without BOM.
    $encoding = [System.Text.UTF8Encoding]::new($false)
    $writer = [System.IO.StreamWriter]::new($filePath, $false, $encoding)
    $resw.Save($writer)
    $writer.Dispose()
}
