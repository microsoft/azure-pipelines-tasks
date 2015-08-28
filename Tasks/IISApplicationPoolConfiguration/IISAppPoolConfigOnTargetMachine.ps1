param (        
    [string]$applicationPoolName,
    [string]$dotNetVersion,
    [string]$pipeLineMode,
    [string]$identity,
    [string]$username,
    [string]$password,
    [string]$additionalArguments,    
    [string]$MethodToInvoke
    )

Write-Verbose "Entering script IisAppPoolConfigOnTargetMachine.ps1" -Verbose
Write-Verbose "applicationPoolName = $applicationPoolName" -Verbose
Write-Verbose "dotNetVersion = $dotNetVersion" -Verbose
Write-Verbose "pipeLineMode = $pipeLineMode" -Verbose
Write-Verbose "identity = $identity" -Verbose
Write-Verbose "username = $username" -Verbose
Write-Verbose "additionalArguments = $additionalArguments" -Verbose

function ThrowError
{
    param([string]$errorMessage)

        $readmelink = "http://aka.ms/apppoolconfigtaskhelp"
        $helpMessage = "For more info please refer to $readmelink"
        throw "$errorMessage $helpMessage `n"
}

function Locate-AppCmd()
{
   $iisRegKey = "HKLM:", "SOFTWARE", "Microsoft", "InetStp"-join [System.IO.Path]::DirectorySeparatorChar
   Write-Verbose "Trying to locate appcmd at location : $iisRegKey on machine $env:COMPUTERNAME" -Verbose

   if (-not (Test-Path $iisRegKey))
   {
      Write-Verbose "IIS not present on machine $env:COMPUTERNAME " -Verbose
      return $null, 0
   }

   Write-Verbose "Getting InstallPath property of IIS on machine $env:COMPUTERNAME " -Verbose
   $iisInstallPathProperties =  Get-ItemProperty $iisRegKey -Name "InstallPath";

   if ($iisInstallPathProperties -eq $null)
   {
       Write-Verbose "Failed to get InstallPath property of IIS on machine $env:COMPUTERNAME " -Verbose
       return $null, 0
   }

   Write-Verbose "Getting InstallPath of IIS on machine $env:COMPUTERNAME " -Verbose
   $iisPath = $iisInstallPathProperties.InstallPath

   if ($iisPath -eq $null)
   {
       Write-Verbose "Failed to get InstallPath of IIS on machine $env:COMPUTERNAME " -Verbose
       return $null, 0
   }

   Write-Verbose "Successfully got InstallPath of IIS on machine $env:COMPUTERNAME. Install path : $iisPath " -Verbose
   Write-Verbose "Getting installed version of IIS on machine $env:COMPUTERNAME " -Verbose

   $iisMajorVersionProperties =  Get-ItemProperty $iisRegKey -Name "MajorVersion";

   if ($iisMajorVersionProperties -eq $null)
   {
       return $iisPath, 0
   }

   $majorVersion = $iisMajorVersionProperties.MajorVersion

   if ($majorVersion -eq $null)
   {
       return $iisPath, 0
   }

   Write-Verbose "Successfully got installed version of IIS on machine $env:COMPUTERNAME IIS Version : $majorVersion " -Verbose

   return $iisPath, $majorVersion
}

function Get-AppCmdLocation
{
   $appCmdPath, $iisVersion = Locate-AppCmd

   if($appCmdPath -eq $null)
   {
     $error = "IIS not installed on machine $env:COMPUTERNAME."
     ThrowError -errorMessage $error
   }

   if($iisVersion -le 6.0)
   {
     $error = "Version of IIS is less than 7.0 on machine $env:COMPUTERNAME. Minimum version of IIS required is 7.0."
     ThrowError -errorMessage $error
   }

   return $appCmdPath;
}

function executeCommand([string] $command)
{
   $result = cmd.exe /c $command

   if(-not ($LASTEXITCODE -eq 0))
   {
       ThrowError($result)
   }

   return $result
}

