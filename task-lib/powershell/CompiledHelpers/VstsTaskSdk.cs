using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Security;
using System.Runtime.InteropServices;
using System.Security.Cryptography.X509Certificates;
using System.Text.RegularExpressions;

namespace VstsTaskSdk
{
    public class TerminationException : Exception
    {
        public TerminationException(String message) : base(message) { }
    }

    public sealed class VstsWebProxy : IWebProxy
    {
        private string _proxyAddress;
        private readonly List<Regex> _regExBypassList = new List<Regex>();

        public ICredentials Credentials { get; set; }

        public VstsWebProxy(string proxyAddress, string proxyUsername, string proxyPassword, List<string> proxyBypassList)
        {
            _proxyAddress = proxyAddress?.Trim();

            if (string.IsNullOrEmpty(proxyUsername) || string.IsNullOrEmpty(proxyPassword))
            {
                Credentials = CredentialCache.DefaultNetworkCredentials;
            }
            else
            {
                Credentials = new NetworkCredential(proxyUsername, proxyPassword);
            }

            if (proxyBypassList != null)
            {
                foreach (string bypass in proxyBypassList)
                {
                    if (string.IsNullOrWhiteSpace(bypass))
                    {
                        continue;
                    }
                    else
                    {
                        try
                        {
                            Regex bypassRegex = new Regex(bypass.Trim(), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.ECMAScript);
                            _regExBypassList.Add(bypassRegex);
                        }
                        catch (Exception)
                        {
                            // eat all exceptions
                        }
                    }
                }
            }
        }

        public Uri GetProxy(Uri destination)
        {
            if (IsBypassed(destination))
            {
                return destination;
            }
            else
            {
                return new Uri(_proxyAddress);
            }
        }

        public bool IsBypassed(Uri uri)
        {
            return string.IsNullOrEmpty(_proxyAddress) || uri.IsLoopback || IsMatchInBypassList(uri);
        }

        private bool IsMatchInBypassList(Uri input)
        {
            string matchUriString = input.IsDefaultPort ?
                input.Scheme + "://" + input.Host :
                input.Scheme + "://" + input.Host + ":" + input.Port.ToString();

            foreach (Regex r in _regExBypassList)
            {
                if (r.IsMatch(matchUriString))
                {
                    return true;
                }
            }

            return false;
        }
    }

    public sealed class VstsHttpHandlerSettings
    {
        public static RemoteCertificateValidationCallback UnsafeSkipServerCertificateValidation
        {
            get
            {
                return ((object sender, X509Certificate certificate, X509Chain chain, SslPolicyErrors sslPolicyErrors) => { return true; });
            }
        }
    }
}

