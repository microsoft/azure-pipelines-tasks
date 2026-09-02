import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Utility } from '../src/Utility';

const testRoot = process.env['TEST_AZ_PROCESS_ROOT'];
const sourcePath = path.join(testRoot, 'fake-python.cs');
const pythonPath = path.join(testRoot, 'python.exe');
const cscPath = path.join(process.env['WINDIR'], 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');

const launcherSource = `
using System;
using System.Text;

public class Program
{
    public static int Main(string[] args)
    {
        Console.WriteLine("FAKE_AZ_INSTALLER:" + Environment.GetEnvironmentVariable("AZ_INSTALLER"));
        for (int index = 0; index < args.Length; index++)
        {
            Console.WriteLine("FAKE_ARG_" + index + ":" + Convert.ToBase64String(Encoding.UTF8.GetBytes(args[index])));
        }
        return Array.IndexOf(args, "fail") >= 0 ? 7 : 0;
    }
}
`;

function runPowerShell(executable: string, wrapperPath: string, marker: string): void {
    const output = child_process.execFileSync(
        executable,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath],
        { encoding: 'utf8', timeout: 15000 }
    );
    console.log(`${marker}_OUTPUT_START`);
    console.log(output);
    console.log(`${marker}_OUTPUT_END`);
}

async function main(): Promise<void> {
    fs.writeFileSync(sourcePath, launcherSource, { encoding: 'utf8' });
    child_process.execFileSync(
        cscPath,
        ['/nologo', '/target:exe', `/out:${pythonPath}`, sourcePath],
        { encoding: 'utf8', timeout: 15000 }
    );

    const result = await Utility.getPowerShellScriptPathWithAzModule('inlinescript', ['ps1'], '');
    console.log('GENERATED_WRAPPER:' + result.scriptPath);
    try {
        runPowerShell('pwsh.exe', result.scriptPath, 'PWSH');
        runPowerShell('powershell.exe', result.scriptPath, 'WINDOWS_POWERSHELL');
    } finally {
        fs.rmSync(testRoot, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
