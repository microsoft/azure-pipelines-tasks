import { AccessMapping, LocationServiceData } from "azure-devops-node-api/interfaces/LocationsInterfaces";

/**
 * Represents information about an URI used to access a service (e.g. https://pkgs.dev.azure.com/contoso/)
 * These uri prefixes are used e.g. by credential providers to determine which URIs to provide credentials for.
 * 
 * Essentially a higher-level AccessMapping that provides a normalized URI (handles virtualdirectory and adds trailing slash) and information about its intended uses.
 */
export interface PackagingAccessMapping {
    /**
     * Uri such as https://pkgs.dev.azure.com/contoso/, https://contoso.pkgs.visualstudio.com/, or https://pkgs.visualstudio.com/Aeab00668-a6f3-4174-940b-5107d345e830/
     * Always has a trailing slash.
     */
    uri: string;

    /**
     * True if a well-known and publicly used access mapping.
     * False otherwise, e.g. a HostGuidAccessMapping like https://pkgs.visualstudio.com/Aeab00668-a6f3-4174-940b-5107d345e830
     */
    isPublic: boolean;

    /**
     * True if this is the default access mapping, i.e. based on the user's preference for dev.azure.com vs visualstudio.com URLs.
     * False otherwise.
     */
    isDefault: boolean;
}

/**
 * Converts location service data into higher-level "uri prefixes, e.g. "https://pkgs.dev.azure.com/contoso/"
 * These uri prefixes are used e.g. by credential providers to determine which URIs to provide credentials for.
 * 
 * To use this API, first get connectionData, then pass connectionData.locationServiceData
 */
export function getPackagingAccessMappings(locationServiceData: LocationServiceData) : PackagingAccessMapping[] {
    // Both forms of the public access mapping, e.g. https://pkgs.dev.azure.com/{organization}/ and https://{organization}.pkgs.visualstudio.com/
    const commonAccessMappings = ['CodexAccessMapping', 'VstsAccessMapping'];

    return locationServiceData.accessMappings.map(accessMapping => {
        const isDefaultAccessMapping = accessMapping.moniker === locationServiceData.defaultAccessMappingMoniker;
        const isCommonAccessMapping = commonAccessMappings.indexOf(accessMapping.moniker) > -1;
        return {
            uri: toNormalizedAccessUri(accessMapping),
            isPublic: isDefaultAccessMapping || isCommonAccessMapping,
            isDefault: isDefaultAccessMapping
        }
    });
}

/**
 * Converts an access mapping to a packaging URI prefix (e.g. "https://pkgs.dev.azure.com/contoso/"),
 * ensuring trailing slashes and combining access points and virtual directories (e.g. for HostGuidAccessMappings).
 */
function toNormalizedAccessUri(accessMapping: AccessMapping): string {
    // We always ensure a trailing slash, since we use these access points in prefix comparisons
    if (!accessMapping.virtualDirectory) {
        return ensureTrailingSlash(accessMapping.accessPoint);
    }

    return ensureTrailingSlash(ensureTrailingSlash(accessMapping.accessPoint) + accessMapping.virtualDirectory);
}

function ensureTrailingSlash(uri: string) {
    return uri.endsWith("/") ? uri : uri + "/";
}