namespace VstsTaskSdk.FS
{
    public static class NativeMethods
    {
        private const string Kernel32Dll = "kernel32.dll";
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool FindClose(IntPtr hFindFile);
        // HANDLE WINAPI FindFirstFile(
        //   _In_  LPCTSTR           lpFileName,
        //   _Out_ LPWIN32_FIND_DATA lpFindFileData
        // );
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true, SetLastError = true)]
        public static extern SafeFindHandle FindFirstFile(
            [MarshalAs(UnmanagedType.LPTStr)]
            string fileName,
            [In, Out] FindData findFileData
        );
        //HANDLE WINAPI FindFirstFileEx(
        //  _In_       LPCTSTR            lpFileName,
        //  _In_       FINDEX_INFO_LEVELS fInfoLevelId,
        //  _Out_      LPVOID             lpFindFileData,
        //  _In_       FINDEX_SEARCH_OPS  fSearchOp,
        //  _Reserved_ LPVOID             lpSearchFilter,
        //  _In_       DWORD              dwAdditionalFlags
        //);
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true, SetLastError = true)]
        public static extern SafeFindHandle FindFirstFileEx(
            [MarshalAs(UnmanagedType.LPTStr)]
            string fileName,
            [In] FindInfoLevel fInfoLevelId,
            [In, Out] FindData lpFindFileData,
            [In] FindSearchOps fSearchOp,
            IntPtr lpSearchFilter,
            [In] FindFlags dwAdditionalFlags
        );
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool FindNextFile(SafeFindHandle hFindFile, [In, Out] FindData lpFindFileData);
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true, SetLastError = true)]
        public static extern int GetFileAttributes(string lpFileName);
        [DllImport(Kernel32Dll, CharSet = CharSet.Unicode, BestFitMapping = false, ThrowOnUnmappableChar = true, SetLastError = true)]
        public static extern uint GetFullPathName(
            [MarshalAs(UnmanagedType.LPTStr)]
            string lpFileName,
            uint nBufferLength,
            [Out]
            System.Text.StringBuilder lpBuffer,
            System.Text.StringBuilder lpFilePart
        );
    }
    //for mapping to the WIN32_FIND_DATA native structure
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public sealed class FindData
    {
        // NOTE:
        // Although it may seem correct to Marshal the string members of this class as UnmanagedType.LPWStr, they
        // must explicitly remain UnmanagedType.ByValTStr with the size constraints noted.  Otherwise we end up with
        // COM Interop exceptions while trying to marshal the data across the PInvoke boundaries.
        public int fileAttributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME creationTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME lastAccessTime;
        public System.Runtime.InteropServices.ComTypes.FILETIME lastWriteTime;
        public int nFileSizeHigh;
        public int nFileSizeLow;
        public int dwReserved0;
        public int dwReserved1;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string fileName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 14)]
        public string alternateFileName;
    }
    //A Win32 safe find handle in which a return value of -1 indicates it's invalid
    public sealed class SafeFindHandle : Microsoft.Win32.SafeHandles.SafeHandleMinusOneIsInvalid
    {
        public SafeFindHandle()
            : base(true)
        {
            return;
        }
        [System.Runtime.ConstrainedExecution.ReliabilityContract(System.Runtime.ConstrainedExecution.Consistency.WillNotCorruptState, System.Runtime.ConstrainedExecution.Cer.Success)]
        protected override bool ReleaseHandle()
        {
            return NativeMethods.FindClose(handle);
        }
    }
    // Refer https://msdn.microsoft.com/en-us/library/windows/desktop/gg258117(v=vs.85).aspx
    [Flags]
    public enum Attributes : uint
    {
        None = 0x00000000,
        Readonly = 0x00000001,
        Hidden = 0x00000002,
        System = 0x00000004,
        Directory = 0x00000010,
        Archive = 0x00000020,
        Device = 0x00000040,
        Normal = 0x00000080,
        Temporary = 0x00000100,
        SparseFile = 0x00000200,
        ReparsePoint = 0x00000400,
        Compressed = 0x00000800,
        Offline = 0x00001000,
        NotContentIndexed = 0x00002000,
        Encrypted = 0x00004000,
        IntegrityStream = 0x00008000,
        Virtual = 0x00010000,
        NoScrubData = 0x00020000,
        Write_Through = 0x80000000,
        Overlapped = 0x40000000,
        NoBuffering = 0x20000000,
        RandomAccess = 0x10000000,
        SequentialScan = 0x08000000,
        DeleteOnClose = 0x04000000,
        BackupSemantics = 0x02000000,
        PosixSemantics = 0x01000000,
        OpenReparsePoint = 0x00200000,
        OpenNoRecall = 0x00100000,
        FirstPipeInstance = 0x00080000,
        RecallOnDataAccess = 0x00400000,
        RecallOnOpen = 0x00040000
    }
    [Flags]
    public enum FindFlags
    {
        None = 0,
        CaseSensitive = 1,
        LargeFetch = 2,
    }
    public enum FindInfoLevel
    {
        Standard = 0,
        Basic = 1,
    }
    public enum FindSearchOps
    {
        NameMatch = 0,
        LimitToDirectories = 1,
        LimitToDevices = 2,
    }
}
