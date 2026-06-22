[CmdletBinding()]
param()

# Test: VsoFilterTextWriter must escape ##vso[ commands written to Console.Out.
#
# The vulnerability: A compromised VM returns ##vso[ commands via Write-Host or
# direct Console.Out writes (from legacy DTT DLLs). The pipeline agent monitors
# stdout for ##vso[ lines and executes them as logging commands.
# The fix: VsoFilterTextWriter is installed globally on Console.Out before any
# modules load, intercepting all output and escaping ##vso[ → ##_vso[.

. $PSScriptRoot\..\..\..\Tests\lib\Initialize-Test.ps1

# Load the same VsoFilterTextWriter class that PowerShellOnTargetMachines.ps1 defines
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Text;

public class VsoFilterTextWriter : TextWriter
{
    private TextWriter _inner;
    private StringBuilder _buffer = new StringBuilder();

    public VsoFilterTextWriter(TextWriter inner) { _inner = inner; }
    public override Encoding Encoding { get { return _inner.Encoding; } }

    public override void Write(char value)
    {
        if (value == '\n')
        {
            FlushLine();
        }
        else
        {
            _buffer.Append(value);
        }
    }

    public override void Write(string value)
    {
        if (value == null) return;
        foreach (char c in value) Write(c);
    }

    public override void WriteLine(string value)
    {
        if (value != null) _buffer.Append(value);
        FlushLine();
    }

    public override void Flush()
    {
        if (_buffer.Length > 0) FlushLine();
        _inner.Flush();
    }

    private void FlushLine()
    {
        string line = _buffer.ToString();
        _buffer.Clear();
        if (line.TrimStart().StartsWith("##vso["))
        {
            _inner.WriteLine(line.Replace("##vso[", "##_vso["));
        }
        else
        {
            _inner.WriteLine(line);
        }
    }

    public void Restore()
    {
        Flush();
        Console.SetOut(_inner);
    }
}
"@ -Language CSharp

# Install VsoFilterTextWriter wrapping a StringWriter to capture filtered output
$stringWriter = New-Object System.IO.StringWriter
$filter = New-Object VsoFilterTextWriter($stringWriter)
[Console]::SetOut($filter)

try {
    # Simulate compromised VM output written to Console.Out (as DTT DLLs do)
    [Console]::WriteLine("##vso[task.setvariable variable=injectedSecret;issecret=true]stolen-value")
    [Console]::WriteLine("##vso[task.setvariable variable=Build.Repository.Clean]true")
    [Console]::WriteLine("Legitimate script output from VM")
    [Console]::WriteLine("  ##vso[task.logissue type=warning]indented injection attempt")
    $filter.Flush()
} finally {
    # Restore original Console.Out
    [Console]::SetOut($stringWriter.GetStringBuilder() | Out-Null; [Console]::OpenStandardOutput() | Out-Null)
    $filter.Restore()
}

$output = $stringWriter.ToString()

# Verify: NO raw ##vso[ commands in the output
$rawVsoLines = ($output -split "`n") | Where-Object { $_ -match '##vso\[' }
Assert-AreEqual 0 $rawVsoLines.Count "Raw ##vso[ commands must not pass through VsoFilterTextWriter. Found: $($rawVsoLines -join '; ')"

# Verify: escaped ##_vso[ commands ARE present (diagnostic visibility)
$escapedLines = ($output -split "`n") | Where-Object { $_ -match '##_vso\[' }
Assert-AreEqual 4 $escapedLines.Count "All 4 ##vso[ lines should be escaped to ##_vso[. Found $($escapedLines.Count)"

# Verify: legitimate output passes through unchanged
Assert-IsTrue ($output -match 'Legitimate script output from VM') "Legitimate output should pass through unchanged"

# Verify: indented ##vso[ is also caught (TrimStart behavior)
Assert-IsTrue ($output -match '##_vso\[task\.logissue') "Indented ##vso[ should also be escaped"

