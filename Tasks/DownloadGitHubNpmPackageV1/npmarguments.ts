interface NpmArgumentWriter {
    arg(argument: string): void;
    line(command: string): void;
}

export function getNpmArguments(
    packageDownloadPath: string,
    packageName: string,
    packageVersion: string
): string[] {
    const packageSpec = `@${packageName}${packageVersion ? `@${packageVersion}` : ''}`;
    return ['install', '--prefix', packageDownloadPath, packageSpec];
}

export function setNpmArguments(
    npm: NpmArgumentWriter,
    packageDownloadPath: string,
    packageName: string,
    packageVersion: string,
    isArgumentIsolationFixEnabled: boolean
): void {
    if (isArgumentIsolationFixEnabled) {
        for (const argument of getNpmArguments(packageDownloadPath, packageName, packageVersion)) {
            npm.arg(argument);
        }
    } else {
        const packageSpec = `@${packageName}${packageVersion ? `@${packageVersion}` : ''}`;
        npm.line(`install --prefix ${packageDownloadPath} ${packageSpec}`);
    }
}
