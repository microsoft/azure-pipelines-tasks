[CmdletBinding()]
param()

# Actually, Invoke-VstsProcess does not support encoding by itself, it just allows to get the output of the process in a file, and then you can use Get-Content to read the file with the encoding you want.

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
            @{ Encoding = 'unicode' ; Expected = "Hello world" }
        )
        foreach ($variableSet in $variableSets) {
            $stdOutPath = [System.IO.Path]::Combine($tempDirectory, [System.IO.Path]::GetRandomFileName())

            # Act.
            Invoke-VstsProcess `
                -FileName $tempDirectory\TestEncoding.exe `
                -StdOutPath $stdOutPath `

            if ($variableSet.Encoding) {
                $actual = Get-Content -LiteralPath $stdOutPath -Encoding $variableSet.Encoding
            }
            else {
                $actual = Get-Content -LiteralPath $stdOutPath -Raw
            }

            # Assert.
            $actual = $actual.Replace("`0", "_") # Replace null characters with spaces in order for the string comparison to be accurate.
            Assert-AreEqual $variableSet.Expected $actual
            Assert-AreEqual $originalEncoding ([System.Console]::OutputEncoding)
        }
    }
    finally {
        Remove-Item $tempDirectory -Recurse
    }
}