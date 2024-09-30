import VersionInfoVersion from "../pe-parser/VersionInfoVersion";
import {VersionInfo} from "../pe-parser/VersionResource";

export function getVersionFallback(version: VersionInfo): VersionInfoVersion {
    const {a, b, c, d} = version.productVersion;
    if (a === 0 && b === 0 && c === 0 && d === 0) {
        return version.fileVersion;
    }
    return version.productVersion;
}