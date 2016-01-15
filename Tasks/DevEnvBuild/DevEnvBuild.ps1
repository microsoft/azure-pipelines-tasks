param (
	[string]$project,
	[string]$buildPlatform,
	[string]$buildCfg,
    [string]$vsVersion
)
$ErrorActionPreference = "Stop"
# objective: locate instance(s) of visual studio on the computer and build via devenv.cmd

# get vs path
Write-Host "Finding Visual Studio install location"
if($vsVersion -eq "latest" -or $vsVersion -eq $null)
{
    $vsLocation = Get-VisualStudioPath
}
else 
{
    $vsLocation = Get-VisualStudioPath -Version $vsVersion
}

Write-Host ("vslocation: '{0}'" -f $vsLocation)
$devcmd = [System.IO.Path]::Combine($vsLocation, "Common7\IDE\devenv.com")
Write-Host ("devcmd: '{0}'" -f $devcmd)

# build execution string 

#$vsArgs = $project, "/Rebuild", $solutionConfig
$vsArgs = $project, "/Rebuild"
if($buildCfg) 
{ 
	$solutionConfig = $buildCfg
	if($buildPlatform) {  $solutionConfig = ('"{0}|{1}"' -f $buildCfg, $buildPlatform)  }

	if($solutionConfig)
	{
		$vsArgs += $solutionConfig
	}
}
Write-Host "args:"
$vsArgs
Write-Host "Invoking devenv.com..."
$ctxt = & $devcmd $vsArgs

# write results to host; check for errors, warnings
$lines = $ctxt.Split("`n")
$postErrs = ''
for([int] $i=0;$i -lt $lines.Count; $i++)
{
	$l = $lines[$i]
	
	# Log raw output, and try to catch error and warning messages and escalate them to the appropriate severity.
	if ( [System.Text.RegularExpressions.Regex]::IsMatch($l, ": error [A-Za-z]+\d+: ") )
	{
		throw $l
	}
	elseif ( [System.Text.RegularExpressions.Regex]::IsMatch($l, ": warning [A-Za-z]+\d+: ") )
	{
		Write-Warning $l
	}
	elseif([System.Text.RegularExpressions.Regex]::IsMatch($l, "Some errors occurred during migration\. For more information, see the migration report"))
	{
		$i++;
		$l += $lines[$i];
		$postErrs += $l
		Write-Host $l
		# throw $l
	}
	elseif([System.Text.RegularExpressions.Regex]::IsMatch($l, "The operation could not be completed\. The parameter is incorrect\.")) 
	{
		$postErrs += $l
		$postErrs += ("This is most often caused by an incorrect 'Configuration|Platform' specification.  Please make sure the specified platforms exist within your project or solution, or leave the parameters empty to use the solution defaults.  Provided: '{0}|{1}'" -f $buildCfg, $buildPlatform)
		Write-Host $l
	}
	else
	{
		Write-Host $l
	}
	
	if([System.Text.RegularExpressions.Regex]::IsMatch($l, "Some errors occurred during migration\. For more information, see the migration report"))
	{
		
		$i++;
		$l += $lines[$i];
		$postErrs += $l
		Write-Host $lines[$i];
		continue
		# throw $l
	}

	# Catch and parse the summary line, generating an error if any projects got marked
	# as failed, even if we failed to catch the error itself above.
	[System.Text.RegularExpressions.Match] $M = [System.Text.RegularExpressions.Regex]::Match($l, "^\s*=+\s*Rebuild All: \d+ succeeded, (\d+) failed, \d+ skipped\s*=+\s*$", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase);
	if ( $M.Success )
	{
		[int] $Failed = [int]::Parse($M.Groups[$M.Groups.Count - 1].Value);
		if ( $Failed -ne 0 )
		{
			throw "DevEnv failed to build " + $Failed.ToString() + " project(s).";
		}
	}
}
if($postErrs -and $postErrs.Length -gt 0)
{
	throw $postErrs
}