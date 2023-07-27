[CmdletBinding()]
param()

# Setup
. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\SymbolClientFunctions.ps1
Microsoft.PowerShell.Core\Import-Module $PSScriptRoot\..\ps_modules\PowershellHelpers

# Test 1 - Get-MsiAccessToken returns correct access token if token fetching api returns 200
$global:attempt = 1;
Register-Mock Invoke-WebRequest {
    if($global:attempt -le 3)
    {
        $global:attempt++
        throw "Error"
    }
	return @{
		StatusCode = 200
		Headers = @{"symbol-client-version"= "1.0.0"}
	}
} 

$result = Get-SymbolClientVersion "https://example.com"

Assert-WasCalled Invoke-WebRequest -Times 4
Assert-AreEqual $result "1.0.0"

# Test 2 - Get-MsiAccessToken throws error if token fetching api throws error
Unregister-Mock Invoke-WebRequest
Register-Mock Invoke-WebRequest {
    throw "error"
}

Assert-Throws { Get-SymbolClientVersion "https://example.com" }