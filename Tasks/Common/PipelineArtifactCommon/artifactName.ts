const InvalidNameCharacters = /[":<>|*?/\\\u0000-\u001f\u007f-\u009f]/;

/** Returns true when the name is a valid artifact name, using the rules of the previous task majors. */
export function isValidArtifactName(name: string | undefined): boolean {
    return !!name && name.replace(/^[. ]+|[. ]+$/g, "").length > 0 && !InvalidNameCharacters.test(name);
}

/** Throws the previous task majors' message when the name is not a valid artifact name. */
export function validateArtifactName(name: string): void {
    if (!isValidArtifactName(name)) {
        throw new Error(`Artifact name is not valid: ${name}. It cannot contain '\\', '/', '"', ':', '<', '>', '|', '*', '?', or control characters. ` +
            "It cannot be empty or consist entirely of dots or spaces.");
    }
}

/** Derives the default artifact name from System.JobIdentifier, as PublishPipelineArtifact@1 did. */
export function normalizeJobIdentifier(jobIdentifier: string | undefined): string {
    return (jobIdentifier ?? "").replace(/[^a-zA-Z0-9 - .]/g, "").split(".default").join("");
}
