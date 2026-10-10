import { isNullOrWhiteSpace, parseDotNetInt32, readJsonStringMap } from 'azure-pipelines-tasks-pipeline-artifacts-common';

export type Localize = (key: string, ...args: any[]) => string;

export const CUSTOM_PROPERTIES_PREFIX = 'user-';

const FORBIDDEN_ARTIFACT_NAME_CHARS = /[\u0000-\u001f":<>|*?/\\]/;

// Everything except letters, digits, spaces and dots is removed from the job identifier. (The agent plugin used the
// pattern [^a-zA-Z0-9 - .] in which '-' acts as a range operator between two spaces, so a '-' does not survive either.)
const JOB_IDENTIFIER_NOISE = /[^a-zA-Z0-9 .]/g;

export function isValidArtifactName(name: string): boolean {
    return !FORBIDDEN_ARTIFACT_NAME_CHARS.test(name);
}

export function normalizeJobIdentifier(jobIdentifier: string): string {
    return jobIdentifier.replace(JOB_IDENTIFIER_NOISE, '').replace('.default', '');
}

export function parseCustomProperties(value: string | undefined, loc: Localize): Record<string, string> | undefined {
    if (!value || isNullOrWhiteSpace(value)) {
        return undefined;
    }

    let pairs: Array<[string, string | null]>;
    try {
        pairs = readJsonStringMap(value);
    } catch {
        throw new Error(loc('ArtifactCustomPropertiesNotJson', value));
    }

    const properties = new Map<string, string>();
    for (const [key, propertyValue] of pairs) {
        properties.set(key, propertyValue ?? '');
    }

    // Like the plugin, only the first key without the prefix is checked, and a blank key passes.
    const missingPrefix = Array.from(properties.keys()).find(key => !key.startsWith(CUSTOM_PROPERTIES_PREFIX));
    if (missingPrefix !== undefined && !isNullOrWhiteSpace(missingPrefix)) {
        throw new Error(loc('ArtifactCustomPropertyInvalid', missingPrefix));
    }
    return Object.fromEntries(properties);
}

export function parseParallelCount(value: string | undefined, loc: Localize, report: (message: string) => void): number {
    const parsed = parseDotNetInt32(value);
    if (parsed === undefined) {
        throw new Error(loc('ParallelCountNotANumber'));
    }
    if (parsed < 1) {
        report(loc('UnexpectedParallelCount', value));
        return 1;
    }
    if (parsed > 128) {
        report(loc('UnexpectedParallelCount', value));
        return 128;
    }
    return parsed;
}
