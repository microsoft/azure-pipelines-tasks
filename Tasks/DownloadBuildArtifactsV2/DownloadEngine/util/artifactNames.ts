const FORBIDDEN_CHARACTERS = /[\u0000-\u001f"<>|:*?\/\\]/;
const ONLY_DOTS_AND_SPACES = /^[. ]+$/;

/**
 * Whether the name of an artifact can safely be used as a folder name. The names of the artifacts of a build come from whoever created
 * them, and a name like ".." would point out of the download folder. The rules are the strict validation of the agent plugins: a name must
 * not be empty, must not consist only of dots and spaces, and must not contain control characters or any of \ / : * ? " < > |
 */
export function isValidArtifactName(name: string | null | undefined): boolean {
    if (typeof name !== 'string' || name.length === 0) {
        return false;
    }
    return !ONLY_DOTS_AND_SPACES.test(name) && !FORBIDDEN_CHARACTERS.test(name);
}

/** The text of the error for an invalid artifact name when no localized text is available. */
export function invalidArtifactNameMessage(name: string | null | undefined): string {
    return `Artifact name is not valid: ${name ?? ''}. It cannot contain '\\', /', "', ':', '<', '>', '|', '*', and '?'. It cannot be empty or consist entirely of dots or spaces.`;
}
