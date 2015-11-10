param (
    [string]$WebDeployPackage,
    [string]$WebDeployParamFile,
    [string]$OverRideParams,
    [string]$WebSiteName,
    [string]$WebSitePhysicalPath,
    [string]$WebSitePhysicalPathAuth,
    [string]$WebSiteAuthUserName,
    [string]$WebSiteAuthUserPassword,
    [string]$AddBinding,
    [string]$AssignDuplicateBinding,
    [string]$Protocol,
    [string]$IpAddress,
    [string]$Port,
    [string]$HostName,
    [string]$ServerNameIndication,
    [string]$SslCertThumbPrint,
    [string]$AppPoolName,
    [string]$DotNetVersion,
    [string]$PipeLineMode,
    [string]$AppPoolIdentity,
    [string]$AppPoolUsername,
    [string]$AppPoolPassword,
    [string]$AppCmdCommands,
    [string]$MethodToInvoke = "Execute-Main"
    )

Write-Verbose "Entering script MsDeployOnTargetMachines.ps1" -Verbose
Write-Verbose "WebDeployPackage = $WebDeployPackage" -Verbose
Write-Verbose "WebDeployParamFile = $WebDeployParamFile" -Verbose
Write-Verbose "OverRideParams = $OverRideParams" -Verbose

Write-Verbose "WebSiteName = $WebSiteName" -Verbose

Write-Verbose "WebSitePhysicalPath = $WebSitePhysicalPath" -Verbose
Write-Verbose "WebSitePhysicalPathAuth = $WebSitePhysicalPathAuth" -Verbose
Write-Verbose "WebSiteAuthUserName = $WebSiteAuthUserName" -Verbose
Write-Verbose "WebSiteAuthUserPassword = $WebSiteAuthUserPassword" -Verbose
Write-Verbose "AddBinding = $AddBinding" -Verbose
Write-Verbose "AssignDuplicateBinding = $AssignDuplicateBinding" -Verbose
Write-Verbose "Protocol = $Protocol" -Verbose
Write-Verbose "IpAddress = $IpAddress" -Verbose
Write-Verbose "Port = $Port" -Verbose
Write-Verbose "HostName = $HostName" -Verbose
Write-Verbose "ServerNameIndication = $ServerNameIndication" -Verbose

Write-Verbose "AppPoolName = $AppPoolName" -Verbose
Write-Verbose "DotNetVersion = $DotNetVersion" -Verbose
Write-Verbose "PipeLineMode = $PipeLineMode" -Verbose
Write-Verbose "AppPoolIdentity = $AppPoolIdentity" -Verbose
Write-Verbose "AppPoolUsername = $AppPoolUsername" -Verbose

Write-Verbose "AppCmdCommands = $AppCmdCommands" -Verbose
Write-Verbose "MethodToInvoke = $MethodToInvoke" -Verbose

$AppCmdRegKey = "HKLM:\SOFTWARE\Microsoft\InetStp"
$MsDeployInstallPathRegKey = "HKLM:\SOFTWARE\Microsoft\IIS Extensions\MSDeploy"

function Run-Command
{
    param(
        [string]$command,
        [bool] $failOnErr = $true
    )

    $ErrorActionPreference = 'Continue'

    if( $psversiontable.PSVersion.Major -le 4)
    {        
        $result = cmd.exe /c "`"$command`""    
    }
    else
    {
        $result = cmd.exe /c "$command"
    }
    
    $ErrorActionPreference = 'Stop'

    if($failOnErr -and $LASTEXITCODE -ne 0)
    {
        throw $result
    }
    
    return $result
}

function IsInputNullOrEmpty
{
    param(
        [string]$str
    )

    return ([string]::IsNullOrEmpty($str) -or $str -eq "`"`"")
}

function Get-MsDeployLocation
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )

    $msDeployNotFoundError = "Cannot find MsDeploy.exe location. Verify MsDeploy.exe is installed on $env:ComputeName and try operation again."
    
    if( -not (Test-Path -Path $regKeyPath))
    {
        throw $msDeployNotFoundError 
    }
        
    $path = (Get-ChildItem -Path $regKeyPath | Select -Last 1).GetValue("InstallPath")

    if( -not (Test-Path -Path $path))
    {
        throw $msDeployNotFoundError 
    }

    return (Join-Path $path msDeploy.exe)
}

