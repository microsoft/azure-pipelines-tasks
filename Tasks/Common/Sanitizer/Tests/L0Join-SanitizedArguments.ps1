[CmdletBinding()]
param()

. $PSScriptRoot\..\..\..\..\Tests\lib\Initialize-Test.ps1
. $PSScriptRoot\..\ArgumentsSanitizer.ps1

# Arrange

$inputTokenArrays = @(
    @(),
    @("--flag"),
    @("--flag1", "--flag2"),
    @("--path=sub folder\a.txt", "--cap-mbps", "500"),
    @("--empty=", "--next=1")
)

$expectedJoined = @(
    "",
    "--flag",
    "--flag1 --flag2",
    '"--path=sub folder\a.txt" --cap-mbps 500',
    "--empty= --next=1"
)

for ($i = 0; $i -lt $inputTokenArrays.Length; $i++) {
    # Act
    $joined = Join-SanitizedArguments -arguments $inputTokenArrays[$i]

    # Assert
    Assert-AreEqual -Expected $expectedJoined[$i] -Actual $joined
}

# Round-trip: any token array produced by the sanitizer (already quote-stripped)
# must survive Join-SanitizedArguments followed by Split-AdditionalArguments
# without losing token boundaries, even when a token contains an embedded space.
$roundTripInput = @("--include-pattern", "sub folder\a.txt", "--recursive")
$roundTripJoined = Join-SanitizedArguments -arguments $roundTripInput
[string[]]$roundTripSplit = @(Split-AdditionalArguments -additionalArguments $roundTripJoined)
Assert-AreEqual -Expected $roundTripInput -Actual $roundTripSplit
