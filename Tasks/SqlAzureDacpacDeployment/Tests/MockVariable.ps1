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

$certEndpoint=@{}
$usernameEndpoint=@{}
$spnEndpoint=@{}

$certAuth=@{}
$usernameAuth=@{}
$spnAuth=@{}

$certAuth.Scheme='Certificate'
$certEndpoint.Auth =$certAuth

$usernameAuth.Scheme='UserNamePassword'
$usernameEndpoint.Auth =$usernameAuth

$spnEndpoint.Scheme='ServicePrincipal'
$spnEndpoint.Auth =$spnEndpoint

$ipDetectionMethod = "IPAddressRange";