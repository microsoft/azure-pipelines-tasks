import * as tl from 'azure-pipelines-task-lib/task';

export function getProjectAndFeedIdFromInputParam(inputParam: string): any {
    const feedProject = tl.getInput(inputParam);
    return getProjectAndFeedIdFromInput(feedProject);
}

export function getProjectAndFeedIdFromInput(feedProject: string): any {
    let projectId = null;
    let feedId = feedProject;
    if(feedProject && feedProject.includes('/')) {
        const feedProjectParts = feedProject.split('/');
        projectId = feedProjectParts[0] || null;
        feedId = feedProjectParts[1];
    }

    return {
        feedId: feedId,
        projectId: projectId
    };
}