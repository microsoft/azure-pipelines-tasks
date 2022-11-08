import VersionInfoVersion from "../pe-parser/VersionInfoVersion";

export enum NuGetQuirkName {
    /** Race condition in credential provider which causes NuGet to not supply credentials */
    CredentialProviderRace,

    /** No credential provider support */
    NoCredentialProvider,

    /** repositoryPath value in nuget.config is relative to the wrong nuget.config in some cases */
    RelativeRepositoryPathBug,

    /** does not send NTLM credentials on follow-up requests */
    NtlmReAuthBug,

    /** Does not support authentication to TFS on-premises via credential provider */
    NoTfsOnPremAuthCredentialProvider,

    /** Does not support authentication to TFS on-premises via nuget.config */
    NoTfsOnPremAuthConfig,

    /** Does not support the NuGet v3 protocol */
    NoV3,

    /** Supports V2 plugin credential provider */
    V2CredentialProvider,
}

export interface VersionRange {
    begin: VersionInfoVersion;
    beginIsInclusive: boolean;
    end: VersionInfoVersion;
    endIsInclusive: boolean;
}

function halfOpenRange(begin: VersionInfoVersion, end: VersionInfoVersion): VersionRange {
    return { begin, beginIsInclusive: true, end, endIsInclusive: false };
}

function closedRange(begin: VersionInfoVersion, end: VersionInfoVersion): VersionRange {
    return { begin, beginIsInclusive: true, end, endIsInclusive: true };
}

function versionIsInRange(version: VersionInfoVersion, range: VersionRange): boolean {
    const beginComparison = VersionInfoVersion.compare(version, range.begin);
    const endComparison = VersionInfoVersion.compare(version, range.end);

    const beginResult = range.beginIsInclusive ? beginComparison >= 0 : beginComparison > 0;
    const endResult = range.endIsInclusive ? endComparison <= 0 : endComparison < 0;

    return beginResult && endResult;
}

export interface QuirkDescriptor {
    quirk: NuGetQuirkName;
    versionRanges: VersionRange[];
}

const nuget300 = new VersionInfoVersion(3, 0, 0, 0);
const nuget320 = new VersionInfoVersion(3, 2, 0, 0);
const nuget330 = new VersionInfoVersion(3, 3, 0, 0);
const nuget340 = new VersionInfoVersion(3, 4, 0, 0);
const nuget350_1707 = new VersionInfoVersion(3, 5, 0, 1707);
const nuget350_1829 = new VersionInfoVersion(3, 5, 0, 1829);
const nuget351 = new VersionInfoVersion(3, 5, 1, 0);
const nuget351_1707 = new VersionInfoVersion(3, 5, 1, 1707);
const nuget480 = new VersionInfoVersion(4, 8, 0, 0);

const allQuirks: QuirkDescriptor[] = [
    {
        quirk: NuGetQuirkName.CredentialProviderRace,
        // 1707 is the build of * 3.5.1 * where we first saw the bug resolved,
        // I'm not sure which build of 3.5.0 is the first to not have the bug,
        // but it would be less than 1707
        versionRanges: [
            halfOpenRange(nuget320, nuget350_1707),
            halfOpenRange(nuget351, nuget351_1707)],
    },
    {
        quirk: NuGetQuirkName.NoCredentialProvider,
        versionRanges: [halfOpenRange(VersionInfoVersion.MIN_VERSION, nuget320)],
    },
    {
        quirk: NuGetQuirkName.RelativeRepositoryPathBug,
        versionRanges: [halfOpenRange(nuget330, nuget340)],
    },
    {
        quirk: NuGetQuirkName.NtlmReAuthBug,
        versionRanges: [halfOpenRange(nuget330, nuget340)],
    },
    {
        quirk: NuGetQuirkName.NoV3,
        versionRanges: [halfOpenRange(VersionInfoVersion.MIN_VERSION, nuget300)],
    },
    {
        quirk: NuGetQuirkName.NoTfsOnPremAuthConfig,
        versionRanges: [closedRange(VersionInfoVersion.MIN_VERSION, VersionInfoVersion.MAX_VERSION)],
    },
    {
        quirk: NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
        versionRanges: [halfOpenRange(VersionInfoVersion.MIN_VERSION, nuget350_1829)],
    },
    {
        quirk: NuGetQuirkName.V2CredentialProvider,
        versionRanges: [halfOpenRange(nuget480, VersionInfoVersion.MAX_VERSION)],
    },
];

/** default quirks to use if the nuget version can't be determined */
export var defaultQuirks = [
    NuGetQuirkName.NoCredentialProvider,
    NuGetQuirkName.NoV3,
    NuGetQuirkName.NoTfsOnPremAuthConfig,
    NuGetQuirkName.NoTfsOnPremAuthCredentialProvider,
];

function resolveQuirks(nuGetVersion: VersionInfoVersion, definitions: QuirkDescriptor[]): NuGetQuirkName[] {
    return definitions
        .filter(quirkDesc => quirkDesc.versionRanges.some(range => versionIsInRange(nuGetVersion, range)))
        .map(quirkDesc => quirkDesc.quirk);
}

export class NuGetQuirks {
    constructor(public nuGetVersion: VersionInfoVersion, public quirks: NuGetQuirkName[]) { }

    public static fromVersion(nuGetVersion: VersionInfoVersion, definitions?: QuirkDescriptor[]) {
        definitions = definitions || allQuirks;
        return new NuGetQuirks(nuGetVersion, resolveQuirks(nuGetVersion, definitions));
    }

    public hasQuirk(quirk: NuGetQuirkName): boolean {
        return this.quirks.some(x => x === quirk);
    }

    public getQuirkNames(): string[] {
        return this.quirks.map(x => NuGetQuirkName[x]);
    }
}

export default NuGetQuirks;
