param (        
    [string]$applicationPoolName,
    [string]$dotNetVersion,
    [string]$pipeLineMode,
    [string]$identity,
    [string]$username,
    [string]$password,
    [string]$additionalArguments
    )

Write-Verbose "Entering script IisAppPoolConfigOnTargetMachine.ps1" -Verbose
Write-Verbose "applicationPoolName = $applicationPoolName" -Verbose
Write-Verbose "dotNetVersion = $dotNetVersion" -Verbose
Write-Verbose "pipeLineMode = $pipeLineMode" -Verbose
Write-Verbose "identity = $identity" -Verbose
Write-Verbose "additionalArguments = $additionalArguments" -Verbose

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
     try
    {
        $appCmdPath, $iisVersion = Locate-AppCmd

        if($appCmdPath -eq $null){

         throw  "Unable to find the location of AppCmd.exe from registry on machine $env:COMPUTERNAME"
        
        }

        if($iisVersion -le 6.0){

         throw  "Version of IIS is less than 7.0 on machine $env:COMPUTERNAME"
        
        }

        return $appCmdPath;


    }
    catch [System.Exception]
    {
        throw  "Unable to find the location of appcmd.exe from registry on machine $env:COMPUTERNAME"
    }

}

$appCmdLocation = Get-AppCmdLocation

$appcmd = [System.IO.Path]::Combine($appCmdLocation, "appcmd.exe")

function executeCommand([string] $command){
  $result = cmd.exe /c $command

  if(-not ($LASTEXITCODE -eq 0)){
     throw $result
  }

  return $result
}

function DoesAppPoolExist()
{
   Write-Verbose "Checking if application pool with name $applicationPoolName exist" -Verbose 
   
   $command = "`"$appcmd`" list apppool /name:$applicationPoolName"
   Write-Verbose "Check app pool Command : $command "
   $pool = cmd.exe /c "`"$command`""

   if($pool -eq $null){
   Write-Verbose "Application pool with name $applicationPoolName does not exist" -Verbose 
   return $false;
   }
   else{
   Write-Verbose "Found application pool with name $applicationPoolName" -Verbose
   return $true;
   }
}

function setIdentity(){

   Write-Verbose "Setting identity of application pool: $applicationPoolName as $identity on machine $env:COMPUTERNAME" -Verbose
   $poolName =   $applicationPoolName.Trim("`"")
   if($identity -eq "SpecificUser"){
      $setCustomIdentityCommand = "`"$appcmd`" set config /section:applicationPools /[name='$poolName'].processModel.identityType:SpecificUser /[name='$poolName'].processModel.userName:$username /[name='$poolName'].processModel.password:$password"
      executeCommand("`"$setCustomIdentityCommand`"")
   }
   else{   
      $setIdentityCommand = "`"$appcmd`" set config /section:applicationPools /[name='$poolName'].processModel.identityType:$identity"
      executeCommand("`"$setIdentityCommand`"") 
   }
   Write-Verbose "Successfully set the identity of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose 
}

function SetManagedRuntimeVersion(){
   Write-Verbose "Setting managed runtime version of application pool: $applicationPoolName as $dotNetVersion on machine $env:COMPUTERNAME" -Verbose  
   $setManagedRuntimeVersionCommand = "`"$appcmd`" set apppool /apppool.name:$applicationPoolName /managedRuntimeVersion:$dotNetVersion"
   executeCommand("`"$setManagedRuntimeVersionCommand`"")
   Write-Verbose "Successfully set managed runtime version of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose  
}

function SetManagedPipeLineMode(){
   Write-Verbose "Setting managed pipeline mode  of application pool: $applicationPoolName as $pipeLineMode on machine $env:COMPUTERNAME" -Verbose 
   $setManagedPipeLineModeCommand = "`"$appcmd`" set apppool /apppool.name:$applicationPoolName /managedPipelineMode:$pipeLineMode"
   executeCommand("`"$setManagedPipeLineModeCommand`"")
   Write-Verbose "Successfully set managed pipeline mode of application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose  
}

function SetAdditionalCommands(){
   if(-not ($additionalArguments -eq $null -or $additionalArguments -eq "")){
   $additionalCommand =   $additionalArguments.TrimEnd("`"")
   $additionalCommand = $additionalCommand.TrimStart("`"")
   $additionalCommand = $additionalCommand.Replace("'","`"")   
   Write-Verbose "Setting  properties  passed as additional arguments on application pool  : $applicationPoolName, additionalProperties:$additionalArguments on machine $env:COMPUTERNAME" -Verbose 
   $setAdditionalPropertiesCommand = "`"$appcmd`" set apppool /apppool.name:$applicationPoolName $additionalCommand"
   executeCommand("`"$setAdditionalPropertiesCommand`"")
   Write-Verbose "Successfully set additional properties on application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose  
   }
}

function SetAppPoolProperties(){

   $additionalPropertiesResponse = SetAdditionalCommands
   $identitySetResponse = setIdentity
   $setruntimeVersionResponse = SetManagedRuntimeVersion
   $setManagedPipeLineModeResponse = SetManagedPipeLineMode

}

function CreateAppPool()
{
   #Create application pool
   Write-Verbose "Creating application pool with name : $applicationPoolName on machine $env:COMPUTERNAME" -Verbose
   $createAppPoolCommand = "`"$appcmd`" add apppool /name:`"$applicationPoolName`" "
   executeCommand("`"$createAppPoolCommand`"")

   Write-Verbose "Successfully created application pool:$applicationPoolName on machine $env:COMPUTERNAME" -Verbose

   # Set Properties of application pool
   SetAppPoolProperties
   
}

function UpdateAppPool(){

   Write-Verbose "Updating application pool with name : $applicationPoolName on machine $env:COMPUTERNAME" -Verbose 
   SetAppPoolProperties
   Write-Verbose "Successfully updated application pool: $applicationPoolName on machine $env:COMPUTERNAME" -Verbose

}


$poolExist = DoesAppPoolExist

if($poolExist){
UpdateAppPool
}
else{
CreateAppPool
}