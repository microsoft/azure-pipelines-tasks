export let TestEnvVars = {
    runningOn: "__runningOn__",
    hostType: "__hostType__",
    operatingSystem: "__operating_system__",
    dockerRegistryServiceConnection: "__dockerRegistryServiceConnection__",
    repository: "__repository__",
    dockerFile: "__dockerFile__",
    buildContext: "__buildContext__",
    tags: "__tags__"
};

export let OperatingSystems = {
    Windows: "Windows",
    Other: "Other"
};

export let HostTypes ={
    build: "build",
    release: "release"
}

export let CommandTypes = {
    build: "build",
    push: "push"
};

export let SharedValues = {
    SYSTEM_TEAMFOUNDATIONCOLLECTIONURI: "https://dev.azure.com/abc",
    SYSTEM_TEAMPROJECT: "testproj",
    BUILD_REPOSITORY_NAME: "testrepo",
    BUILD_REPOSITORY_URI: "https://dev.azure.com/abc/testrepo",
    BUILD_SOURCEBRANCHNAME: "master",
    BUILD_SOURCEVERSION: "521747298a3790fde1710f3aa2d03b55020575aa",
    BUILD_DEFINITIONNAME: "testBD",
    BUILD_BUILDNUMBER: "11",
    BUILD_BUILDURI: "vstfs:///Build/Build/11",
    RELEASE_DEFINITIONNAME: "testRD",
    RELEASE_RELEASEID: "21",
    RELEASE_RELEASEWEBURL: "https://dev.azure.com/abc/testrepo/_release?releaseId=21&_a=release-summary",
    dockerRegistryServiceConnection: "dockerhubendpoint"
}

/**
 * Formats the given path to be appropriate for the operating system.
 * @param canonicalPath A non-rooted path using a forward slash (/) as a directory separator.
 */
export function formatPath(canonicalPath: string) {
    if (process.env[TestEnvVars.operatingSystem] === OperatingSystems.Windows) {
        return "F:\\" + canonicalPath.replace(/\//g, '\\');
    } else {
        return "/" + canonicalPath;
    }
};