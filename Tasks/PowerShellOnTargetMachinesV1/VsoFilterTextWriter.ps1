# Defines VsoFilterTextWriter — a TextWriter that escapes ##vso[ commands in all console output.
# This prevents remote VMs from injecting pipeline logging commands via stdout.
# Dot-source this file, then call Install-VsoFilter to activate.

if (-not ([System.Management.Automation.PSTypeName]'VsoFilterTextWriter').Type) {
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
        _inner.WriteLine(_buffer.ToString().Replace("##vso[", "##_vso["));
        _buffer.Clear();
    }

    public void Restore()
    {
        Flush();
        Console.SetOut(_inner);
    }
}
"@ -Language CSharp
}

function Install-VsoFilter {
    $script:vsoFilter = New-Object VsoFilterTextWriter([Console]::Out)
    [Console]::SetOut($script:vsoFilter)
}
