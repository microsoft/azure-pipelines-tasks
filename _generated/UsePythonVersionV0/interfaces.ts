export interface TaskParameters {
    versionSpec: string,
    disableDownloadFromRegistry: boolean,
    allowUnstable: boolean,
    addToPath: boolean,
    architecture: string,
    githubToken?: string
}

export interface PythonRelease {
    version: string,
    stable: boolean,
    release_url: string,
    files: PythonFileInfo[]
}

export interface PythonFileInfo {
    filename: string,
    arch: string,
    platform: string,
    platform_version?: string,
    download_url: string
}
