function CheckForAutoLogonPrerequisites()
{
    # checking prerequisites for autologon
    if(IsAutoLogonDisabled)
    {
        Write-Verbose -Message "Admin auto logon is disabled" -Verbose
    }

    #check for both 64 bit & 32 bit, as policy can be used from both
    $policy64registryPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\Windows\CurrentVersion\policies\system"
    $policy32registryPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\policies\system"

    #check only for 32 bit reg key as winlogon process is 32 bit
    $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"

    if( LegalNoticeKeysAreNotEmpty($policy64registryPath) -or LegalNoticeKeysAreNotEmpty($policy32registryPath) )
    {
        Write-Verbose -Message "Show logon message policy is enabled" -Verbose
    }
    elseif(LegalNoticeKeysAreNotEmpty($registryPath))
    {
        Write-Verbose -Message "Show logon message is enabled" -Verbose
    }
}

function IsAutoLogonDisabled()
{
    #check only for 32 bit reg key as winlogon process is 32 bit
    $registryPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon"

    if (-not (Test-Path $registryPath))
    {
        Write-Verbose -Message "Registry path $registryPath not found" -Verbose
        return $true
    }

    $autoadminLogon = (Get-ItemProperty $registryPath -ErrorAction SilentlyContinue).AutoAdminLogon
    if ([string]::IsNullOrEmpty($autoadminLogon))
    {
        Write-Verbose -Message "Registry path $registryPath found. AutoAdminLogon key is not set." -Verbose
        return $true
    }
    elseif($autoadminLogon -eq "1")
    {
        return $false
    }

    Write-Verbose -Message "Registry path $registryPath found. AutoAdminLogon key is not enabled." -Verbose
    return $true
}

function IsDontShowUISetInRegistryPath($registryPath)
{
    if (-not (Test-Path $registryPath))
    {
        Write-Verbose -Message "Registry path $registryPath not found" -Verbose
        return $false
    }

    $dontShowUI = (Get-ItemProperty $registryPath -ErrorAction SilentlyContinue).DontShowUI
    if ([string]::IsNullOrEmpty($dontShowUI))
    {
        Write-Verbose -Message "Registry path $registryPath found. DontShowUI key is not set." -Verbose
        return $false
    }
    elseif($dontShowUI -eq "1")
    {
        return $true
    }
    elseif($dontShowUI -eq "0")
    {
        Write-Verbose -Message "Registry path $registryPath found. DontShowUI key is set to 0." -Verbose
        return $false
    }
}

function IsWindowsErrorReportingDontShowUISet($TestUserDomain, $TestUserName)
{
    if( -not(IsDontShowUISetInRegistryPath -registryPath "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting"))
    {
        $filter = "name = '" + $TestUserName +"' AND domain = '" + $TestUserDomain + "'"
        $user = $null;

        try {
            $user = Get-WmiObject win32_useraccount -Filter $filter
        }
        catch {
        }

        if($user -and $user.SID) {
            $hkuPath = "HKU:\" + $user.SID + "\SOFTWARE\Microsoft\Windows\Windows Error Reporting"
            New-PSDrive -PSProvider Registry -Name HKU -Root HKEY_USERS
            if( -not(IsDontShowUISetInRegistryPath -registryPath $hkuPath))
            {
                Write-Verbose "Windows Error Reporting DontShowUI not set" -Verbose
            }
        }
        else{
            Write-Verbose "Windows Error Reporting DontShowUI not set" -Verbose
        }
    }
}

function LegalNoticeKeysAreNotEmpty([string] $registryPath)
{
    if (-not (Test-Path $registryPath))
    {
        Write-Verbose -Message "Registry path $registryPath not found" -Verbose
        return $false
    }

    $legalCaption = (Get-ItemProperty $registryPath -ErrorAction SilentlyContinue).legalnoticecaption
    $legalText = (Get-ItemProperty $registryPath -ErrorAction SilentlyContinue).legalnoticetext
    if ((-not [string]::IsNullOrEmpty($legalCaption)) -and (-not [string]::IsNullOrEmpty($legalText)))
    {
        Write-Verbose -Message "Registry path $registryPath found. Both keys legalnoticecaption and legalnoticetext are not empty." -Verbose
        return $true
    }

    return $false
}

