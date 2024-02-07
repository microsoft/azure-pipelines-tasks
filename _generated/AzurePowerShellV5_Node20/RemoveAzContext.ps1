. "$PSScriptRoot/Utility.ps1"
Update-PSModulePathForHostedAgentLinux 

function CmdletHasMember {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$cmdlet,
        [Parameter(Mandatory=$true)]
        [string]$memberName)
    try{
        $hasMember = (gcm $cmdlet).Parameters.Keys.Contains($memberName)
        return $hasMember
    }
    catch
    {
        return $false;
    }
}

function Disconnect-UsingAzModule {
    [CmdletBinding()]
    param(
        [string]$restrictContext = 'False'
    )

    if ((Get-Command -Name "Disconnect-AzAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Disconnect-AzAccount -memberName Scope)) {
        if ($restrictContext -eq 'True') {
            Write-Host "##[command]Disconnect-AzAccount -Scope CurrentUser -ErrorAction Stop"
            $null = Disconnect-AzAccount -Scope CurrentUser -ErrorAction Stop
        }
        Write-Host "##[command]Disconnect-AzAccount -Scope Process -ErrorAction Stop"
        $null = Disconnect-AzAccount -Scope Process -ErrorAction Stop
    } 
    if (Get-Command -Name "Clear-AzContext" -ErrorAction "SilentlyContinue") {
        Write-Host "##[command]Clear-AzContext -Scope Process -ErrorAction Stop"
        $null = Clear-AzContext -Scope Process -ErrorAction Stop
    }
}

function Disconnect-UsingARMModule {
    [CmdletBinding()]
    param()

    if ((Get-Command -Name "Disconnect-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Disconnect-AzureRmAccount -memberName Scope)) {
        Write-Host "##[command]Disconnect-AzureRmAccount -Scope Process -ErrorAction Stop"
        $null = Disconnect-AzureRmAccount -Scope Process -ErrorAction Stop
    }
    elseif ((Get-Command -Name "Remove-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Remove-AzureRmAccount -memberName Scope)) {
        Write-Host "##[command]Remove-AzureRmAccount -Scope Process -ErrorAction Stop"
        $null = Remove-AzureRmAccount -Scope Process -ErrorAction Stop
    }
    elseif ((Get-Command -Name "Logout-AzureRmAccount" -ErrorAction "SilentlyContinue") -and (CmdletHasMember -cmdlet Logout-AzureRmAccount -memberName Scope)) {
        Write-Host "##[command]Logout-AzureRmAccount -Scope Process -ErrorAction Stop"
        $null = Logout-AzureRmAccount -Scope Process -ErrorAction Stop
    }

    if (Get-Command -Name "Clear-AzureRmContext" -ErrorAction "SilentlyContinue") {
        Write-Host "##[command]Clear-AzureRmContext -Scope Process -ErrorAction Stop"
        $null = Clear-AzureRmContext -Scope Process -ErrorAction Stop
    }
}


function Disconnect-AzureAndClearContext {
    [CmdletBinding()]
    param(
        [string]$authScheme = 'ServicePrincipal',
        [string]$restrictContext = 'False'
    )
    Write-Host "##[debug]Entering into Disconnect-AzAAzureAndClearContextccount"
    try {
        Write-Host "##[debug]The value of authScheme is '${authScheme}'"
        if ($authScheme -eq 'ServicePrincipal') {
            Write-Verbose "Trying to disconnect from Azure and clear context at process scope"

            if (Get-Module Az.Accounts -ListAvailable) {
                Disconnect-UsingAzModule -restrictContext $restrictContext
            }
            else {
                Disconnect-UsingARMModule
            }
        }
    } catch {
        $message = $_.Exception.Message
        Write-Verbose "Unable to disconnect and clear context: $message"
        Write-Host "##vso[task.logissue type=warning;]$message"
    }
}

Disconnect-AzureAndClearContext -restrictContext 'True'