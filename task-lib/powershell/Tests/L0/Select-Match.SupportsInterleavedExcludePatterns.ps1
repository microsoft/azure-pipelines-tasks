[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $itemPaths = @(
        '\solution1\proj1\proj1.proj'
        '\solution1\proj1\README.txt'
        '\solution1\proj2\proj2.proj'
        '\solution1\proj2\README.txt'
        '\solution1\solution1.sln'
        '\solution2\proj1\proj1.proj'
        '\solution2\proj1\README.txt'
        '\solution2\proj2\proj2.proj'
        '\solution2\proj2\README.txt'
        '\solution2\solution2.sln'
    )
    $patterns = @(
        '**\@(*.proj|README.txt)'   # include all proj and README files
        '!**\solution2\**'          # exclude the solution 2 folder entirely
        '**\*.sln'                  # include all sln files
        '!**\proj2\README.txt'      # exclude proj2 README files
    )

    # Act.
    $actual = Select-VstsMatch -ItemPath $itemPaths -Pattern $patterns

    # Assert.
    $expected = @(
        '\solution1\proj1\proj1.proj'
        '\solution1\proj1\README.txt'
        '\solution1\proj2\proj2.proj'
        '\solution1\solution1.sln'
        '\solution2\solution2.sln'
    )
    Assert-AreEqual $expected $actual
}