function DoesAppPoolExist()
{
   Write-Verbose "Checking if application pool with name $applicationPoolName exist" -Verbose
   
   $command = "`"$appcmd`" list apppool /name:$applicationPoolName"
   Write-Verbose "Check app pool Command : $command "
   $pool = cmd.exe /c "`"$command`""

   if($pool -eq $null)
   {
     Write-Verbose "Application pool with name $applicationPoolName does not exist" -Verbose
     return $false;
   }
   else{
     Write-Verbose "Found application pool with name $applicationPoolName" -Verbose
     return $true;
   }
}

function SetIdentity()
{
   Write-Verbose "Setting identity of application pool: $applicationPoolName as $identity on machine $env:COMPUTERNAME" -Verbose
   if($identity -eq "SpecificUser")
   {
      $setCustomIdentityCommand = "`"$appcmd`" set config /section:applicationPools /[name='$applicationPoolName'].processModel.identityType:SpecificUser /[name='$applicationPoolName'].processModel.userName:$username /[name='$applicationPoolName'].processModel.password:$password"
      executeCommand("`"$setCustomIdentityCommand`"")
   }
   else{   
      $setIdentityCommand = "`"$appcmd`" set config /section:applicationPools /[name='$applicationPoolName'].processModel.identityType:$identity"
      Write-Verbose "Identiy Command: $setIdentityCommand"
      executeCommand("`"$setIdentityCommand`"")
   }
   Write-Verbose "Successfully set the identity of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
}

function SetManagedRuntimeVersionAndPipelineMode()
{
   Write-Verbose "Setting managed runtime version as $dotNetVersion  and managed pipeline mode as $pipeLineMode of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
   $setManagedRuntimeVersionAndPipelineModeCommand = "`"$appcmd`" set apppool /apppool.name:$applicationPoolName /managedRuntimeVersion:$dotNetVersion /managedPipelineMode:$pipeLineMode"
   executeCommand("`"$setManagedRuntimeVersionAndPipelineModeCommand`"")
   Write-Verbose "Successfully set managed runtime version and managed pipeline mode of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
}

function SetAdditionalCommands()
{
   $additionalCommand =   $additionalArguments.TrimEnd("`"")
   $additionalCommand = $additionalCommand.TrimStart("`"") 
   if(-not ($additionalCommand -eq $null -or $additionalCommand -eq ""))
   {
   $additionalCommand = $additionalCommand.Replace("'","`"")   
   Write-Verbose "Setting  properties  passed as additional arguments on application pool  : $applicationPoolName, additionalProperties:$additionalArguments on machine $env:COMPUTERNAME" -Verbose
   $setAdditionalPropertiesCommand = "`"$appcmd`" $additionalCommand"
   executeCommand("`"$setAdditionalPropertiesCommand`"")
   Write-Verbose "Successfully set additional properties on application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
   }
}

function SetAppPoolProperties()
{   
   SetIdentity
   SetManagedRuntimeVersionAndPipelineMode
   SetAdditionalCommands
}

function CreateAppPool()
{
   #Create application pool
   Write-Verbose "Creating application pool with name : $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
   $createAppPoolCommand = "`"$appcmd`" add apppool /name:$applicationPoolName"
   executeCommand("`"$createAppPoolCommand`"")

   Write-Verbose "Successfully created application pool:$applicationPoolName on machine $env:COMPUTERNAME" -Verbose

   # Set Properties of application pool
   SetAppPoolProperties
}

function UpdateAppPool()
{
   Write-Verbose "Updating application pool with name : $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
   SetAppPoolProperties
   Write-Verbose "Successfully updated application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
}

function Configure-IISApplicationPool
{

   $appCmdLocation = Get-AppCmdLocation

   $appcmd = [System.IO.Path]::Combine($appCmdLocation, "appcmd.exe")

   $poolExist = DoesAppPoolExist

   if( $poolExist )
   {
       UpdateAppPool
   }
   else
   {
       CreateAppPool
   }
}

Invoke-Expression $MethodToInvoke -Verbose

