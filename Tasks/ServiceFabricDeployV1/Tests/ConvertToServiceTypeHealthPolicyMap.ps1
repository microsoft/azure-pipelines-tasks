[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ServiceFabricSDK\Publish-UpgradedServiceFabricApplication.ps1

# Test 1: Valid single entry with double quotes
$input1 = '@{ "ServiceTypeName01" = "5,10,15" }'
$result1 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input1
Assert-AreEqual "5,10,15" $result1["ServiceTypeName01"] "Single entry parsing failed"

# Test 2: Valid multiple entries
$input2 = '@{ "ServiceTypeName01" = "5,10,5"; "ServiceTypeName02" = "5,5,5" }'
$result2 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input2
Assert-AreEqual "5,10,5" $result2["ServiceTypeName01"] "Multi-entry key1 failed"
Assert-AreEqual "5,5,5" $result2["ServiceTypeName02"] "Multi-entry key2 failed"

# Test 3: Empty hashtable
$input3 = '@{}'
$result3 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input3
Assert-AreEqual 0 $result3.Count "Empty hashtable should have 0 entries"

# Test 4: Empty hashtable with whitespace
$input4 = '@{  }'
$result4 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input4
Assert-AreEqual 0 $result4.Count "Empty hashtable with whitespace should have 0 entries"

# Test 5: Single quotes
$input5 = "@{ 'WebFrontEnd' = '5,10,5' }"
$result5 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input5
Assert-AreEqual "5,10,5" $result5["WebFrontEnd"] "Single-quoted entry parsing failed"

# Test 6: Bare word key
$input6 = '@{ MyServiceType = "0,5,10" }'
$result6 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input6
Assert-AreEqual "0,5,10" $result6["MyServiceType"] "Bare word key parsing failed"

# Test 7: Key with dots and hyphens
$input7 = '@{ "My.Service-Type_v2" = "10,20,30" }'
$result7 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input7
Assert-AreEqual "10,20,30" $result7["My.Service-Type_v2"] "Key with special chars failed"

# Test 8: Whitespace variations
$input8 = '@{  "Svc1"  =  "1,2,3"  ;  "Svc2"  =  "4,5,6"  }'
$result8 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input8
Assert-AreEqual "1,2,3" $result8["Svc1"] "Whitespace variation key1 failed"
Assert-AreEqual "4,5,6" $result8["Svc2"] "Whitespace variation key2 failed"

# Test 9: Values with spaces around commas
$input9 = '@{ "Svc" = "5, 10, 15" }'
$result9 = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString $input9
Assert-AreEqual "5, 10, 15" $result9["Svc"] "Spaces around commas should be preserved"

# Test 10: Command injection attempt should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{}; Write-Host "RCE: $(whoami)"; $token = $env:SYSTEM_ACCESSTOKEN'
} "*Invalid ServiceTypeHealthPolicyMap format*"

# Test 11: Subexpression injection in key should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "$(whoami)" = "5,10,5" }'
} "*Invalid service type name*"

# Test 12: Invalid value format should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "notanumber" }'
} "*Invalid health policy value*"

# Test 12a: Out-of-range percentage (>100) should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "5,101,15" }'
} "*Each percentage must be between 0 and 100*"

# Test 12b: Out-of-range percentage (999) should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "999,0,0" }'
} "*Each percentage must be between 0 and 100*"

# Test 12c: Boundary value 100 should succeed
$result_boundary = ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "0,100,50" }'
Assert-AreEqual "0,100,50" $result_boundary["Svc"] "Boundary value 100 should be accepted"

# Test 13: Missing @{ } wrapper should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '"Svc" = "5,10,5"'
} "*Invalid ServiceTypeHealthPolicyMap format*"

# Test 14: Pipeline injection in value should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "5,10,5 | whoami" }'
} "*Invalid health policy value*"

# Test 15: Semicolon injection in value via quotes should throw
Assert-Throws {
    ConvertTo-ServiceTypeHealthPolicyMap -PolicyMapString '@{ "Svc" = "5,10,5"; Remove-Item -Recurse C:\ }'
} "*Invalid entry*"
