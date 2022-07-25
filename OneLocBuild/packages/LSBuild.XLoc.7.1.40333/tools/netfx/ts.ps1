<#
.DESCRIPTION
    Resource parser for .ts files.

.SYNOPSIS
    Read TS file and parse all id/value/comment pairs.
    Writes TS file with id/value pairs.

.PARAMETER
    Hidden parameters from the AnyParse host.

    [string]$filePath # Path of the file to be read/write. 
    [int]$parentDbid  # internal ID to creat content nodes.
    [int]$langIDSrc   # Source language Id.
    [CultureInfo]$langCultureInfoSrc # Source language.
    [int]$langIDTgt   # Target language Id.
    [CultureInfo]$langCultureInfoTgt # Target language.
    [bool]$isGenerating # Flag if parser is generating the target file.
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

    [void]LogError([string]$msg)
    {
        Write-Host $msg
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
$langCultureInfoTgt = New-Object System.Globalization.CultureInfo 1041
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

