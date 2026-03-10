export interface NuGetParsedVersion {
    a: number;
    b: number;
}

export function isNuGetVersionSupported(parsedVersion: NuGetParsedVersion): boolean {
    return !(parsedVersion.a < 3 || (parsedVersion.a <= 3 && parsedVersion.b < 5));
}