function Get-AppCmdLocation
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )
    
    $appCmdNotFoundError = "Cannot find appcmd.exe location. Verify IIS is configured on $env:ComputerName and try operation again."
    $appCmdMinVersionError = "Version of IIS is less than 7.0 on machine $env:ComputerName. Minimum version of IIS required is 7.0"
    
    
    if(-not (Test-Path -Path $regKeyPath))
    {
        throw $appCmdNotFoundError
    }

    $regKey = Get-ItemProperty -Path $regKeyPath
    $path = $regKey.InstallPath
    $version = $regKey.MajorVersion
        
    if($version -le 6.0)
    {
        throw $appCmdMinVersionError
    }
        
    if( -not (Test-Path $path))
    {
        throw $appCmdNotFoundError
    }
    

    return (Join-Path $path appcmd.exe), $version
}

function Get-MsDeployCmdArgs
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams
    )
    
    $webDeployPackage = $webDeployPackage.Trim('"')
    $webDeployParamFile = $webDeployParamFile.Trim('"')
    $overRideParams = $overRideParams.Trim('"').Replace('''', '"')
    
    if(-not ( Test-Path -Path $webDeployPackage))
    {
        throw "Package does not exist : $webDeployPackage"
    }

    $msDeployCmdArgs = [string]::Empty
    if(-not (IsInputNullOrEmpty -str $webDeployParamFile))
    {   
    
        if(-not ( Test-Path -Path $webDeployParamFile))
        {
            throw "Param file does not exist : $webDeployParamFile"
        } 

        $msDeployCmdArgs = [string]::Format(' -setParamFile="{0}"', $webDeployParamFile)
    }

    if(-not (IsInputNullOrEmpty -str $overRideParams))
    {
        $msDeployCmdArgs = [string]::Format('{0} -setParam:{1}', $msDeployCmdArgs, $overRideParams)
    }
    
    $msDeployCmdArgs = [string]::Format(' -verb:sync -source:package="{0}" {1} -dest:auto -verbose -retryAttempts:3 -retryInterval:3000', $webDeployPackage, $msDeployCmdArgs)
    return $msDeployCmdArgs
}

function Does-WebSiteExists
{
    param([string] $siteName)

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list site /name:{0}',$siteName)
    $command = "`"$appCmdPath`" $appCmdArgs"
    Write-Verbose "Checking webSite exists. Running Command : $command"
    
    $webSite = Run-Command -command $command -failOnErr $false
    
    if($webSite -ne $null)
    {
        Write-Verbose "WebSite already exists" -Verbose
        return $true
    }
    
    Write-Verbose "WebSite does not exist" -Verbose
    return $false
}

function Does-BindingExists
{
    param(
        [string]$siteName,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname,
        [string]$assignDupBindings
    )
    
    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list sites')
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Checking binding exists for website $siteName. Running Command : $command" -Verbose
    
    $sites = Run-Command -command $command -failOnErr $false    
    $binding = [string]::Format("{0}/{1}:{2}:{3}", $protocol, $ipAddress, $port, $hostname)
    
    $isBindingExists = $false

    foreach($site in $sites)
    {
        switch($assignDupBindings)
        {
            $true
            {
                if($site.Contains($siteName) -and $site.Contains($binding))
                {                    
                    $isBindingExists = $true
                }
            }
            default
            {
                if($site.Contains($siteName) -and $site.Contains($binding))
                {                    
                    $isBindingExists = $true
                }
                elseif($site.Contains($binding))
                {
                    throw "Binding already exists for website $site"
                }
            }
        }
    }
        
    Write-Verbose "Does Bindings exist for website $siteName is : $isBindingExists" -Verbose
    return $isBindingExists
}

function Does-AppPoolExists
{  
    param(
        [string]$appPoolName
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list apppool /name:{0}',$appPoolName)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Checking application exists. Running Command : $command" -Verbose
    
    $appPool = Run-Command -command $command -failOnErr $false
    
    if($appPool -ne $null)
    {
        Write-Verbose "Application Pool ($appPoolName) already exists" -Verbose
        return $true
    }
    
    Write-Verbose "Application Pool ($appPoolName) does not exists" -Verbose
    return $false

}

function Enable-SNI
{
    param(
        [string]$siteName,
        [string]$sni,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey

    if( -not ($sni -eq "true" -and $iisVersion -ge 8 -and -not (IsInputNullOrEmpty -str $hostname)))
    {
        Write-Verbose "Not Enabling SNI : sni : $sni, iisVersion : $iisVersion, hostname : $hostname. Possible Reasons: `n 1. IIS Version is less than 8 `n 2. HostName input is not provided `n 3. SNI input is set to false" -Verbose
        return
    }
    
    if($ipAddress -eq "`"All Unassigned`"")
    {
        $ipAddress = "*"
    }

    $appCmdArgs = [string]::Format(' set site /site.name:{0} /bindings.[protocol=''https'',bindingInformation=''{1}:{2}:{3}''].sslFlags:"1"',$siteName, $ipAddress, $port, $hostname)

    $command = "`"$appCmdPath`" $appCmdArgs"
    
    Write-Verbose "Enabling SNI by setting SslFlags=1 for binding. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Add-SslCert
{
    param(
        [string]$port,
        [string]$certhash,
        [string]$hostname,
        [string]$sni,
        [string]$iisVersion
    )

    if(IsInputNullOrEmpty -str $certhash)
    {
        Write-Verbose "CertHash is empty .. returning" -Verbose
        return
    }

    $result = $null
    $isItSameBinding = $false
    $addCertCmd = [string]::Empty

    #SNI is supported IIS 8 and above. To enable SNI hostnameport option should be used
    if($sni -eq "true" -and $iisVersion -ge 8 -and (-not (IsInputNullOrEmpty -str $hostname)))
    {
        $showCertCmd = [string]::Format("netsh http show sslcert hostnameport={0}:{1}", $hostname, $port)
        Write-Verbose "Checking SslCert binding already Present. Running Command : $showCertCmd" -Verbose
        
        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("{0}:{1}", $hostname, $port))

        $addCertCmd = [string]::Format("netsh http add sslcert hostnameport={0}:{1} certhash={2} appid={{{3}}} certstorename=MY", $hostname, $port, $certhash, [System.Guid]::NewGuid().toString())
    }
    else
    {
        $showCertCmd = [string]::Format("netsh http show sslcert ipport=0.0.0.0:{0}", $port)
        Write-Verbose "Checking SslCert binding already Present. Running Command : $showCertCmd" -Verbose
        
        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("0.0.0.0:{0}", $port))
        
        $addCertCmd = [string]::Format("netsh http add sslcert ipport=0.0.0.0:{0} certhash={1} appid={{{2}}}", $port, $certhash, [System.Guid]::NewGuid().toString())
    }

    $isItSameCert = $result.Get(5).Contains([string]::Format("{0}", $certhash))

    if($isItSameBinding -and $isItSameCert)
    {
        Write-Verbose "SSL cert binding already present.. returning" -Verbose
        return
    }

    Write-Verbose "Setting SslCert for WebSite." -Verbose
    Run-Command -command $addCertCmd
}

function Deploy-WebSite
{    
    param(
        [string]$webDeployPkg,
        [string]$webDeployParamFile,
        [string]$overRiderParams
    )

    $msDeployExePath = Get-MsDeployLocation -regKeyPath $MsDeployInstallPathRegKey
    $msDeployCmdArgs = Get-MsDeployCmdArgs -webDeployPackage $webDeployPkg -webDeployParamFile $webDeployParamFile -overRideParams $overRiderParams

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"
    Write-Verbose "Deploying WebSite. Running Command: $msDeployCmd" -Verbose
    Run-Command -command $msDeployCmd
}

function Create-WebSite
{
    param(
    [string]$siteName,
    [string]$physicalPath
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' add site /name:{0} /physicalPath:{1}',$siteName, $physicalPath)
    $command = "`"$appCmdPath`" $appCmdArgs"       
    
    Write-Verbose "Creating WebSite. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Create-AppPool
{
    param(
        [string]$appPoolName
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' add apppool /name:{0}', $appPoolName)
    $command = "`"$appCmdPath`" $appCmdArgs"
    
    Write-Verbose "Creating Application Pool. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Run-AdditionalCommands
{
    param(
        [string]$additionalCommands
    )

    $appCmdCommands = $additionalCommands.Trim('"').Split([System.Environment]::NewLine, [System.StringSplitOptions]::RemoveEmptyEntries)
    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey

    foreach($appCmdCommand in $appCmdCommands)
    {
        if(-not [string]::IsNullOrEmpty($appCmdCommand.Trim(' ')))
        {
            $command = "`"$appCmdPath`" $appCmdCommand"

            Write-Verbose "Running additional command. $command" -Verbose
            Run-Command -command $command
        }
    }
}

function Update-WebSite
{
    param(
        [string]$siteName,
        [string]$appPoolName,
        [string]$physicalPath,
        [string]$authType,
        [string]$userName,
        [string]$password,
        [string]$addBinding,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname,
        [string]$assignDupBindings
    )

    $appCmdArgs = [string]::Format(' set site /site.name:{0}', $siteName)

    if(-not (IsInputNullOrEmpty -str $appPoolName))
    {    
        $appCmdArgs = [string]::Format('{0} -applicationDefaults.applicationPool:{1}', $appCmdArgs, $appPoolName)
    }

    if(-not (IsInputNullOrEmpty -str $physicalPath))
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].physicalPath:{1}", $appCmdArgs, $physicalPath)
    }

    if(-not (IsInputNullOrEmpty -str $userName) -and $authType -eq "WebSiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].userName:{1}", $appCmdArgs, $userName)
    }

    if(-not (IsInputNullOrEmpty -str $password) -and $authType -eq "WebSiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].password:{1}", $appCmdArgs, $password)
    }

    if($ipAddress -eq "`"All Unassigned`"")
    {
        $ipAddress = "*"
    }

    $isBindingExists = Does-BindingExists -siteName $siteName -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname -assignDupBindings $assignDupBindings

    if($addBinding -eq "true" -and $isBindingExists -eq $false)
    {
        $appCmdArgs = [string]::Format("{0} /+bindings.[protocol='{1}',bindingInformation='{2}:{3}:{4}']", $appCmdArgs, $protocol, $ipAddress, $port, $hostname)
    }
        
    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $command = "`"$appCmdPath`" $appCmdArgs"
    
    Write-Verbose "Updating WebSite Properties. Running Command : $command" -Verbose
    Run-Command -command $command 
}

function Update-AppPool
{
    param(
        [string]$appPoolName,
        [string]$clrVersion,
        [string]$pipeLineMode,
        [string]$identity,
        [string]$userName,
        [string]$password
    )

    $appCmdArgs = ' set config  -section:system.applicationHost/applicationPools'

    if(-not (IsInputNullOrEmpty -str $clrVersion))
    {    
        $appCmdArgs = [string]::Format('{0} /[name=''{1}''].managedRuntimeVersion:{2}', $appCmdArgs, $appPoolName, $clrVersion)
    }

    if(-not (IsInputNullOrEmpty -str $pipeLineMode))
    {
        $appCmdArgs = [string]::Format('{0} /[name=''{1}''].managedPipelineMode:{2}', $appCmdArgs, $appPoolName, $pipeLineMode)
    }

    if($identity -eq "SpecificUser" -and -not (IsInputNullOrEmpty -str $userName) -and -not (IsInputNullOrEmpty -str $password))
    {
        $appCmdArgs = [string]::Format('{0} /[name=''{1}''].processModel.identityType:SpecificUser /[name=''{1}''].processModel.userName:{2} /[name=''{1}''].processModel.password:{3}',`
                                $appCmdArgs, $appPoolName, $userName, $password)
    }
    else
    {
        $appCmdArgs = [string]::Format('{0} /[name=''{1}''].processModel.identityType:{2}', $appCmdArgs, $appPoolName, $identity)
    }    
        
    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $command = "`"$appCmdPath`" $appCmdArgs"
    
    Write-Verbose "Updating Application Pool Properties. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Create-And-Update-WebSite
{
    param(
        [string]$siteName,
        [string]$appPoolName,
        [string]$physicalPath,
        [string]$authType,
        [string]$userName,
        [string]$password,
        [string]$addBinding,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname,
        [string]$assignDupBindings
    )

    $doesWebSiteExists = Does-WebSiteExists -siteName $siteName
    
    if( -not $doesWebSiteExists)
    {
        Create-WebSite -siteName $siteName -physicalPath $physicalPath
    }

    Update-WebSite -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType -userName $userName -password $password `
    -addBinding $addBinding -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname -assignDupBindings $assignDupBindings
}

function Create-And-Update-AppPool
{
    param(
        [string]$appPoolName,
        [string]$clrVerion,
        [string]$pipeLineMode,
        [string]$identity,
        [string]$userName,
        [string]$password
    )

    $doesAppPoolExists = Does-AppPoolExists -appPoolName $appPoolName

    if(-not $doesAppPoolExists)
    {
        Create-AppPool -appPoolName $appPoolName
    }

    Update-AppPool -appPoolName $appPoolName -clrVersion $clrVersion -pipeLineMode $pipeLineMode -identity $identity -userName $userName -password $password
}

function Execute-Main
{
    Write-Verbose "Entering Execute-Main function" -Verbose

    if(-not (IsInputNullOrEmpty -str $AppPoolName))
    {
        Create-And-Update-AppPool -appPoolName $AppPoolName -clrVersion $DotNetVersion -pipeLineMode $PipeLineMode -identity $AppPoolIdentity -userName $AppPoolUsername -password $AppPoolPassword
    }

    if(-not (IsInputNullOrEmpty -str $WebSiteName))
    {
        Create-And-Update-WebSite -siteName $WebSiteName -appPoolName $AppPoolName -physicalPath $WebSitePhysicalPath -authType $WebSitePhysicalPathAuth -userName $WebSiteAuthUserName `
         -password $WebSiteAuthUserPassword -addBinding $AddBinding -protocol $Protocol -ipAddress $IpAddress -port $Port -hostname $HostName -assignDupBindings $AssignDuplicateBinding

        if($Protocol -eq "https")
        {
            $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
            Add-SslCert -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion
            Enable-SNI -siteName $WebSiteName -sni $ServerNameIndication -ipAddress $IpAddress -port $Port -hostname $HostName
        }
    }

    Run-AdditionalCommands -additionalCommands $AppCmdCommands

    Deploy-WebSite -webDeployPkg $WebDeployPackage -webDeployParamFile $WebDeployParamFile -overRiderParams $OverRideParams

    Write-Verbose "Exiting Execute-Main function" -Verbose
}

Invoke-Expression $MethodToInvoke
