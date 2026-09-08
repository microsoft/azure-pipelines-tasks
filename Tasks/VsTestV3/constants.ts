export module AreaCodes {
    export const PUBLISHRESULTS = 'PublishResults';
    export const INVOKEVSTEST = 'InvokeVsTest';
    export const RUNTESTSLOCALLY = 'RunTestsLocally';
    export const INVALIDSETTINGSFILE = 'InvalidSettingsFile';
    export const EXECUTEVSTEST = 'ExecuteVsTest';
    export const GETVSTESTTESTSLISTINTERNAL = 'GetVsTestTestsListInternal';
    export const UPDATERESPONSEFILE = 'UpdateResponseFile';
    export const RESPONSECONTAINSNOTESTS = 'ResponseContainsNoTests';
    export const GENERATERESPONSEFILE = 'GenerateResponseFile';
    export const GETVSTESTTESTSLIST = 'GetVsTestTestsList';
    export const TIACONFIG = 'TiaConfig';
    export const TESTRUNUPDATIONFAILED = 'TestRunUpdationFailed';
    export const UPLOADTESTRESULTS = 'UploadTestResults';
    export const RUNVSTEST = 'RunVsTest';
    export const SPECIFIEDVSVERSIONNOTFOUND = 'SpecifiedVsVersionNotFound';
    export const TOOLSINSTALLERCACHENOTFOUND = 'ToolsInstallerCacheNotFound';
}

export module ResultMessages {
    export const UPLOADTESTRESULTSRETURNED = 'uploadTestResults returned ';
    export const EXECUTEVSTESTRETURNED = 'executeVstest returned ';
    export const TESTRUNUPDATIONFAILED = 'testRunupdation failed';
}

export module VsTestToolsInstaller {
    export const PathToVsTestToolVariable = 'VsTestToolsInstallerInstalledToolLocation';
}

export module VsTestConsole {
    export const EXE_NAME = 'vstest.console.exe';
    export const ARM64_EXE_NAME = 'vstest.console.arm64.exe';
}

export module FeatureFlags {
    export const ENABLE_ARM64_VSTEST_CONSOLE = 'TestExecution.EnableArm64VstestConsole';
}

export module ResourceAreas {
    export const TCM = '00000054-0000-8888-8000-000000000000';
}

export module DistributionTypes {
    export const EXECUTIONTIMEBASED = 'TestExecutionTimes';
    export const ASSEMBLYBASED = 'TestAssemblies';
    export const NUMBEROFTESTMETHODSBASED = 'numberoftestmethods';
}

export module ServerTypes {
    export const HOSTED = 'hosted';
}

export module ActionOnThresholdNotMet {
    export const DONOTHING = 'donothing';
}

export module BackDoorVariables {
    export const FORCE_HYDRA = 'Force_Hydra';
}

export module AgentVariables {
    export const AGENT_TEMPDIRECTORY = 'Agent.TempDirectory';
    export const AGENT_OSARCHITECTURE = 'Agent.OSArchitecture';
}