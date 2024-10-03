[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
    try {
        set-Content -LiteralPath $tempDirectory\Program.cs -Value @"
namespace TestEncoding {
    public static class Program {
        public static void Main() {
            System.Text.Encoding encoding = System.Text.Encoding.Unicode;
            byte[] bytes = encoding.GetBytes("Hello world");
            using (System.IO.Stream stdout = System.Console.OpenStandardOutput()) {
                stdout.Write(bytes, 0, bytes.Length);
                stdout.Flush();
            }
        }
    }
}
"@
        Add-Type -LiteralPath $tempDirectory\Program.cs -OutputType ConsoleApplication -OutputAssembly $tempDirectory\TestEncoding.exe
        $originalEncoding = [System.Console]::OutputEncoding
        $variableSets = @(
            @{ Encoding = $null ; Expected = "H_e_l_l_o_ _w_o_r_l_d_" }
            @{ Encoding = [System.Text.Encoding]::Unicode ; Expected = "Hello world" }
        )
        foreach ($variableSet in $variableSets) {
            # Act.
            $actual = Invoke-VstsTool -FileName $tempDirectory\TestEncoding.exe -Encoding $variableSet.Encoding

            # Assert.
            $actual = $actual.Replace("`0", "_") # Replace null characters with spaces in order for the string comparison to be accurate.
            Assert-AreEqual $variableSet.Expected $actual
            Assert-AreEqual $originalEncoding ([System.Console]::OutputEncoding)
        }
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}