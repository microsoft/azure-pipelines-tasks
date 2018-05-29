# How to collect test execution process dump in case of abnormal failures/crashes

### Overview

Following are set of steps help you in collecting the test execution process dump in case of test hangs, vstest task exits abnormally.

- For test hangs, we suggest using `Blame data collector` which is shipped as default in Visual Studio 2017 (Release 15.6 onwards)
- For process crashes/unexpected test task exists, we suggest using `ProcDump` for collection of process dumps

#### Using Blame data collector
- [Blame data collector](https://github.com/Microsoft/vstest-docs/blob/master/docs/extensions/blame-datacollector.md) can be enabled by passing `--blame --diag:c:\logs\` option in VsTest task additional console options
- This will generate `sequence.xml` in case of test hangs/crashes. The file contains the list of test cases which are executed in sequential order.
- In case of test hang, mostly the last test case in the sequence file will be causing this.
- Along with this, additional test execution logs will be generated in `c:\logs` folder which will help in diagnosis

#### Collecting dumps

- [ProcDump](https://docs.microsoft.com/en-us/sysinternals/downloads/procdump) will help us in collecting dumps during the process termination/exit.
- We need to configure our CI/CD pipeline to download `ProcDump` from internet or shared folder location
- Add `PowerShell` task before VsTest task to make sure we are starting `ProcDump` before starting the test execution
- Following `PowerShell` script will help in launching the ProcDump process in the required mode

```Powershell
$p = Get-Process -Name procdump*
if($p){
    Write-Host "Proc dump is already running. Killing the process - $($p.Id)"
    Stop-Process $($p.Id) -Force -ErrorAction SilentlyContinue
}

If(!(Test-Path "C:\logs\"))
{
	New-Item -ItemType Directory -Force -Path "C:\logs\"
}

Write-Host "Copying files"
cp \\SharedPath\procdump*.exe "C:\logs\" -Force

## Works for Visual Studio 2017
powershell.exe -Command "Start-Process C:\logs\procdump64.exe -ArgumentList 'testhost c:\logs\test.dmp -w -t -ma' -WindowStyle Hidden"
## Works for Visual Studio 2015
powershell.exe -Command "Start-Process C:\logs\procdump64.exe -ArgumentList 'vstest.executionengine c:\logs\test.dmp -w -t -ma' -WindowStyle Hidden"
```

- Process dump files will be generated in `c:\logs\` folder and make sure script is modified according to your requirements. Please refer `ProcDump` documentation for details

- Note: The above script works only if tests are not running with parallelism (`--parallel`). Make sure to remove lines from script based on Visual Studio version`




