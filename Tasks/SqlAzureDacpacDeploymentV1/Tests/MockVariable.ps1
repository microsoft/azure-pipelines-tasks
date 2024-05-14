$azureSqlServerName = "d2eu50p1fw"
$invalidAzureSqlServerName = "invalidServerName"
$databaseName = "testDb"
$serverUserName = "dummyUser"
$serverPassword = "dummyPassword"
$startIP="167.220.236.2"
$endIP="167.220.236.2"
$outOfRangeIPAddress = "167.220.236.256"

$invalidfirewallRuleName = "invalidFirewallRule"
$certificateFirewallRuleName= "certificateFirewallRuleName"
$credentialsFirewallRuleName = "credentialsFirewallRuleName"
$spnFirewallRuleName = "spnFirewallRuleName"

$certEndpoint = @{}
$certAuth = @{}
$certAuth.Scheme = 'Certificate'
$certEndpoint.Auth = $certAuth

$usernameEndpoint = @{}
$usernameAuth = @{}
$usernameAuth.Scheme = 'UserNamePassword'
$usernameEndpoint.Auth = $usernameAuth

$spnEndpoint = @{}
$spnAuth = @{}
$spnAuth.Scheme = 'ServicePrincipal'
$spnEndpoint.Auth = $spnAuth

$systemEndpoint = @{}
$systemAuth = @{}
$systemAuth.Scheme = 'System'
$systemAuthParams = @{}
$systemAuthParams.AccessToken = "AccessToken"
$systemAuth.parameters = $systemAuthParams
$systemEndpoint.Auth = $systemAuth

$ipDetectionMethod = "IPAddressRange";

#### Main File Mock Constants ####

$validInputConnectedServiceName = "validConnectedServiceName"

$dacpacFile = "C:\Test\TestFile.dacpac"
$bacpacFile = "C:\Test\TestFile.bacpac"
$sqlFile = "C:\Test\TestFile.sql"

$serverName = "a0nuel7r2k.database.windows.net"
$serverNameWithTcpPrefix = "tcp:a0nuel7r2k.database.windows.net,1433"
$serverFriendlyName = "a0nuel7r2k"
$databaseName = "TestDatabase"
$sqlUsername = "TestUser"
$sqlUsernameWithServerName = "TestUser@a0nuel7r2k.database.windows.net"
$sqlUsernameWithAtSymbol = "TestUser@123"
$sqlPassword = "TestPassword"
$sqlPasswordSpecialCharacter = '~`!@#$%^&*()_+{}[]:;<>,.?/Aa"'''
$sqlPasswordEscapedSpecialCharacter = '~``!@#`$%^&*()_+{}[]:;<>,.?/Aa`"'''
$publishProfile = "C:\Test\publish.xml"
$ipDetectionMethodAuto = "AutoDetect"
$ipDetectionMethodRange = "IPAddressRange"
$deleteFirewallRuleTrue = $true
$deleteFirewallRuleFalse = $false
$startIPAddress = "10.10.10.10"
$endIPAddress = "10.10.10.11"

$autoIp = "10.10.10.10"
$sqlPackageArguments = "Test Arguments"
