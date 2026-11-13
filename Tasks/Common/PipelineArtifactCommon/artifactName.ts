const InvalidNameCharacters = /[":<>|*?/\\\u0000-\u001f\u007f-\u009f]/;

/** Returns true when the name is a valid artifact name, using the rules of the previous task majors. */
export function isValidArtifactName(name: string | undefined): boolean {
    return !!name && name.replace(/^[. ]+|[. ]+$/g, "").length > 0 && !InvalidNameCharacters.test(name);
}

/** The previous task majors' message for an artifact name that is not valid. */
export function invalidArtifactNameMessage(name: string): string {
    return `Artifact name is not valid: ${name}. It cannot contain '\\', '/', '"', ':', '<', '>', '|', '*', '?', or control characters. ` +
        "It cannot be empty or consist entirely of dots or spaces.";
}

/** Throws the previous task majors' message when the name is not a valid artifact name. */
export function validateArtifactName(name: string): void {
    if (!isValidArtifactName(name)) {
        throw new Error(invalidArtifactNameMessage(name));
    }
}

/** Derives the default artifact name from System.JobIdentifier, as PublishPipelineArtifact@1 did. */
export function normalizeJobIdentifier(jobIdentifier: string | undefined): string {
    return (jobIdentifier ?? "").replace(/[^a-zA-Z0-9 - .]/g, "").split(".default").join("");
}
