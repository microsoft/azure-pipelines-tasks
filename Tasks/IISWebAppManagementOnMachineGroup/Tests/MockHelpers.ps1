## Helper for global mock functions 

Register-Mock Get-AppCmdLocation { 
    return "appcmdPath", 8
}

function Get-MockCredentials {
    $username = "domain\name"
    $password = 'random!123`"$password'

    $securePass = New-Object System.Security.SecureString
    ForEach ($ch in $password.ToCharArray()) { $securePass.appendChar($ch) }
    $authCredentials = New-Object System.Management.Automation.PSCredential($username, $securePass)
    return $authCredentials
}