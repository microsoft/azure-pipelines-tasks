function Add-DbghelpLibrary {
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    
    $dbghelpPath = Get-DbghelpPath
    
    [bool]$isLoaded = $false
    foreach ($module in (Get-CurrentProcess).Modules) {
        if ($module.ModuleName -eq 'dbghelp.dll') {
            $isLoaded = $true
            if ($module.FileName -eq $dbghelpPath) {
                Write-Verbose "Module dbghelp.dll is already loaded from the expected file path: $dbghelpPath"
            } else {
                Write-Warning (Get-VstsLocString -Key UnexpectedDbghelpdllExpected0Actual1 -ArgumentList $dbghelpPath, $module.FileName)
            }

            # Don't short-circuit the loop. The module could be loaded more
            # than once and we should trace info about each loaded instance.
        }
    }

    if (!$isLoaded) {
        $hModule = Invoke-LoadLibrary -LiteralPath $dbghelpPath
        if ($hModule -eq [System.IntPtr]::Zero) {
            $errorCode = Get-LastWin32Error
            Write-Warning (Get-VstsLocString -Key "FailedToLoadDbghelpDllFrom0ErrorCode1" -ArgumentList $dbghelpPath, $errorCode)
            return
        }

        $hModule
    }

    Trace-VstsLeavingInvocation $MyInvocation
}

function Get-DbghelpSourceFilePaths {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SymbolsFilePath,
        [switch]$IgnoreIdxRetrievalError)

    $processHandle = [System.Diagnostics.Process]::GetCurrentProcess().Handle
    if ($processHandle -eq [System.IntPtr]::Zero) {
        throw (New-Win32ErrorMessage -Method 'Process.Handle')
    } elseif (![IndexHelpers.Dbghelp.NativeMethods]::SymInitialize($processHandle, $null, $false)) {
        throw (New-Win32ErrorMessage -Method 'SymInitialize')
    }

    try {
        $null = [IndexHelpers.Dbghelp.NativeMethods]::SymSetOptions([IndexHelpers.Dbghelp.SymOptions]::SYMOPT_NO_IMAGE_SEARCH)
        [uint64]$moduleBase = 0

        # Open the symbols file.
        [System.IO.FileStream]$fs = New-Object System.IO.FileStream(
            $SymbolsFilePath,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::Read,
            4096, # bufferSize,
            [System.IO.FileOptions]::None)
        try {
            try {
                [Microsoft.Win32.SafeHandles.SafeFileHandle]$fileHandle = $fs.SafeFileHandle
                if ($fileHandle.IsInvalid) {
                    throw (New-Win32ErrorMessage -Method 'SafeFileHandle.IsInvalid')
                }

                # SymSrvGetFileIndexes extracts symbol server index information from executable
                # images and pdbs. It will return false if the file is not one of them.
                [guid]$guid = [guid]::Empty
                [uint32]$val1 = 0
                [uint32]$val2 = 0
                if (![IndexHelpers.Dbghelp.NativeMethods]::SymSrvGetFileIndexes($SymbolsFilePath, [ref]$guid, [ref]$val1, [ref]$val2, 0)) {
                    if($IgnoreIdxRetrievalError.IsPresent) {
                        Write-Host "Ignoring (IgnoreIdxRetrievalError switch was set): Symbol indexes could not be retrieved for '$SymbolsFilePath'"
                        return
                    }
                    else {
                        throw (New-IndexedSourcesNotRetrievedMessage -SymbolsFilePath $SymbolsFilePath -Message 'Symbol indexes could not be retrieved.')
                    }
                }

                # Load the symbols file in DbgHelp.
                $moduleName = [System.IO.Path]::GetFileNameWithoutExtension($SymbolsFilePath)
                $moduleBase = [IndexHelpers.Dbghelp.NativeMethods]::SymLoadModuleEx(
                    $processHandle,
                    $fileHandle,
                    $SymbolsFilePath,
                    $moduleName,
                    1000000,
                    1,
                    [System.IntPtr]::Zero,
                    0)
            } finally {
                if ($fs -ne $null) {
                    $fs.Dispose()
                }
            }

            # Read the module info. Validate the file has symbol information and is a pdb type.
            $moduleInfo = New-Object IndexHelpers.Dbghelp.IMAGEHLP_MODULE64
            $moduleInfo.SizeOfStruct = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($moduleInfo)
            if (![IndexHelpers.Dbghelp.NativeMethods]::SymGetModuleInfo64($processHandle, $moduleBase, [ref]$moduleInfo)) {
                throw (New-IndexedSourcesNotRetrievedMessage -SymbolsFilePath $SymbolsFilePath -Message 'Symbol information could not be retrieved.')
            } elseif ($moduleInfo.SymType -ne [IndexHelpers.Dbghelp.SymType]::SymPdb) {
                throw (New-IndexedSourcesNotRetrievedMessage -SymbolsFilePath $SymbolsFilePath -Message 'Symbol is not of type pdb.')
            }

            # Enumerate the indexed source files if the pdb file has source information.
            if ($moduleInfo.LineNumbers) {
                $referencedSourceFiles = New-Object System.Collections.Generic.List[string]
                if (![IndexHelpers.Dbghelp.NativeMethods]::SymEnumSourceFilesWrapper($processHandle, $moduleBase, $referencedSourceFiles)) {
                    throw (New-Win32ErrorMessage -Method 'SymEnumSourceFiles')
                }

                return $referencedSourceFiles
            }
        } finally {
            if ($moduleBase -gt 0 -and ![IndexHelpers.Dbghelp.NativeMethods]::SymUnloadModule64($processHandle, $moduleBase)) {
                throw (New-Win32ErrorMessage -Method 'SymUnloadModule64')
            }
        }
    } finally {
        if (![IndexHelpers.Dbghelp.NativeMethods]::SymCleanup($processHandle)){
            throw (New-Win32ErrorMessage -Method 'SymCleanup')
        }
    }
}

