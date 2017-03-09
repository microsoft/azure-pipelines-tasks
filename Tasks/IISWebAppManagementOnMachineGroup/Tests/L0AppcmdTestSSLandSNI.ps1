[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\MockHelpers.ps1

. $PSScriptRoot\..\ps_modules\TaskModuleIISManageUtility\AppCmdOnTargetMachines.ps1

# Test 1 : SNI is not enabled if SNI input is not set 

$WebsiteName = "Sample Web Site"
$ServerNameIndication = "false"
$IpAddress = "All Unassigned"
$Port = "8080"
$HostName = "somehost"

Register-Mock Invoke-VstsTool { }

Enable-SNI -siteName $WebsiteName -sni $ServerNameIndication -ipAddress $IpAddress -port $Port -hostname $HostName

Assert-WasCalled Invoke-VstsTool -Times 0

# Test 2 : SNI input is set 

$ServerNameIndication = "true"

Unregister-Mock Invoke-VstsTool 
Register-Mock Invoke-VstsTool { }

Enable-SNI -siteName $WebsiteName -sni $ServerNameIndication -ipAddress $IpAddress -port $Port -hostname $HostName

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "appcmdPath" -Arguments " set site /site.name:`"Sample Web Site`" /bindings.[protocol='https',bindingInformation='*:8080:somehost'].sslFlags:`"1`"" -RequireExitCodeZero

# Test 3 : Add-SslCert with certifcate not already present 

$Port = "8080"
$IpAddress = "All Unassigned"
$SslCertThumbPrint = "asdfghjklqwertyuiopzxcvbnmqazwsxedcrfvtg"
$HostName = "somehost"
$ServerNameIndication = "false"
$iisVersion = 8

Unregister-Mock Invoke-VstsTool 

Register-Mock Invoke-VstsTool { 
    return @(
        "`n",
        "SSL Certificate bindings:",
        "-------------------------",
        "`n",
        "The system cannot find the file specified.",
        "`n"      
    )
} -ParametersEvaluator { $Arguments -eq "http show sslcert ipport=0.0.0.0:8080"}

Add-SslCert -ipAddress $IpAddress -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion

Assert-WasCalled Invoke-VstsTool -Times 2
Assert-WasCalled Invoke-VstsTool -- -Filename "netsh" -Arguments "http show sslcert ipport=0.0.0.0:8080"
Assert-WasCalled Invoke-VstsTool -ParametersEvaluator {
    $Arguments -like "http add sslcert ipport=0.0.0.0:8080 certhash=asdfghjklqwertyuiopzxcvbnmqazwsxedcrfvtg appid={*} certstorename=MY"
}

# Test 4 : Add-SslCert with certifcate already present 

Unregister-Mock Invoke-VstsTool 
Register-Mock Invoke-VstsTool { 
    return @(
        "`n",
        "SSL Certificate bindings:",
        "-------------------------",
        "`n",
        "    IP:port                      : 0.0.0.0:8080",
        "    Certificate Hash             : asdfghjklqwertyuiopzxcvbnmqazwsxedcrfvtg",
        "    Application ID               : {randomClientGuid}",
        "    Certificate Store Name       : My",
        "    Verify Client Certificate Revocation : Enabled",
        "    Verify Revocation Using Cached Client Certificate Only : Disabled"
        "    Usage Check                  : Enabled",
        "    Revocation Freshness Time    : 0",
        "    URL Retrieval Timeout        : 0",
        "    Ctl Identifier               : (null)",
        "    Ctl Store Name               : (null)",
        "    DS Mapper Usage              : Disabled",
        "    Negotiate Client Certificate : Disabled",
        "    Reject Connections           : Disabled"
        )
} -ParametersEvaluator { $Arguments -eq "http show sslcert ipport=0.0.0.0:8080"}

Add-SslCert -ipAddress $IpAddress -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion

Assert-WasCalled Invoke-VstsTool -Times 1
Assert-WasCalled Invoke-VstsTool -- -Filename "netsh" -Arguments "http show sslcert ipport=0.0.0.0:8080"

# Test 5 : Add-SslCert with SNI enabled and certificate not present 

$ServerNameIndication = "true"

Unregister-Mock Invoke-VstsTool 

Register-Mock Invoke-VstsTool { 
    return @(
        "`n",
        "SSL Certificate bindings:",
        "-------------------------",
        "`n",
        "The system cannot find the file specified.",
        "`n"      
    )
} -ParametersEvaluator { $Arguments -eq "http show sslcert hostnameport=somehost:8080"}

Add-SslCert -ipAddress $IpAddress -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion

Assert-WasCalled Invoke-VstsTool -Times 2
Assert-WasCalled Invoke-VstsTool -- -Filename "netsh" -Arguments "http show sslcert hostnameport=somehost:8080"
Assert-WasCalled Invoke-VstsTool -ParametersEvaluator {
    $Arguments -like "http add sslcert hostnameport=somehost:8080 certhash=asdfghjklqwertyuiopzxcvbnmqazwsxedcrfvtg appid={*} certstorename=MY"
}


