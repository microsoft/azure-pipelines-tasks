<#
.DESCRIPTION
    Resource parser for .resw files with ICU plural format.

.NOTES
    Version 1.6

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
    02/2023
    mailto:jurgen.eidt@microsoft.com?subject=AnyParse

.NOTES
    ParserId=466
#>

# Debug
#
<#
# Default output file gets deleted by the parser.
#$filePath = "C:\test\resw\Resources.resw"
$filePath = "C:\test\resw\test.resx"
$debugFilePath = "$($filePath).debug.resw"
Copy-Item $filePath -Destination $debugFilePath
$filePath = $debugFilePath

$isGenerating = $true

class TargetString {
    [String]$String
}

class LSItemClass {
    [TargetString]$TargetString
}

class ParserStub {
    [void]SubmitNode([ref]$parentDBID, [int]$displayParent, [nullable[int]]$numResType, [string]$strResType, [string]$nodeName, [bool]$isExpandable, [bool]$visible, $iconType) {
    }

    [string]SubmitResource([int]$parentDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [string]$comment, [string]$termNote, [bool]$isGenerating) { 
        Write-Host "Comment='$comment'"
        Write-Host "id='$strResID', text='$resStr'"
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [string]SubmitResource([int]$parentDBID, [ref]$childDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [int]$stringType, [int]$iconType, [bool]$devSourceLock, [string]$comment, [string]$termNote, [bool]$isGenerating) { 
        Write-Host "id='$strResID', text='$resStr'"
        return "[ソボミダゾ$resStr !!! !!! !!! ]"
    }

    [hashtable]SubmitResource([int]$parentDBID, [ref]$childDBID, [nullable[int]]$numResType, [string]$strResType, [nullable[int]]$numResID, [string]$strResID, [string]$resStr, [int]$stringType, [int]$iconType, [bool]$devSourceLock, [string]$comment, [string]$termNote, [bool]$isGenerating, [bool]$parseHotKey) { 
        Write-Host "id='$strResID', text='$resStr'"
        $lsitem = @{}
        $lsitem.TargetString = "[ソボミダゾ$resStr !!! !!! !!! ]"
        $lsitem.TranslationStatus = [ManagedLSOM.ELSTransStatus]::elsLocalized
        $lsitem.IsLocked = $false
        $lsitem.UserSourceLock = $false
        return $lsitem
    }

    [void]SetParserID([int]$parserId) {
    }

    [void]LogInfo([string]$msg) {
        Write-Host "Info: $msg"
    }

    [void]LogWarning([string]$msg) {
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
        public class ELSStringType 
        {
            public static int elsStrText = 1;
        }
        public class ELSTransStatus 
        {
            public static int elsNotLocalized = 1;
            public static int elsTransStatusUpdated = 2;
            public static int elsLocalized = 4;
            public static int elsTransStatusNotApplicable = 5;
        }
    }
'@

$this = New-Object ParserStub
$langCultureInfoTgt = [System.Globalization.CultureInfo]::GetCultureInfo("ar-SA")
$scriptRoot = $PSScriptRoot
#>

Add-Type -Path $ScriptRoot/ICUParserLib.dll

# Read the .resw file.
[xml]$resw = [xml]::new()
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

        # Add item as dev locked resource for context. 
        if ($icuParser.IsICU) {
            [string]$lockedParentStringComment = "Parent string for ICU MessageFormat."
            [string]$icuId = "$id.icu.content"
            [int]$dbid = 0
            $this.SubmitResource($childDbid, [ref]$dbid, 1, $null, $null, $icuId, $text, [ManagedLSOM.ELSStringType]::elsStrText, [ManagedLSOM.ELSIconType]::elsIconString, $true, $lockedParentStringComment, "", $false)
        }

        # Get the loc status. Only localized (not locked) items will be in the generated file.
        [bool]$localized = $false

        # Process the result of the ICU  message format parser.
        foreach ($messageItem in $messageItems) {
            [string]$msg = $messageItem.Text
            [string]$instruction = $comment

            # Add locked substrings for ICU resources.
            if ($icuParser.IsICU) {
                [string]$lockedSubstrings = $messageItem.LockedSubstrings | % { " {PlaceHolder=`"$_`"}" }
                $instruction += " (ICU)$lockedSubstrings"
            }
        
            if ($messageItem.Plural) {
                # Add comment for the plural.
                $instruction += " [Add language specific translation for the plural selector '$($messageItem.Plural)'.]"
            }
    
            # Add language specific lock.
            if ($messageItem.Data) {
                $instruction += " {Locked=$($messageItem.Data)}"
            }

            [string]$msgId = $id
            if ($messageItem.ResourceId) {
                $msgId += "#$($messageItem.ResourceId)"
            }

            [int]$dbid = 0
            [hashtable]$lsitem = $this.SubmitResource($childDbid, [ref]$dbid, 0, ".resx", $null, $msgId, $msg, [ManagedLSOM.ELSStringType]::elsStrText, [ManagedLSOM.ELSIconType]::elsIconString, $false, $instruction, "", $isGenerating, $true)

            if ($isGenerating) {
                $messageItem.Text = $lsitem.TargetString

                # Get the loc status of the item.
                if ($lsitem.TranslationStatus -eq [ManagedLSOM.ELSTransStatus]::elsLocalized -and -not $lsitem.IsLocked -and -not $lsitem.UserSourceLock) {
                    $localized = $true
                }
            }
        }

        if ($isGenerating) {
            # Include only localized (not locked) resources.
            if ($localized) {
                try {
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
        
                    $_.value = $messageText
                }
                catch {
                    throw [System.IO.InvalidDataException] "Invalid translation for resourceID '$id'`nTranslation: '$messageText'`nTargetculture: '$($langCultureInfoTgt.Name)'`nFilename: '$filePath'`nError: '$_'"
                }
            }
            else {
                # Exclude the not localized item.
                [void]($resw.root.RemoveChild($_))
            }
        }
    }
}

if ($isGenerating) {
    # Save .resw as UTF-8 with BOM.
    $resw.Save($filePath)
}
