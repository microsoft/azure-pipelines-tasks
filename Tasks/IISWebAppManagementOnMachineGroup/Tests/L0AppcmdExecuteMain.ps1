[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

$createVirtualDirectory = ""
$createApplication = "false"

$actionIISWebsite = "CreateOrUpdateWebsite"
$actionIISApplicationPool = ""

$virtualPath = ""        

$websiteName = "Sample Web Site"
$physicalPath = "Drive:/Physical path"
$physicalPathAuth = "WebsiteUserPassThrough"        
$physicalPathAuthCredentials = $null
       
$addBinding = "false"
$protocol = "http"
$ipAddress = "All Unassigned"
$port = "8080"
$hostNameWithOutSNI = ""
$hostNameWithHttp = ""
$hostNameWithSNI = ""
$serverNameIndication = "false"
$sslCertThumbPrint = ""

$appPoolName = ""
$dotNetVersion = ""
$pipeLineMode = ""
$appPoolIdentity = ""        
$appPoolCredentials = $null
       
$appCmdCommands = ""

# Test 1 

Register-Mock Test-Path { return $true } 
Register-Mock Add-And-Update-Website { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Add-And-Update-Website -Times 1
Assert-WasCalled Add-And-Update-Website -- -siteName "Sample Web Site" -appPoolName "" -physicalPath "Drive:/Physical path" -authType "WebsiteUserPassThrough" -websitePhysicalPathAuthCredentials $null -addBinding "false" -protocol "http" -ipAddress "All Unassigned" -port "8080" -hostname ""

# Test 2 

$actionIISApplicationPool = "CreateOrUpdateAppPool"

Unregister-Mock Add-And-Update-Website 

Register-Mock Add-And-Update-Website { }
Register-Mock Add-And-Update-AppPool { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Add-And-Update-AppPool -Times 1
Assert-WasCalled Add-And-Update-Website -Times 1

# Test 3 

$addBinding = "true"
$protocol = "https"

Unregister-Mock Add-And-Update-Website 
Unregister-Mock Add-And-Update-AppPool 

Register-Mock Add-And-Update-AppPool { }
Register-Mock Add-And-Update-Website { }
Register-Mock Add-SslCert { }
Register-Mock Enable-SNI { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Add-And-Update-AppPool -Times 1
Assert-WasCalled Add-And-Update-Website -Times 1
Assert-WasCalled Add-SslCert -Times 1
Assert-WasCalled Enable-SNI -Times 1

# Test 4 

$actionIISWebsite = "StartWebsite"
Register-Mock Start-Stop-Website { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Start-Stop-Website -- -siteName "Sample Web Site" -action "Start"

# Test 5 

$actionIISWebsite = "StopWebsite"
Unregister-Mock Start-Stop-Website
Register-Mock Start-Stop-Website { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Start-Stop-Website -- -siteName "Sample Web Site" -action "Stop"

# Test 6 

$appPoolName = "Sample App Pool"
$actionIISApplicationPool = "StartAppPool"

Register-Mock Start-Stop-Recycle-ApplicationPool { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Start-Stop-Recycle-ApplicationPool -- -appPoolName "Sample App Pool" -action "Start"

# Test 7

$appPoolName = "Sample App Pool"
$actionIISApplicationPool = "StopAppPool"

Unregister-Mock Start-Stop-Recycle-ApplicationPool
Register-Mock Start-Stop-Recycle-ApplicationPool { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Start-Stop-Recycle-ApplicationPool -- -appPoolName "Sample App Pool" -action "Stop"

# Test 8

$appPoolName = "Sample App Pool"
$actionIISApplicationPool = "RecycleAppPool"

Unregister-Mock Start-Stop-Recycle-ApplicationPool
Register-Mock Start-Stop-Recycle-ApplicationPool { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Start-Stop-Recycle-ApplicationPool -- -appPoolName "Sample App Pool" -action "Recycle"

# Test 9 

$CreateApplication = "true"

Register-Mock Add-And-Update-Application { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Add-And-Update-Application -Times 1 

# Test 10

$CreateVirtualDirectory = "true"

Register-Mock Add-And-Update-VirtualDirectory { }

Execute-Main -ActionIISWebsite $actionIISWebsite -WebsiteName $websiteName -virtualPath $virtualPath -actionIISApplicationPool $actionIISApplicationPool -createVirtualDirectory $createVirtualDirectory -createApplication $createApplication -PhysicalPath $physicalPath -PhysicalPathAuth $physicalPathAuth `
    -PhysicalPathAuthCredentials $physicalPathAuthCredentials -AddBinding $addBinding -Protocol $protocol -IpAddress $ipAddress `
    -Port $port -HostNameWithOutSNI $hostNameWithOutSNI -HostNameWithHttp $hostNameWithHttp -HostNameWithSNI $hostNameWithSNI `
    -ServerNameIndication $serverNameIndication -SslCertThumbPrint $sslCertThumbPrint `
    -AppPoolName $appPoolName -DotNetVersion $dotNetVersion -PipeLineMode $pipeLineMode `
    -AppPoolIdentity $appPoolIdentity -AppPoolCredentials $appPoolCredentials -AppCmdCommands $appCmdCommands

Assert-WasCalled Add-And-Update-VirtualDirectory -Times 1 

