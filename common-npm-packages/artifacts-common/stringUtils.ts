export interface ProjectScopedFeed {
    feedId: string;
    projectId?: string;
}

/**
 * Separated feedId and projectId from a single string.
 * @param feedProject '/' separated feed and project string
 */
export function getProjectScopedFeed(feedProject: string): ProjectScopedFeed {
    let projectId = null;
    let feedId = feedProject;
    if (feedProject && feedProject.includes('/')) {
        const feedProjectParts = feedProject.split('/');
        projectId = feedProjectParts[0] || null;
        feedId = feedProjectParts[1];
    }

    return {
        feedId: feedId,
        projectId: projectId
    } as ProjectScopedFeed;
}