function Update-RebootCount([string] $environmentURL)
{
    #this is to detect whether OS is 64 bit or 32 bit
    if ([IntPtr]::Size -eq 8)
    {
        $testAgentRegPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\TestAgentConfig"
    }
    else
    {
        $testAgentRegPath = "HKLM:\SOFTWARE\Microsoft\TestAgentConfig"
    }

    #in case registry key is not found create a new one with required values
    if (-not (Test-Path $testAgentRegPath))
    {
        New-Item -Path $testAgentRegPath -Force -ErrorAction SilentlyContinue | Out-Null
        Write-Verbose -Message ("Updating machine reboot count to 1") -Verbose
        New-ItemProperty -Path $testAgentRegPath -Name "MachineRebootCount" -Value 1 -PropertyType DWord -Force -ErrorAction SilentlyContinue | Out-Null
        New-ItemProperty -Path $testAgentRegPath -Name "EnvironmentURL" -Value $environmentURL -PropertyType String -Force -ErrorAction SilentlyContinue | Out-Null
        return 1;
    }

    [int]$machineRebootCount = (Get-ItemProperty $testAgentRegPath -ErrorAction SilentlyContinue).MachineRebootCount
    $savedEnvURL = (Get-ItemProperty $testAgentRegPath -ErrorAction SilentlyContinue).EnvironmentURL

    if (($machineRebootCount -eq $null) -or ([string]::Compare($savedEnvURL, $environmentURL, $True) -ne 0))
    {
        $machineRebootCount = 0
    }

    [int]$machineRebootCount = $machineRebootCount + 1;
    Write-Verbose -Message "Updating machine reboot count to : $machineRebootCount" -Verbose
    Set-ItemProperty -Path $testAgentRegPath -Name "MachineRebootCount" -Value $machineRebootCount -Force | Out-Null
    Set-ItemProperty -Path $testAgentRegPath -Name "EnvironmentURL" -Value $environmentURL -Force | Out-Null

    return $machineRebootCount
}

function Set-DisableScreenSaverReg {
    Set-ItemProperty -Path 'REGISTRY::HKEY_CURRENT_USER\Control Panel\Desktop' -Name ScreenSaveActive -Value 0 -ErrorAction SilentlyContinue
    $groupPolicy = (Get-ItemProperty -Path 'REGISTRY::HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Control Panel\Desktop' -ErrorAction SilentlyContinue).ScreenSaveActive
    if($groupPolicy -eq "1"){
        Write-Warning "Windows group policy settings restricts disabling screensaver"
    }
}

function ConfigurePowerOptions {
    Try
    {
        Write-Verbose -Message ("Executing command : {0} " -f "powercfg.exe /Change monitor-timeout-ac 0 ; powercfg.exe /Change monitor-timeout-dc 0") -Verbose
        Invoke-Command -ErrorAction SilentlyContinue -ErrorVariable err -OutVariable out -scriptBlock { powercfg.exe /Change monitor-timeout-ac 0 ; powercfg.exe /Change monitor-timeout-dc 0 }
        Write-Verbose -Message ("Error : {0} " -f ($err | out-string)) -Verbose
        Write-Verbose -Message ("Output : {0} " -f ($out | out-string)) -Verbose
    }
    Catch [Exception]
    {
        Write-Verbose -Message ("Unable to configure display settings, the session may get inactive due to display settings, continuing. Exception : {0}" -f  $_.Exception.Message) -Verbose
    }
}

