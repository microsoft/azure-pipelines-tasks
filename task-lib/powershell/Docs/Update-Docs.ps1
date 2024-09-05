[CmdletBinding()]
param([switch]$NoNewProcess)

if (!$NoNewProcess) {
    # Run the update in a separate process since it requires importing the module.
    Write-Host "Launching new process."
    & (Get-Command -Name powershell.exe -CommandType Application) -Command ". '$($MyInvocation.MyCommand.Path)' -NoNewProcess"
    return
}

function Get-HelpString {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [switch]$Full)

    # Format the help as a string.
    $str = Get-Help @PSBoundParameters |
        Out-String -Width 110 # This width fits GitHub.

    # Split the help string into sections.
    $sections = @( )
    $section = $null
    foreach ($line in $str.Trim().Replace("`r", "").Split("`n")) {
        $line = $line.TrimEnd()
        $line = $line.Replace("http://go.microsoft.com", "https://go.microsoft.com")
        $line = $line.Replace("https:/go.microsoft.com", "https://go.microsoft.com")
        # Add the blank line.
        if (!$line) {
            # Prevent multiple blank lines.
            if ($section.Lines[$section.Lines.Count - 1]) { $section.Lines += "" }
            continue
        # Append the section content line.
        } elseif ($line.StartsWith(" ") -and !($isExample = $line -like "*----- EXAMPLE*")) {
            $section.Lines += $line
            continue
        # Append the previous section.
        } elseif ($section) {
            $sections += $section
        }

        # Start a new section.
        $section = @{ Name = $line ; Lines = @( $line ) }
        if ($isExample) { $section.Lines += "" }
    }

    # Append the last section.
    $sections += $section

    # Recombine all sections into a single string.
    $str = foreach ($section in $sections) {
        # Skip specific sections.
        if ($section.Name -in "ALIASES", "RELATED LINKS", "REMARKS") { continue }
        # Collapse the section into a single string.
        $sectionStr = ($section.Lines | Out-String -Width ([int]::MaxValue)).TrimEnd()
        # Skip empty sections.
        if ($sectionStr -eq $section.Name) { continue }
        $sectionStr.TrimEnd() # Output the section as a string.
        "" # Output a blank line between sections.
    }
    ($str | Out-String -Width ([int]::MaxValue)).Trim()
}

# If the module is not already imported, then set a flag to remove it at the end of the script.
$removeModule = @(Get-Module -Name VstsTaskSdk).Count -eq 0

# Build the module.
Write-Host "Building the module."
Push-Location -LiteralPath $PSScriptRoot\.. -ErrorAction Stop
try {
    & node make.js build
    Write-Host "node exited with code '$LASTEXITCODE'"
    if ($LASTEXITCODE) {
        throw "Build failed."
    }
} finally {
    Pop-Location
}

# Build a mapping of which functions belong to which files.
Write-Host "Resolving raw function to file mappings."
$rawFunctionToFileMap = @{ }
foreach ($ps1File in Get-ChildItem -LiteralPath $PSScriptRoot\..\VstsTaskSdk -Filter '*.ps1') {
    $parseErrors = $null
    $tokens = [System.Management.Automation.PSParser]::Tokenize((Get-Content -LiteralPath $ps1File.FullName), [ref]$parseErrors)
    if ($parseErrors) {
        $OFS = " "
        throw "Errors parsing file: $($ps1File.FullName) ; Errors: $parseErrors"
    }

    for ($i = 0 ; $i -lt $tokens.Count ; $i++) {
        $token = $tokens[$i]
        if ($token.Type -ne 'Keyword' -or $token.Content -ne 'function') {
            continue
        }

        while (($nextToken = $tokens[++$i]).Type -ne 'CommandArgument') {
            # Intentionally empty.
        }

        $rawFunctionToFileMap[$nextToken.Content] = $ps1File
    }
}

# Import the module.
Write-Host "Importing the module."
$module = Import-Module -Name $PSScriptRoot\..\_build\VstsTaskSdk -Force -PassThru -ArgumentList @{ NonInteractive = $true }

# Build a mapping of function name to help text.
Write-Host "Generating help text."
$functionToHelpMap = @{ }
$functionToFullHelpMap = @{ }
foreach ($functionName in $module.ExportedFunctions.Keys) {
    if ($functionName -eq 'Out-VstsDefault') { continue }
    Write-Host " $functionName"
    $rawFunctionName = $functionName.Replace('-Vsts', '-')
    $functionToHelpMap[$functionName] = Get-HelpString -Name $functionName
    $functionToFullHelpMap[$functionName] = Get-HelpString -Name $functionName -Full
}

