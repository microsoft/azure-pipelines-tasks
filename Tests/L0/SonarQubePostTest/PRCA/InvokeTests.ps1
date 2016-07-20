[CmdletBinding()]
param()


$source = @"

using System.Collections;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;
using System.Linq;
using System;

namespace Test
{
    // Used to test the reflection invokation helper
    public class Bar
    {
        
        public string Foo(Guid g, int i, string s, int? i2 = null, string s2 = null, CancellationToken c = default(CancellationToken))
        {
            return "Foo1 " + g.ToString() + i.ToString() + s;
        }

        public string Foo(string anotherString, int i, string s, int i2 = 0, string s2 = null, CancellationToken c = default(CancellationToken))
        {
            return "Foo2 " + anotherString + i.ToString() + s + i2;
        }

        public string Foo(string anotherString, Guid g, string s)
        {
            return "Foo3 " + anotherString + g.ToString() + s;
        }

        public string Foo(Guid g1, Guid g2, string s, int? i2 = null, string s2 = null, CancellationToken c = default(CancellationToken))
        {
            return "Foo4 " + g1.ToString() + g2.ToString() + s;
        }
    }
}

"@

Add-Type -TypeDefinition $source -Language CSharp


# import the module before initializing the test library to avoid "import-module" being mocked
. $PSScriptRoot\..\..\..\lib\Initialize-Test.ps1
. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\PRCA\PostComments-Server.ps1
. $PSScriptRoot\..\..\..\..\Tasks\SonarQubePostTest\Common\SonarQubeHelpers\SonarQubeHelper.ps1

# Test 1 - call without params
$bar = New-Object -TypeName "Test.Bar"
Assert-Throws {InvokeByReflection $bar "Foo"} "No suitable overload found for Foo" 

# Test 2 - call with invalid params
$bar = New-Object -TypeName "Test.Bar" 
Assert-Throws {InvokeByReflection $bar "Foo" @([Guid], [Int], [Int]) @([Guid]::NewGuid(), 1, 2)} "No suitable overload found for Foo" 

# Test 3 - call with valid params
$bar = New-Object -TypeName "Test.Bar" 
$result = InvokeByReflection $bar "Foo" @([Guid], [Int], [String]) @([Guid]::Empty, 1, "Hello")
Assert-AreEqual "Foo1 00000000-0000-0000-0000-0000000000001Hello" $result "Wrong method invoked"

# Test 4 - call with valid params + optional param with non-default value
$bar = New-Object -TypeName "Test.Bar" 
$result = InvokeByReflection $bar "Foo" @([String], [Int], [String], [Int]) @("Hello", 1, "World", 4)
Assert-AreEqual "Foo2 Hello1World4" $result "Wrong method invoked" 

# Test 5 - call with valid params
$bar = New-Object -TypeName "Test.Bar" 
$result = InvokeByReflection $bar "Foo" @([String], [Guid], [String]) @("Hello", [Guid]::Empty, "World")
Assert-AreEqual "Foo3 Hello00000000-0000-0000-0000-000000000000World" $result "Wrong method invoked" 

# Test 6 - call with valid params types but invalid values
$bar = New-Object -TypeName "Test.Bar" 
Assert-Throws { InvokeByReflection $bar "Foo" @([String], [Guid], [String]) @("Hello", 1, "World")}