function Set-EnableAutoLogon($TestUserDomain, $TestUserName, $TestUserPassword) {
    Write-Verbose -Message "Enabling auto logon"

    # If the type has already been loaded once, then it is not loaded again.
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace MS.VS.TestTools.Config
{
    internal static class NativeMethods
    {
        // serviceStartup types (http://msdn.microsoft.com/en-us/library/ms682450(VS.85).aspx)
        public static int SERVICE_AUTO_START = 0x00000002;


        // ServiceTypes (other service types are at http://msdn.microsoft.com/en-us/library/ms682450(VS.85).aspx)
        public static int SERVICE_WIN32_OWN_PROCESS = 0x00000010;

        // The severity of the error, and action taken, if this service fails to start.
        // http://msdn.microsoft.com/en-us/library/ms682450(VS.85).aspx
        public static int SERVICE_ERROR_NORMAL = 0x00000001;


        /// </summary>
        public static uint SERVICE_NO_CHANGE = 0xffffffff;

        /// <summary>
        /// Standard access rights (http://msdn.microsoft.com/en-us/library/aa379607(VS.85).aspx)
        /// </summary>
        public static int WRITE_OWNER = 0x80000;
        public static int WRITE_DAC = 0x40000;
        public static int READ_CONTROL = 0x20000;
        public static int DELETE = 0x10000;
        public static uint LSA_POLICY_ALL_ACCESS = 0x1FFF;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct QUERY_SERVICE_CONFIG
        {
            public int serviceType;
            public int startType;
            public int errorControl;
            public string binaryPathName;
            public string loadOrderGroup;
            public int tagId;
            public string dependencies;
            public string serviceStartName;
            public string displayName;
        }

        [Flags]
        public enum ServiceAccessRights : uint
        {
            SERVICE_QUERY_CONFIG = 0x0001, // Required to call the QueryServiceConfig and QueryServiceConfig2 functions to query the service configuration.
            SERVICE_CHANGE_CONFIG = 0x0002, // Required to call the ChangeServiceConfig or ChangeServiceConfig2 function to change the service configuration. Because this grants the caller the right to change the executable file that the system runs, it should be granted only to administrators.
            SERVICE_QUERY_STATUS = 0x0004, // Required to call the QueryServiceStatusEx function to ask the service control manager about the status of the service.
            SERVICE_ENUMERATE_DEPENDENTS = 0x0008, // Required to call the EnumDependentServices function to enumerate all the services dependent on the service.
            SERVICE_START = 0x0010, // Required to call the StartService function to start the service.
            SERVICE_STOP = 0x0020, // Required to call the ControlService function to stop the service.
            SERVICE_PAUSE_CONTINUE = 0x0040, // Required to call the ControlService function to pause or continue the service.
            SERVICE_INTERROGATE = 0x0080, // Required to call the ControlService function to ask the service to report its status immediately.
            SERVICE_USER_DEFINED_CONTROL = 0x0100, // Required to call the ControlService function to specify a user-defined control code.

            SERVICE_ALL_ACCESS = 0xF01FF, // Includes STANDARD_RIGHTS_REQUIRED in addition to all access rights in this table.
        }

        [Flags]
        public enum ServiceControlAccessRights : uint
        {
            SC_MANAGER_CONNECT = 0x0001, // Required to connect to the service control manager.
            SC_MANAGER_CREATE_SERVICE = 0x0002, // Required to call the CreateService function to create a service object and add it to the database.
            SC_MANAGER_ENUMERATE_SERVICE = 0x0004, // Required to call the EnumServicesStatusEx function to list the services that are in the database.
            SC_MANAGER_LOCK = 0x0008, // Required to call the LockServiceDatabase function to acquire a lock on the database.
            SC_MANAGER_QUERY_LOCK_STATUS = 0x0010, // Required to call the QueryServiceLockStatus function to retrieve the lock status information for the database.
            SC_MANAGER_MODIFY_BOOT_CONFIG = 0x0020, // Required to call the NotifyBootConfigStatus function.
            SC_MANAGER_ALL_ACCESS = 0xF003F // Includes STANDARD_RIGHTS_REQUIRED, in addition to all access rights in this table.
        }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        public struct SERVICE_DESCRIPTION
        {
            public string lpDescription;
        }

        public enum ServiceConfig2InfoLevel : uint
        {
            SERVICE_CONFIG_DESCRIPTION = 0x00000001, // The lpInfo parameter is a pointer to a SERVICE_DESCRIPTION structure.
            SERVICE_CONFIG_FAILURE_ACTIONS = 0x00000002, // The lpInfo parameter is a pointer to a SERVICE_FAILURE_ACTIONS structure.
            SERVICE_CONFIG_FAILURE_ACTIONS_FLAG = 0x00000004, // The lpInfo parameter is a pointer to a SERVICE_FAILURE_ACTIONS_FLAG structure.
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct SERVICE_FAILURE_ACTIONS
        {
            public UInt32 dwResetPeriod;
            public string lpRebootMsg;
            public string lpCommand;
            public UInt32 cActions;
            public IntPtr lpsaActions;
        }

        public enum SC_ACTION_TYPE : uint
        {
            SC_ACTION_NONE = 0x00000000, // No action.
            SC_ACTION_RESTART = 0x00000001, // Restart the service.
            SC_ACTION_REBOOT = 0x00000002, // Reboot the computer.
            SC_ACTION_RUN_COMMAND = 0x00000003 // Run a command.
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct SERVICE_FAILURE_ACTIONS_FLAG
        {
            public Boolean FailureActionsOnNonCrashFailures;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct SC_ACTION
        {
            public SC_ACTION_TYPE Type;
            public UInt32 Delay;
        }

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr OpenSCManager(string machineName, string db, ServiceControlAccessRights desiredAccess);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CloseServiceHandle(IntPtr handle);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        public static extern IntPtr CreateService(
            IntPtr serviceHandle,
            string serviceName,
            string serviceDisplayName,
            ServiceAccessRights desiredAccess,
            int type,
            int startType,
            int errorControl,
            string binaryPathName,
            string loadOrderGroup,
            string tagId,
            string dependencies,
            string accountName,
            string password);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern int ChangeServiceConfig(
            IntPtr handle,
            uint type,
            uint startType,
            uint errorControl,
            string binaryPathName,
            string loadOrderGroup,
            string tagId,
            string dependencies,
            string accountName,
            string password,
            string displayName
            );

        [DllImport("advapi32.dll", SetLastError = true, EntryPoint = "ChangeServiceConfig2", CharSet = CharSet.Unicode)]
        public static extern int ChangeServiceDescription(IntPtr serviceHandle, ServiceConfig2InfoLevel dwInfoLevel,
            [MarshalAs(UnmanagedType.Struct)] ref SERVICE_DESCRIPTION serviceDescription);

        [DllImport("advapi32.dll", SetLastError = true, EntryPoint = "ChangeServiceConfig2")]
        public static extern int ChangeServiceConfig2(
            IntPtr hService,
            ServiceConfig2InfoLevel dwInfoLevel,
            IntPtr lpInfo);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        public static extern int QueryServiceConfigW(
            IntPtr handle,
            IntPtr serviceConfigHandle,
            int bufferSize,
            out int bytesNeeded
            );


        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        public static extern IntPtr OpenService(IntPtr serviceHandle, string serviceName, int desiredAccess);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        public static extern int StartService(IntPtr serviceHandle, int dwNumServiceArgs, string lpServiceArgVectors);

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode)]
        public static extern int DeleteService(IntPtr serviceHandle);


        [StructLayout(LayoutKind.Sequential)]
        public struct LSA_UNICODE_STRING
        {
            public UInt16 Length;
            public UInt16 MaximumLength;

            // We need to use an IntPtr because if we wrap the Buffer with a SafeHandle-derived class, we get a failure during LsaAddAccountRights
            public IntPtr Buffer;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct LSA_OBJECT_ATTRIBUTES
        {
            public UInt32 Length;
            public IntPtr RootDirectory;
            public LSA_UNICODE_STRING ObjectName;
            public UInt32 Attributes;
            public IntPtr SecurityDescriptor;
            public IntPtr SecurityQualityOfService;
        }

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaOpenPolicy(
           ref LSA_UNICODE_STRING SystemName,
           ref LSA_OBJECT_ATTRIBUTES ObjectAttributes,
           uint DesiredAccess,
           out IntPtr PolicyHandle
        );

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaEnumerateAccountRights(
           IntPtr PolicyHandle,
           byte[] AccountSid,
           out IntPtr UserRights,
           out uint CountOfRights);

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaAddAccountRights(
           IntPtr PolicyHandle,
           byte[] AccountSid,
           LSA_UNICODE_STRING[] UserRights,
           uint CountOfRights);

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaRemoveAccountRights(
           IntPtr PolicyHandle,
           byte[] AccountSid,
           byte AllRights,
           LSA_UNICODE_STRING[] UserRights,
           uint CountOfRights);

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaStorePrivateData(
             IntPtr policyHandle,
             ref LSA_UNICODE_STRING KeyName,
             ref LSA_UNICODE_STRING PrivateData
        );

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaNtStatusToWinError(
            uint status
        );

        [DllImport("advapi32.dll", SetLastError = true, PreserveSig = true)]
        public static extern uint LsaFreeMemory(IntPtr pBuffer);

        [DllImport("advapi32.dll")]
        public static extern Int32 LsaClose(IntPtr ObjectHandle);


        public static uint LOGON32_LOGON_NETWORK = 3;
        public static uint LOGON32_PROVIDER_DEFAULT = 0;

        [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern int LogonUser(string userName, string domain, string password, uint logonType, uint logonProvider, out IntPtr tokenHandle);

        [DllImport("kernel32", SetLastError = true)]
        internal static extern bool CloseHandle(IntPtr handle);

        public const uint QueryToken = 0x0008;

        [DllImportAttribute("advapi32.dll", EntryPoint = "OpenProcessToken")]
        [return: MarshalAsAttribute(UnmanagedType.Bool)]
        public static extern bool OpenProcessToken(
            [InAttribute()]
            System.IntPtr ProcessHandle,
            uint DesiredAccess,
            out System.IntPtr TokenHandle);

        [DllImport("userenv.dll", SetLastError = true, CharSet = CharSet.Auto)]
        public static extern bool LoadUserProfile(IntPtr hToken, ref PROFILEINFO lpProfileInfo);

        [StructLayout(LayoutKind.Sequential)]
        public struct PROFILEINFO
        {
            public int dwSize;
            public int dwFlags;
            [MarshalAs(UnmanagedType.LPTStr)]
            public String lpUserName;
            [MarshalAs(UnmanagedType.LPTStr)]
            public String lpProfilePath;
            [MarshalAs(UnmanagedType.LPTStr)]
            public String lpDefaultPath;
            [MarshalAs(UnmanagedType.LPTStr)]
            public String lpServerName;
            [MarshalAs(UnmanagedType.LPTStr)]
            public String lpPolicyPath;
            public IntPtr hProfile;
        }
    }

    internal class LsaPolicy : IDisposable
    {
        public IntPtr Handle { get; set; }

        public LsaPolicy()
        {
            NativeMethods.LSA_UNICODE_STRING system = new NativeMethods.LSA_UNICODE_STRING();

            NativeMethods.LSA_OBJECT_ATTRIBUTES attrib = new NativeMethods.LSA_OBJECT_ATTRIBUTES()
            {
                Length = 0,
                RootDirectory = IntPtr.Zero,
                Attributes = 0,
                SecurityDescriptor = IntPtr.Zero,
                SecurityQualityOfService = IntPtr.Zero,
            };

            IntPtr handle = IntPtr.Zero;
            uint hr = NativeMethods.LsaOpenPolicy(ref system, ref attrib, NativeMethods.LSA_POLICY_ALL_ACCESS, out handle);
            if (hr != 0 || handle == IntPtr.Zero)
            {
                throw new Exception("OpenLsaFailed");
            }

            Handle = handle;
        }

        public LsaPolicy(LSA_AccessPolicy access)
        {
            NativeMethods.LSA_UNICODE_STRING system = new NativeMethods.LSA_UNICODE_STRING();

            NativeMethods.LSA_OBJECT_ATTRIBUTES attrib = new NativeMethods.LSA_OBJECT_ATTRIBUTES()
            {
                Length = 0,
                RootDirectory = IntPtr.Zero,
                Attributes = 0,
                SecurityDescriptor = IntPtr.Zero,
                SecurityQualityOfService = IntPtr.Zero,
            };

            IntPtr handle = IntPtr.Zero;
            uint hr = NativeMethods.LsaOpenPolicy(ref system, ref attrib, (uint)access, out handle);
            if (hr != 0 || handle == IntPtr.Zero)
            {
                throw new Exception("OpenLsaFailed");
            }

            Handle = handle;
        }

        public void SetSecretData(string key, string value)
        {
            NativeMethods.LSA_UNICODE_STRING secretData = new NativeMethods.LSA_UNICODE_STRING();
            NativeMethods.LSA_UNICODE_STRING secretName = new NativeMethods.LSA_UNICODE_STRING();

            secretName.Buffer = Marshal.StringToHGlobalUni(key);
            secretName.Length = (UInt16)(key.Length * UnicodeEncoding.CharSize);
            secretName.MaximumLength = (UInt16)((key.Length + 1) * UnicodeEncoding.CharSize);

            if (value.Length > 0)
            {
                // Create data and key
                secretData.Buffer = Marshal.StringToHGlobalUni(value);
                secretData.Length = (UInt16)(value.Length * UnicodeEncoding.CharSize);
                secretData.MaximumLength = (UInt16)((value.Length + 1) * UnicodeEncoding.CharSize);
            }
            else
            {
                // Delete data and key
                secretData.Buffer = IntPtr.Zero;
                secretData.Length = 0;
                secretData.MaximumLength = 0;
            }

            uint result = NativeMethods.LsaStorePrivateData(Handle, ref secretName, ref secretData);

            uint winErrorCode = NativeMethods.LsaNtStatusToWinError(result);
            if (winErrorCode != 0)
            {
                throw new Exception("FailedLsaStoreData: " + winErrorCode);
            }
        }

        void IDisposable.Dispose()
        {
            if (Handle != IntPtr.Zero)
            {
                int hr = NativeMethods.LsaClose(Handle);
                if (hr != 0)
                {
                    Debug.Fail("Failure during LsaClose of policy handle: return code = " + hr);
                }

                Handle = IntPtr.Zero;
            }

            GC.SuppressFinalize(this);
        }

        internal static string DefaultPassword = "DefaultPassword";
    }

    internal enum LSA_AccessPolicy : long
    {
        POLICY_VIEW_LOCAL_INFORMATION = 0x00000001L,
        POLICY_VIEW_AUDIT_INFORMATION = 0x00000002L,
        POLICY_GET_PRIVATE_INFORMATION = 0x00000004L,
        POLICY_TRUST_ADMIN = 0x00000008L,
        POLICY_CREATE_ACCOUNT = 0x00000010L,
        POLICY_CREATE_SECRET = 0x00000020L,
        POLICY_CREATE_PRIVILEGE = 0x00000040L,
        POLICY_SET_DEFAULT_QUOTA_LIMITS = 0x00000080L,
        POLICY_SET_AUDIT_REQUIREMENTS = 0x00000100L,
        POLICY_AUDIT_LOG_ADMIN = 0x00000200L,
        POLICY_SERVER_ADMIN = 0x00000400L,
        POLICY_LOOKUP_NAMES = 0x00000800L,
        POLICY_NOTIFICATION = 0x00001000L
    }

    public static class RegHelper
    {
        public static void SetAutoLogonPassword(string password)
        {
            using (LsaPolicy lsaPolicy = new LsaPolicy(LSA_AccessPolicy.POLICY_CREATE_SECRET))
            {
                lsaPolicy.SetSecretData(LsaPolicy.DefaultPassword, password);
            }
        }
    }
}
'@

    try {

        Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name AutoAdminLogon -Value 1 -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultUserName -Value $TestUserName -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultDomainName -Value $TestUserDomain -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\Reliability' -Name ShutdownReasonOn -Value 0 -ErrorAction SilentlyContinue
        Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\Reliability' -Name ShutdownReasonUI -Value 0 -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name AutoLogonCount -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultPassword -ErrorAction SilentlyContinue

        [MS.VS.TestTools.Config.RegHelper]::SetAutoLogonPassword($TestUserPassword)
    }
    catch {
        Write-Warning "Unable to set auto logon: $_"
    }
}

# Adding check for whether the test user has the active session or not.
# Previously we were checking for any active session which doesn't reflect to test user active sessions
function IsTestUserCurrentlyLoggedIn($TestUserDomain, $TestUserName)
{
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace MS.VS.TestTools.Config
{
    public static class EnumerateUsers
    {
        [DllImport("wtsapi32.dll")]
        static extern IntPtr WTSOpenServer([MarshalAs(UnmanagedType.LPStr)] String pServerName);

        [DllImport("wtsapi32.dll")]
        static extern void WTSCloseServer(IntPtr hServer);

        [DllImport("wtsapi32.dll")]
        static extern Int32 WTSEnumerateSessions(
            IntPtr hServer,
            [MarshalAs(UnmanagedType.U4)] Int32 Reserved,
            [MarshalAs(UnmanagedType.U4)] Int32 Version,
            ref IntPtr ppSessionInfo,
            [MarshalAs(UnmanagedType.U4)] ref Int32 pCount);

        [DllImport("wtsapi32.dll")]
        static extern void WTSFreeMemory(IntPtr pMemory);

        [DllImport("Wtsapi32.dll")]
        static extern bool WTSQuerySessionInformation(
            System.IntPtr hServer, int sessionId, WTS_INFO_CLASS wtsInfoClass, out System.IntPtr ppBuffer, out uint pBytesReturned);

        [StructLayout(LayoutKind.Sequential)]
        private struct WTS_SESSION_INFO
        {
            public Int32 SessionID;

            [MarshalAs(UnmanagedType.LPStr)]
            public String pWinStationName;

            public WTS_CONNECTSTATE_CLASS State;
        }

        public enum WTS_INFO_CLASS
        {
            WTSInitialProgram,
            WTSApplicationName,
            WTSWorkingDirectory,
            WTSOEMId,
            WTSSessionId,
            WTSUserName,
            WTSWinStationName,
            WTSDomainName,
            WTSConnectState,
            WTSClientBuildNumber,
            WTSClientName,
            WTSClientDirectory,
            WTSClientProductId,
            WTSClientHardwareId,
            WTSClientAddress,
            WTSClientDisplay,
            WTSClientProtocolType
        }
        public enum WTS_CONNECTSTATE_CLASS
        {
            WTSActive,
            WTSConnected,
            WTSConnectQuery,
            WTSShadow,
            WTSDisconnected,
            WTSIdle,
            WTSListen,
            WTSReset,
            WTSDown,
            WTSInit
        }

        public static IntPtr OpenServer(String Name)
        {
            IntPtr server = WTSOpenServer(Name);
            return server;
        }
        public static void CloseServer(IntPtr ServerHandle)
        {
            WTSCloseServer(ServerHandle);
        }
        public static bool IsActiveSessionExists(string testUserDomain, string testUsername)
        {
            var serverHandle = IntPtr.Zero;
            serverHandle = OpenServer(Environment.MachineName);
            var SessionInfoPtr = IntPtr.Zero;

            try
            {
                var userPtr = IntPtr.Zero;
                var domainPtr = IntPtr.Zero;
                var sessionCount = 0;
                var retVal = WTSEnumerateSessions(serverHandle, 0, 1, ref SessionInfoPtr, ref sessionCount);
                var dataSize = Marshal.SizeOf(typeof(WTS_SESSION_INFO));
                var currentSession = SessionInfoPtr;

                if (retVal != 0)
                {
                    for (var i = 0; i < sessionCount; i++)
                    {
                        uint bytes = 0;
                        var si = (WTS_SESSION_INFO)Marshal.PtrToStructure(currentSession, typeof(WTS_SESSION_INFO));
                        currentSession += dataSize;

                        WTSQuerySessionInformation(serverHandle, si.SessionID, WTS_INFO_CLASS.WTSUserName, out userPtr, out bytes);
                        WTSQuerySessionInformation(serverHandle, si.SessionID, WTS_INFO_CLASS.WTSDomainName, out domainPtr, out bytes);

                        var domain = Marshal.PtrToStringAnsi(domainPtr);
                        var username = Marshal.PtrToStringAnsi(userPtr);

                        Console.WriteLine("Domain : " + domain + "; Username: " + username + "; State: " + si.State);

                        if (testUsername.Equals(username, StringComparison.OrdinalIgnoreCase) &&
                            si.State == WTS_CONNECTSTATE_CLASS.WTSActive)
                        {
                            WTSFreeMemory(userPtr);
                            WTSFreeMemory(domainPtr);
                            return true;
                        }
                        WTSFreeMemory(userPtr);
                        WTSFreeMemory(domainPtr);
                    }
                }
            }
            finally
            {
                WTSFreeMemory(SessionInfoPtr);
                CloseServer(serverHandle);
            }
            return false;
        }
    }
}
'@
    return [MS.VS.TestTools.Config.EnumerateUsers]::IsActiveSessionExists($TestUserDomain, $TestUserName)
}

function SetupTestMachine($TestUserName, $TestUserPassword, $EnvironmentURL) {

    # checking prerequisites for autologon and printing required log messages. Do not send output of this function to null as we need those log messages to print required warnings
    CheckForAutoLogonPrerequisites

    # For UI Test scenarios, we need to disable the screen saver and enable auto logon
    $DomainUser = $TestUserName.Split("\")
    $Domain = "."
    if($DomainUser.Length -gt 1)
    {
        $Domain = $DomainUser[0]
        $TestUser = $DomainUser[1]
    } else {
        $TestUser = $TestUserName
    }

    Write-Verbose -Message "Test User $TestUser" -Verbose
    Write-Verbose -Message "Test UserDomain $Domain" -Verbose

    Set-DisableScreenSaverReg | Out-Null
    ConfigurePowerOptions | Out-Null
    #IsWindowsErrorReportingDontShowUISet -TestUserDomain $Domain -TestUserName $TestUser

    $isTestUserLogged = IsTestUserCurrentlyLoggedIn -TestUserDomain $Domain -TestUserName $TestUser
    if(-not $isTestUserLogged)
    {
        $rebootCount = Update-RebootCount($EnvironmentURL)
        if($rebootCount -gt 3)
        {
            throw ("Stopping test machine setup as it exceeded maximum number of reboots. If you are running test agent in interactive mode, please make sure that autologon is enabled and no legal notice is displayed on logon in test machines.")
        }
        Write-Verbose "Currently test user is not logged in. Rebooting machine." -Verbose
        Set-EnableAutoLogon -TestUserDomain $Domain -TestUserName $TestUser -TestUserPassword $TestUserPassword
        return 3010
    }

    Write-Verbose "Configuration for UI testing is completed" -Verbose
    return 0
}

return SetupTestMachine -TestUserName $testUserName -TestUserPassword $testUserPassword -EnvironmentURL $environmentURL