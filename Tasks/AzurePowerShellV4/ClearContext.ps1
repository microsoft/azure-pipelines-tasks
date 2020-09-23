if (Get-Command -Name "Disconnect-AzAccount" -ErrorAction "SilentlyContinue" -and CmdletHasMember -cmdlet Disconnect-AzAccount -memberName Scope) {	
        Write-Host "##[command]Disconnect-AzAccount -Scope Process -ErrorAction Stop"	
        $null = Disconnect-AzAccount -Scope Process -ErrorAction Stop
    }
    elseif (Get-Command -Name "Remove-AzAccount" -ErrorAction "SilentlyContinue" -and CmdletHasMember -cmdlet Remove-AzAccount -memberName Scope) {	
        Write-Host "##[command]Remove-AzAccount -Scope Process -ErrorAction Stop"	
        $null = Remove-AzAccount -Scope Process -ErrorAction Stop
    }
    elseif (Get-Command -Name "Logout-AzAccount" -ErrorAction "SilentlyContinue" -and CmdletHasMember -cmdlet Logout-AzAccount -memberName Scope) {	
        Write-Host "##[command]Logout-AzAccount -Scope Process -ErrorAction Stop"	
        $null = Logout-AzAccount -Scope Process -ErrorAction Stop
    }

    if (Get-Command -Name "Remove-AzContext" -ErrorAction "SilentlyContinue") {
        $a = Get-AzContext -ListAvailable
        Write-Host "Available context are $a"
        Write-Host "Removing 2222222222222222222222222222222222222222222222222"
        Write-Host "##[command]Remove-AzContext -Scope Process -Force"
        $null = $a | Remove-AzContext -Scope Process -Force
        Write-Host "##[command]Remove-AzContext -Scope CurrentUser -Force"
        $null = $a | Remove-AzContext -Scope CurrentUser -Force
    }

    if (Get-Command -Name "Clear-AzContext" -ErrorAction "SilentlyContinue") {
        $a = Get-AzContext -ListAvailable
        Write-Host "Available context are $a"
        Write-Host "Clearing 222222222222222222222222222222222222222222222222222222"
        Write-Host "##[command]Clear-AzContext -Scope Process -ErrorAction Stop"
        $null = Clear-AzContext -Scope Process -ErrorAction Stop
        Write-Host "##[command]Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue"
        $null = Clear-AzContext -Scope CurrentUser -Force -ErrorAction SilentlyContinue
    }