function New-IndexedSourcesNotRetrievedMessage {
    [CmdletBinding()]
    param(
        [string]$SymbolsFilePath,
        [string]$Message)

    Get-VstsLocString -Key SourceInfoNotRetrievedFrom0Message1 -ArgumentList $SymbolsFilePath, $Message
}

function New-Win32ErrorMessage {
    [CmdletBinding()]
    param([string]$Method)

    Get-VstsLocString -Key Win32Error0FromMethod1 -ArgumentList (Get-LastWin32Error), $Method
}

function Remove-DbghelpLibrary {
    [CmdletBinding()]
    param($HModule)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if (!$HModule) {
            return
        }

        if (![IndexHelpers.Dbghelp.NativeMethods]::FreeLibrary($HModule)) {
            $errorCode = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            Write-Warning (Get-VstsLocString -Key FreeLibraryDbghelpDllError0 -ArgumentList $errorCode)
        }
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Wrapper functions.
########################################
function Get-CurrentProcess {
    [CmdletBinding()]
    param()

    [System.Diagnostics.Process]::GetCurrentProcess()
}

function Get-LastWin32Error {
    [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
}

function Invoke-LoadLibrary {
    [CmdletBinding()]
    param($LiteralPath)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        [IndexHelpers.Dbghelp.NativeMethods]::LoadLibrary($LiteralPath)
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

########################################
# Types.
########################################
# If the type has already been loaded once, then it is not loaded again.
Write-Verbose "Adding dbghelp native wrappers."
Add-Type -Debug:$false -TypeDefinition @'
namespace IndexHelpers.Dbghelp
{
    using System;
    using System.Runtime.InteropServices;
    using Microsoft.Win32.SafeHandles;

    public static class NativeMethods
    {
        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern bool FreeLibrary(IntPtr hModule);

        [DllImport("kernel32.dll", SetLastError = true)]
        public static extern IntPtr LoadLibrary(string dllToLoad);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool SymCleanup(IntPtr hProcess);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "SymEnumSourceFilesW")]
        public static extern bool SymEnumSourceFiles(
            IntPtr hProcess,
            ulong ModeBase,
            string Mask,
            SymEnumSourceFilesProc EnumSymbolsCallback,
            IntPtr UserContext);

        public static bool SymEnumSourceFilesWrapper(
            IntPtr hProcess,
            ulong ModeBase,
            System.Collections.Generic.List<string> referencedSourceFiles)
        {
            // Callback that processes the found source file from the pdb
            SymEnumSourceFilesProc enumSourceFilesCallBack = delegate(ref SOURCEFILE pSourceFile, IntPtr UserContext)
            {
                if (pSourceFile.FileName != IntPtr.Zero)
                {
                    referencedSourceFiles.Add(Marshal.PtrToStringUni(pSourceFile.FileName));
                }

                return true;
            };

            return SymEnumSourceFiles(hProcess, ModeBase, null, enumSourceFilesCallBack, IntPtr.Zero);
        }

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "SymGetModuleInfoW64")]
        public static extern bool SymGetModuleInfo64(
            IntPtr hProcess,
            ulong dwAddr,
            ref IMAGEHLP_MODULE64 ModuleInfo);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "SymInitializeW")]
        public static extern bool SymInitialize(IntPtr hProcess, string UserSearchPath, bool fInvadeProcess);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "SymLoadModuleExW")]
        public static extern ulong SymLoadModuleEx(
            IntPtr hProcess,
            SafeFileHandle hFile,
            string ImageName,
            string ModuleName,
            ulong BaseOfDll,
            uint DllSize,
            IntPtr Data,
            uint Flags);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern SymOptions SymSetOptions(SymOptions SymOptions);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "SymSrvGetFileIndexesW")]
        public static extern bool SymSrvGetFileIndexes(
            string file,
            ref Guid Id,
            ref uint Val1,
            ref uint Val2,
            uint Flags);

        [DllImport("dbghelp.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern bool SymUnloadModule64(
            IntPtr hProcess,
            ulong BaseOfDll);
    }

    public delegate bool SymEnumSourceFilesProc(
        ref SOURCEFILE pSourceFile,
        IntPtr UserContext);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct IMAGEHLP_MODULE64
    {
        public uint SizeOfStruct;
        public ulong BaseOfImage;
        public uint ImageSize;
        public uint TimeDateStamp;
        public uint CheckSum;
        public uint NumSyms;
        public SymType SymType;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)]
        public string ModuleName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string ImageName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string LoadedImageName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string LoadedPdbName;
        public uint CVSig;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 780)]
        public string CVData;
        public uint PdbSig;
        public Guid PdbSig70;
        public uint PdbAge;
        public bool PdbUnmatched;
        public bool DbgUnmatched;
        public bool LineNumbers;
        public bool GlobalSymbols;
        public bool TypeInfo;
        public bool SourceIndexed;
        public bool Publics;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct SOURCEFILE
    {
        public ulong ModeBase;
        public IntPtr FileName;
    }

    [Flags]
    public enum SymOptions : uint
    {
        SYMOPT_ALLOW_ABSOLUTE_SYMBOLS = 0x00000800,
        SYMOPT_ALLOW_ZERO_ADDRESS = 0x01000000,
        SYMOPT_AUTO_PUBLICS = 0x00010000,
        SYMOPT_CASE_INSENSITIVE = 0x00000001,
        SYMOPT_DEBUG = 0x80000000,
        SYMOPT_DEFERRED_LOADS = 0x00000004,
        SYMOPT_DISABLE_SYMSRV_AUTODETECT = 0x02000000,
        SYMOPT_EXACT_SYMBOLS = 0x00000400,
        SYMOPT_FAIL_CRITICAL_ERRORS = 0x00000200,
        SYMOPT_FAVOR_COMPRESSED = 0x00800000,
        SYMOPT_FLAT_DIRECTORY = 0x00400000,
        SYMOPT_IGNORE_CVREC = 0x00000080,
        SYMOPT_IGNORE_IMAGEDIR = 0x00200000,
        SYMOPT_IGNORE_NT_SYMPATH = 0x00001000,
        SYMOPT_INCLUDE_32BIT_MODULES = 0x00002000,
        SYMOPT_LOAD_ANYTHING = 0x00000040,
        SYMOPT_LOAD_LINES = 0x00000010,
        SYMOPT_NO_CPP = 0x00000008,
        SYMOPT_NO_IMAGE_SEARCH = 0x00020000,
        SYMOPT_NO_PROMPTS = 0x00080000,
        SYMOPT_NO_PUBLICS = 0x00008000,
        SYMOPT_NO_UNQUALIFIED_LOADS = 0x00000100,
        SYMOPT_OVERWRITE = 0x00100000,
        SYMOPT_PUBLICS_ONLY = 0x00004000,
        SYMOPT_SECURE = 0x00040000,
        SYMOPT_UNDNAME = 0x00000002,
    };

    [Flags]
    public enum SymType : uint
    {
        SymNone,
        SymCoff,
        SymCv,
        SymPdb,
        SymExport,
        SymDeferred,
        SymSym,
        SymDia,
        SymVirtual,
    }
}
'@