# Build a mapping of help sections to functions.
Write-Host "Resolving section information."
$sectionToFunctionsMap = @{ }
foreach ($functionName in $functionToHelpMap.Keys) {
    $rawFunctionName = $functionName.Replace('-Vsts', '-')
    $ps1File = $rawFunctionToFileMap[$rawFunctionName]
    if (!$ps1File) { throw "Raw function to file map not found for function '$functionName'." }
    if (!$ps1File.Name.EndsWith('Functions.ps1')) { throw "Unexpected ps1 file name format '$($ps1File.Name)'." }
    $rawSectionName = $ps1File.Name.Substring(0, $ps1File.Name.IndexOf('Functions.ps1'))

    # Format the section name.
    [string]$sectionName = ''
    for ($i = 0 ; $i -lt $rawSectionName.Length ; $i++) {
        $wasUpper = $false
        if ($i -gt 0 -and
            [char]::IsUpper($rawSectionName, $i)) {
            $sectionName += ' '
            $wasUpper = $true
        }

        $sectionName += $rawSectionName[$i]
        if ($i -eq 0 -or $wasUpper) {
            # If the next char is the last char, take it too.
            # OR if the next two chars are both upper, take the first one too.
            while (($i + 1 -eq $rawSectionName.Length - 1) -or
                ($i + 2 -lt $rawSectionName.Length -and [char]::IsUpper($rawSectionName, $i + 1) -and [char]::IsUpper($rawSectionName, $i + 2)))
            {
                $sectionName += $rawSectionName[++$i]
            }
        }
    }

    # Add the section to the dictionary or update the dictionary record.
    if (!$sectionToFunctionsMap.ContainsKey($sectionName)) { $sectionToFunctionsMap[$sectionName] = @( ) }
    $sectionToFunctionsMap[$sectionName] += @( $functionName )
}

# Build the Commands markdown content and write the full help files.
Write-Host "Creating markdown files."
$null = [System.IO.Directory]::CreateDirectory("$PSScriptRoot\FullHelp")
Get-ChildItem -LiteralPath $PSScriptRoot\FullHelp -Filter "*" | Remove-Item
[System.Text.StringBuilder]$tocContent = New-Object System.Text.StringBuilder
[System.Text.StringBuilder]$commandsContent = New-Object System.Text.StringBuilder
$null = $tocContent.AppendLine("# Commands (v$($module.Version))")
$null = $tocContent.AppendLine("## <a name=""toc"" />Table of Contents")
foreach ($sectionName in ($sectionToFunctionsMap.Keys | Sort-Object)) {
    $functionNames = $sectionToFunctionsMap[$sectionName] | Sort-Object
    $sectionId = $sectionName.Replace(" ", "").ToLowerInvariant()
    $null = $tocContent.AppendLine("* [$sectionName](#$sectionId)")
    $null = $commandsContent.AppendLine("## <a name=""$sectionId"" />$sectionName")
    foreach ($functionName in $functionNames) {
        $functionId = $functionName.Replace(" ", "").ToLowerInvariant()
        $null = $tocContent.AppendLine("  * [$functionName](#$functionId)")
        $null = $commandsContent.AppendLine("### <a name=""$functionId"" />$functionName")
        $null = $commandsContent.AppendLine("[table of contents](#toc) | [full](FullHelp/$functionName.md)")
        $null = $commandsContent.AppendLine('```')
        $null = $commandsContent.AppendLine($functionToHelpMap[$functionName])
        $null = $commandsContent.AppendLine('```')

        # Write the full help file.
        Set-Content -LiteralPath $PSScriptRoot\FullHelp\$functionName.md -Value @(
            "# $functionName"
            "[table of contents](../Commands.md#toc) | [brief](../Commands.md#$functionId)"
            '```'
            $functionToFullHelpMap[$functionName]
            '```'
        )
    }
}

Set-Content -LiteralPath $PSScriptRoot\Commands.md -Value @(
    $tocContent.ToString()
    $commandsContent.ToString()
)

# Remove the module.
if ($removeModule) {
    Remove-Module -ModuleInfo $module
}