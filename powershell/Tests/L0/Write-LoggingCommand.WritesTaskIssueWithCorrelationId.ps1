[CmdletBinding()]
param()

$env:COMMAND_CORRELATION_ID = "test_id123"

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    # 1
    Assert-AreEqual $null $env:COMMAND_CORRELATION_ID "SDK removes the correlation ID after loading."

    # 2
    $actual = & $vstsModule Get-TaskVariable -Name "COMMAND_CORRELATION_ID"
    Assert-AreEqual $null $actual "The correlation ID is inaccessible using task variables."

    # 3
    $actual = & $vstsModule Write-TaskError -Message "test error" -AsOutput
    $expected = "##vso[task.logissue type=error;source=TaskInternal;correlationId=test_id123]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source and the correlation ID were added for errors."

    # 4
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -AsOutput
    $expected = "##vso[task.logissue type=warning;source=TaskInternal;correlationId=test_id123]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source and the correlation ID were added for warnings."

    # 5
    $actual = & $vstsModule Write-TaskError -Message "test error" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue type=error;source=CustomerScript;correlationId=test_id123]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source and the correlation ID for errors."

    # 6
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue type=warning;source=CustomerScript;correlationId=test_id123]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source and the correlation ID for warnings."
}