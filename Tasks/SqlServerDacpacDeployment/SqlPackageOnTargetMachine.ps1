param (        
    [string]$sqlPackageArguments    
    )

Write-Verbose "Entering script SqlPackageOnTargetMachine.ps1" -Verbose
Write-Verbose "sqlPackageArguments = $sqlPackageArguments" -Verbose

function Get-SqlPackageLocation
{
    # TODO : Replace this with actual code, getting values from registry entries

    $path = Join-Path ${env:ProgramFiles(x86)} "\Microsoft SQL Server\120\DAC\bin\SqlPackage.exe"

    if(Test-Path $path)
    {
        return $path;
    }

    $path = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio 14.0\Common7\IDE\Extensions\Microsoft\SQLDB\DAC\120\SqlPackage.exe"

    if(Test-Path $path)
    {
        return $path;
    }

    $path = Join-Path ${env:ProgramFiles(x86)} "\Microsoft SQL Server\110\DAC\bin\SqlPackage.exe"

    if(Test-Path $path)
    {
        return $path;
    }
    
    throw "Unable to find SQLPackage.exe"
}

$sqlPackage = Get-SqlPackageLocation

$sqlPackageArguments = $sqlPackageArguments.Trim('"', ' ')

$command = "`"$sqlPackage`" $sqlPackageArguments"

$command = $command.Replace("'", "`"")

Write-Verbose "Executing : $command" -Verbose

cmd.exe /c "`"$command`""