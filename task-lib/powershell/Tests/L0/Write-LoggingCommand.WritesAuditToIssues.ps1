[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    # 1
    $actual = & $vstsModule Write-TaskError -Message "test error" -AsOutput
    $expected = "##vso[task.logissue type=error;source=TaskInternal]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "No audit action in issue if not specified."

    # 2
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -AuditAction '1' -AsOutput
    $expected = "##vso[task.logissue type=warning;source=TaskInternal;auditAction=1]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "String audit action."

    #3
    $actual = & $vstsModule Write-TaskError -Message "test error" -AuditAction 1 -AsOutput
    $expected = "##vso[task.logissue type=error;source=TaskInternal;auditAction=1]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Int audit action."
}
