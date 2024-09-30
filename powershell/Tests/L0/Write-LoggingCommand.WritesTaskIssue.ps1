[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    # 1
    $actual = & $vstsModule Write-TaskError -Message "test error" -AsOutput
    $expected = "##vso[task.logissue type=error;source=TaskInternal]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source was added for errors."

    # 2
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -AsOutput
    $expected = "##vso[task.logissue type=warning;source=TaskInternal]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source was added for warnings."

    #3
    $actual = & $vstsModule Write-TaskError -Message "test error" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue type=error;source=CustomerScript]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source for errors."

    #4
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue type=warning;source=CustomerScript]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source for warnings."
}