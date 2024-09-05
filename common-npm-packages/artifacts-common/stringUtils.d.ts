export interface ProjectScopedFeed {
    feedId: string;
    projectId?: string;
}
/**
 * Separated feedId and projectId from a single string.
 * @param feedProject '/' separated feed and project string
 */
export declare function getProjectScopedFeed(feedProject: string): ProjectScopedFeed;
