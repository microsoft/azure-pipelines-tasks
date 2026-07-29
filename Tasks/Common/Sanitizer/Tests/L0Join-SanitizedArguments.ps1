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

# Regression test: a token containing BOTH an embedded double quote and a
# space (e.g. a"b c) previously broke the round trip. Join-SanitizedArguments
# quoted the token without escaping the embedded quote, so
# Split-AdditionalArguments then mis-read the embedded quote as the closing
# quote, splitting the single token into two (a"b c -> ab, c). This is
# exactly the scenario hit when useSanitizerActivate and
# useSourcePathHardening are both enabled on the AzureFileCopy VM-copy and
# Upload paths.
$embeddedQuoteRoundTripInput = @("--include-pattern", 'a"b c', "--recursive")
$embeddedQuoteRoundTripJoined = Join-SanitizedArguments -arguments $embeddedQuoteRoundTripInput
[string[]]$embeddedQuoteRoundTripSplit = @(Split-AdditionalArguments -additionalArguments $embeddedQuoteRoundTripJoined)
Assert-AreEqual -Expected $embeddedQuoteRoundTripInput -Actual $embeddedQuoteRoundTripSplit
