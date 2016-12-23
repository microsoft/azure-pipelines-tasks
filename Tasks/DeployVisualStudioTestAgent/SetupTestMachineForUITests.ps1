function Set-DisableScreenSaverReg {
    Set-ItemProperty -Path 'REGISTRY::HKEY_CURRENT_USER\Control Panel\Desktop' -Name ScreenSaveActive -Value 0 -ErrorAction SilentlyContinue
    $groupPolicy = (Get-ItemProperty -Path 'REGISTRY::HKEY_CURRENT_USER\Software\Policies\Microsoft\Windows\Control Panel\Desktop' -ErrorAction SilentlyContinue).ScreenSaveActive
    if($groupPolicy -eq "1"){
        Write-Warning "Windows group policy settings restricts disabling screensaver"
    }
}

function IsAnySessionActive()
{
    $wtssig = @'
    namespace mystruct
    {
        using System;
        using System.Runtime.InteropServices;

        [StructLayout(LayoutKind.Sequential)]
        public struct WTS_SESSION_INFO
        {
            public Int32 SessionID;

            [MarshalAs(UnmanagedType.LPStr)]
            public String pWinStationName;

            public WTS_CONNECTSTATE_CLASS State;
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
    }
'@

    $wtsenumsig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern int WTSEnumerateSessions(
            System.IntPtr hServer,
            int Reserved,
            int Version,
            ref System.IntPtr ppSessionInfo,
            ref int pCount);
'@

    $wtsopensig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern IntPtr WTSOpenServer(string pServerName);
'@

    $wtsSendMessagesig = @'
        [DllImport("wtsapi32.dll", SetLastError = true)]
        public static extern bool WTSSendMessage(
            IntPtr hServer,
            [MarshalAs(UnmanagedType.I4)] int SessionId,
            String pTitle,
            [MarshalAs(UnmanagedType.U4)] int TitleLength,
            String pMessage,
            [MarshalAs(UnmanagedType.U4)] int MessageLength,
            [MarshalAs(UnmanagedType.U4)] int Style,
            [MarshalAs(UnmanagedType.U4)] int Timeout,
            [MarshalAs(UnmanagedType.U4)] out int pResponse,
            bool bWait);
'@

    add-type  $wtssig
    $wtsenum = add-type -MemberDefinition $wtsenumsig -Name PSWTSEnumerateSessions -Namespace GetLoggedOnUsers -PassThru
    $wtsOpen = add-type -MemberDefinition $wtsopensig -name PSWTSOpenServer -Namespace GetLoggedOnUsers -PassThru
    $wtsmessage = Add-Type -MemberDefinition $wtsSendMessagesig -name PSWTSSendMessage -Namespace GetLoggedOnUsers -PassThru

    [long]$count = 0
    [long]$ppSessionInfo = 0

    $server = $wtsOpen::WTSOpenServer("localhost")
    [long]$retval = $wtsenum::WTSEnumerateSessions($server, 0, 1, [ref]$ppSessionInfo,[ref]$count)
    $datasize = [system.runtime.interopservices.marshal]::SizeOf([System.Type][mystruct.WTS_SESSION_INFO])

    [bool]$activeSession = $false

    if ($retval -ne 0)
    {
        for ($i = 0; $i -lt $count; $i++)
        {
            $element = [system.runtime.interopservices.marshal]::PtrToStructure($ppSessionInfo + ($datasize* $i), [System.type][mystruct.WTS_SESSION_INFO])
            Write-Verbose -Message("{0} : {1}" -f $element.pWinStationName, $element.State.ToString()) -Verbose
            if ($element.State.ToString().Equals("WTSActive"))
            {
                $activeSession = $true
            }
        }
    }

    return $activeSession
}

function ConfigurePowerOptions([System.Management.Automation.PSCredential] $MachineCredential)  
{
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

    ## TODO fix this
    $TestUserDomain = "fareast"

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
            uint hr = NativeMethods.LsaOpenPolicy(ref system, ref attrib, (uint) access, out handle);
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
                throw new Exception("FailedLsaStoreData: "+ winErrorCode);
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

    public static class RegHelper {
        public static void SetAutoLogonPassword(string password){
            using (LsaPolicy lsaPolicy = new LsaPolicy(LSA_AccessPolicy.POLICY_CREATE_SECRET))
            {
                lsaPolicy.SetSecretData(LsaPolicy.DefaultPassword, password);
            }
        }
    }
}
'@

    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name AutoAdminLogon -Value 1 -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name ForceAutoLogon -Value 1 -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultUserName -Value $TestUserName -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultDomainName -Value $TestUserDomain -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\Reliability' -Name ShutdownReasonOn -Value 0 -ErrorAction SilentlyContinue
    Set-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\Reliability' -Name ShutdownReasonUI -Value 0 -ErrorAction SilentlyContinue
    
    Remove-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name AutoLogonCount -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path 'REGISTRY::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultPassword -ErrorAction SilentlyContinue
    [MS.VS.TestTools.Config.RegHelper]::SetAutoLogonPassword($TestUserPassword)
}

function SetupTestMachine($TestUserName, $TestUserPassword) {
    # For UI Test scenarios, we need to disable the screen saver and enable auto logon
    Set-EnableAutoLogon("", $TestUserName, $TestUserPassword)
    Set-DisableScreenSaverReg

    $isSessionActive = IsAnySessionActive
    if (-not ($isSessionActive))
    {
        Write-Verbose -Message("Value returned {0}" -f $isSessionActive) -Verbose
        Write-Verbose "No desktop session was found active, marking the machine for reboot"
        return 3010
    }
}

return SetupTestMachine -TestUserName $testUserName -TestUserPassword $testUserPassword