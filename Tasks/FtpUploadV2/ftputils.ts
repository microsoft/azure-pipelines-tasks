import * as tl from "azure-pipelines-task-lib/task";
import * as path from "path";

/**
 * Returns true when {candidate} (an already posix-normalized path produced by joining it
 * under {normalizedRoot}) still resolves inside {normalizedRoot}.
 */
function isUnderRoot(normalizedRoot: string, candidate: string): boolean {
    if (candidate === normalizedRoot) {
        return true;
    }

    if (normalizedRoot === "." || normalizedRoot === "./") {
        return candidate !== ".." && !candidate.startsWith("../");
    }

    const prefix: string = normalizedRoot.endsWith("/") ? normalizedRoot : `${normalizedRoot}/`;
    return candidate.startsWith(prefix);
}

/**
 * Joins {relativePath} under {remotePath} and returns the remote FTP path to upload to.
 * Throws if the result would resolve outside {remotePath}.
 *
 * A relative path containing a literal backslash is only ever a real path separator when the
 * agent itself uses backslash separators (Windows). On any other agent OS, a backslash inside
 * the computed relative path can only be part of an actual file name - which is how a ".."
 * traversal disguised as a single, Windows-illegal filename is smuggled in by a source
 * contributor. Reject it outright instead of translating it into a real separator later (as the
 * unconditional "\\" -> "/" conversion in ftpuploadtask.ts does), since translating it would
 * still let the join escape remotePath.
 */
export function resolveRemoteFilePath(remotePath: string, relativePath: string): string {
    if (process.platform !== "win32" && relativePath.includes("\\")) {
        throw new Error(tl.loc("RemoteFileContainsBackslash", relativePath));
    }

    const posixRelativePath: string = process.platform === "win32" ? relativePath.replace(/\\/g, "/") : relativePath;
    const normalizedRemotePath: string = path.posix.normalize(remotePath);
    const remoteFile: string = path.posix.join(remotePath, posixRelativePath);

    if (!isUnderRoot(normalizedRemotePath, remoteFile)) {
        throw new Error(tl.loc("RemoteFileEscapesRemotePath", relativePath, remotePath));
    }

    return remoteFile;
}
