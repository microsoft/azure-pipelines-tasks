import { IGitApi } from 'vso-node-api/GitApi';
import * as GitInterfaces from 'vso-node-api/interfaces/GitInterfaces';
import {IdentityRef }from 'vso-node-api/interfaces/common/VSSInterfaces';
import {ErrorTarget} from './ErrorTarget';
import { PrcaService} from '../../PRCA/PrcaService';
import { Message } from '../../PRCA/Message';
import * as chai from 'chai';

/* tslint:disable:max-line-length */



/**
 * Mock implementation of IGitApi
 * 
 * @export
 * @class ConfigurableGitApi
 */
export class ConfigurableGitApi implements IGitApi {

    /* --- Test Helpers ---  */

    private currentThreadId = 1;
    private currentCommentId = 1;
    private errorTarget: ErrorTarget = ErrorTarget.none;

    private iterations: GitInterfaces.GitPullRequestIteration[] = [];
    private threads: GitInterfaces.GitPullRequestCommentThread[] = [];

    private iterationChanges: Map<number, GitInterfaces.GitPullRequestIterationChanges>
    = new Map<number, GitInterfaces.GitPullRequestIterationChanges>();

    public static ExpectedExceptionText = 'A test pre-confgured exception was thrown';
    /**
     * Configure the mock to throw an exception when calling the method described by the error target
     * 
     * @param {ErrorTarget} target
     * 
     * @memberOf ConfigurableGitApi
     */
    public configureException(target: ErrorTarget) {
        this.errorTarget = target;
    }

    /**
     * Configure the response of getPullRequestIterations
     * 
     * @param {number[]} iterationIds
     * 
     * @memberOf ConfigurableGitApi
     */
    public configurePRIterations(iterationIds: number[]) {
        if (iterationIds.sort((a, b) => { return a - b; })[0] !== 1) {
            throw new Error('Test setup error: the lowest iteration should always be 1');
        }

        this.iterations = iterationIds.map(iterationId => {
            return {
                id: iterationId,
            } as GitInterfaces.GitPullRequestIteration;
        });
    }

    /**
     * 
     * 
     * @param {number} iterationId
     * @param {string[]} filesChanged
     * 
     * @memberOf ConfigurableGitApi
     */
    public configurePrIterationChanges(iterationId: number, filesChanged: string[]) {

        var changeObject = this.createItertionChanges(filesChanged);
        this.iterationChanges.set(iterationId, changeObject);
    }

    public get ExistingThreads(): GitInterfaces.GitPullRequestCommentThread[] {
        return this.threads;
    }
    public set ExistingThreads(threads: GitInterfaces.GitPullRequestCommentThread[]) {
        this.threads = threads;
    }

    /* --- IGitApi methods used by this module ---  */

    public getPullRequestIterations(
        repositoryId: string,
        pullRequestId: number,
        project?: string,
        includeCommits?: boolean): Promise<GitInterfaces.GitPullRequestIteration[]> {

        if (this.errorTarget === ErrorTarget.getPullRequestIterations) {
            throw new Error(ConfigurableGitApi.ExpectedExceptionText);
        }

        if (project || includeCommits) {
            throw new Error('Test issue: Optional parameters are not supported by the mock');
        }

        return Promise.resolve(this.iterations);
    }

    /**
     * Remark: this returns all the iteration changes that have occured UP UNTIL the given iteration id
     * E.g. it 1 -> change f1
     *      it 2 -> change f2
     * 
     * getPullRequestIterationChanges(1) --> returns f1
     * getPullRequestIterationChanges(2) --> returns f1 and f2
     * 
     * @memberOf ConfigurableGitApi
     */
    public getPullRequestIterationChanges(
        repositoryId: string,
        pullRequestId: number,
        iterationId: number,
        project?: string,
        top?: number,
        skip?: number,
        compareTo?: number): Promise<GitInterfaces.GitPullRequestIterationChanges> {

        if (this.errorTarget === ErrorTarget.getPullRequestIterationChanges) {
            throw new Error(ConfigurableGitApi.ExpectedExceptionText);
        }

        if (compareTo || project || top || skip) {
            throw new Error('Test issue: Optional parameters are not supported by the mock');
        }

        //let files: string[] = [];
        let fileSet: Set<string> = new Set<string>();

        this.iterationChanges.forEach((value: GitInterfaces.GitPullRequestIterationChanges, key: number) => {
            if (key <= iterationId) {
                value.changeEntries.forEach(ce => fileSet.add(ce.item.path));
            }
        });

        return Promise.resolve(this.createItertionChanges(Array.from(fileSet)));
    }

    public createThread(
        commentThread: GitInterfaces.GitPullRequestCommentThread,
        repositoryId: string,
        pullRequestId: number,
        project?: string): Promise<GitInterfaces.GitPullRequestCommentThread> {

        if (this.errorTarget === ErrorTarget.createThread) {
            throw new Error(ConfigurableGitApi.ExpectedExceptionText);
        }

        if (project) {
            throw new Error('Test issue: Optional parameters are not supported by the mock');
        }

        if (commentThread.properties[PrcaService.PrcaCommentDescriptor].value === 1) {
            commentThread.properties[PrcaService.PrcaCommentDescriptor] = {
                $type: 'System.Int32',
                $value: 1
            };
        }

        commentThread.id = this.currentThreadId;
        this.currentThreadId += 1;
        commentThread.isDeleted = false;

        commentThread.comments.forEach(c => {
            c.id = this.currentCommentId;
            this.currentCommentId += 1;
            c.isDeleted = false;
        });

        this.threads.push(commentThread);

        return Promise.resolve(commentThread);
    }

    public deleteComment(
        repositoryId: string,
        pullRequestId: number,
        threadId: number,
        commentId: number,
        project?: string): Promise<void> {


        if (project) {
            throw new Error('Test issue: Optional parameters are not supported by the mock');
        }

        if (this.errorTarget === ErrorTarget.deleteComment) {
            throw new Error(ConfigurableGitApi.ExpectedExceptionText);
        }

        var thread = this.threads.find(t => t.id === threadId);
        if (!thread) {
            throw `Could not find thread with id ${thread.id}`;
        }

        var comment = thread.comments.find(c => c.id === commentId);

        if (!comment) {
            throw `Could not find the comment with id ${comment.id}`;
        }

        if (comment.isDeleted) {
            throw 'You should not delete an already deleted comment';
        }
        comment.isDeleted = true;

        // mark the thread as deleted if all its comments are deleted
        if (thread.comments.filter(c => !c.isDeleted).length === 0) {
            thread.isDeleted = true;
        }
        return;
    }

    public getThreads(
        repositoryId: string,
        pullRequestId: number,
        project?: string,
        iteration?: number,
        baseIteration?: number): Promise<GitInterfaces.GitPullRequestCommentThread[]> {

        if (this.errorTarget === ErrorTarget.getThreads) {
            throw new Error(ConfigurableGitApi.ExpectedExceptionText);
        }

        if (project || baseIteration) {
            throw new Error('Test issue: Optional parameters are not supported by the mock');
        }

        return Promise.resolve(this.threads);
    }

    private createItertionChanges(filesChanged: string[]) {
        let changes = filesChanged.map(fileChanged => {
            return {
                item: { path: fileChanged },
            } as GitInterfaces.GitPullRequestChange;
        });

        let changeObject = {
            changeEntries: changes
        } as GitInterfaces.GitPullRequestIterationChanges;

        return changeObject;
    }

    // Verification methods

    public static validateThreadAgainstMessge(
        messageSource: Message,
        thread: GitInterfaces.GitPullRequestCommentThread,
        latestIterationId: number) {

        var prcaPropertyName = PrcaService.PrcaCommentDescriptor;
        chai.expect(thread.comments).to.have.length(1, 'Expecting a single comment on a thread');
        chai.expect(thread.comments[0].commentType).to.equal(GitInterfaces.CommentType.Text, 'Expected the comment to be of type text');
        chai.expect(thread.comments[0].isDeleted).to.equal(false, 'Expecting the comment to not be marked as deleted');
        chai.expect(thread.isDeleted).to.equal(false, 'Expecting the comment to not be marked as deleted');
        chai.expect(thread.properties[prcaPropertyName].$value)
            .to.equal(1, 'Expecting the thread to be marked by PRCA');
        chai.expect(thread.pullRequestThreadContext.changeTrackingId).to.equal(0, 'Not expecting a change tracking id to be set');
        chai.expect(thread.pullRequestThreadContext.trackingCriteria).to.equal(null, 'Not expecting a tracking criteria to be set');
        chai.expect(thread.pullRequestThreadContext.iterationContext.firstComparingIteration)
            .to.equal(1, 'Expecting the comment to be posted relative to the first iteration');
        chai.expect(thread.status).to.equal(GitInterfaces.CommentThreadStatus.Active, 'Expecting only active threads');

        chai.expect(thread.threadContext.leftFileEnd).to.equal(null, 'Threads should only be posted on the right side');
        chai.expect(thread.threadContext.leftFileStart).to.equal(null, 'Threads should only be posted on the right side');
        chai.expect(thread.threadContext.rightFileStart.offset).to.equal(1, 'Invalid offset');
        chai.expect(thread.threadContext.rightFileEnd.offset).to.equal(1, 'Invalid offset');

        chai.expect(thread.threadContext.filePath).to.equal(messageSource.file, 'Invalid file path');
        chai.expect(thread.comments[0].content).to.equal(messageSource.content, 'The message content should be set as comment content');
        chai.expect(thread.threadContext.rightFileStart.line).to.equal(messageSource.line, 'Invalid line');
        chai.expect(thread.threadContext.rightFileEnd.line).to.equal(messageSource.line, 'Invalid line');

        chai.expect(thread.pullRequestThreadContext.iterationContext.secondComparingIteration)
            .to.equal(latestIterationId, 'Expecting the comment to be posted against the latest iteration');

    }

    public static validateThreadsAreDeleted(threads: GitInterfaces.GitPullRequestCommentThread[]) {

        chai.expect(threads.filter(th => !th.isDeleted)).to.have.length(0, 'All the threads should be marked as deleted');
        threads.forEach((th) => {
            chai.expect(th.comments.filter(c => !c.isDeleted)).to.have.length(0, 'All the comments should be marked as deleted');
        });
    }

    public static validateThreadIsNotDeleted(thread: GitInterfaces.GitPullRequestCommentThread) {

        chai.assert.isNotNull(thread, 'Thread is null');
        chai.expect(thread.isDeleted).to.equal(false, 'The thread should not be deleted');
        thread.comments.forEach(c => chai.expect(c.isDeleted).to.equal(false, 'Comments should not be deleted'));
    }

    //public static GetThreadsById(threads: GitInterfaces.GitPullRequestCommentThread[], )

    // The rest of the interface - not used by the mock 
    public baseUrl: string;
    public userAgent: string;
    public httpClient: any;
    public restClient: any;
    public vsoClient: any;
    public setUserAgent(userAgent: string): void { throw new Error('Not Implemented'); }
    public connect(): Promise<any> { throw new Error('Not Implemented'); }


    public getBlob(repositoryId: string, sha1: string, project?: string, download?: boolean, fileName?: string): Promise<GitInterfaces.GitBlobRef> { throw new Error('Not Implemented'); }
    public getBlobContent(repositoryId: string, sha1: string, project?: string, download?: boolean, fileName?: string): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getBlobsZip(blobIds: string[], repositoryId: string, project?: string, filename?: string): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getBlobZip(repositoryId: string, sha1: string, project?: string, download?: boolean, fileName?: string): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getBranch(repositoryId: string, name: string, project?: string, baseVersionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<GitInterfaces.GitBranchStats> { throw new Error('Not Implemented'); }
    public getBranches(repositoryId: string, project?: string, baseVersionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<GitInterfaces.GitBranchStats[]> { throw new Error('Not Implemented'); }
    public getBranchStatsBatch(searchCriteria: GitInterfaces.GitQueryBranchStatsCriteria, repositoryId: string, project?: string): Promise<GitInterfaces.GitBranchStats[]> { throw new Error('Not Implemented'); }
    public getChanges(commitId: string, repositoryId: string, project?: string, top?: number, skip?: number): Promise<GitInterfaces.GitCommitChanges> { throw new Error('Not Implemented'); }
    public createCherryPick(cherryPickToCreate: GitInterfaces.GitAsyncRefOperationParameters, project: string, repositoryId: string): Promise<GitInterfaces.GitCherryPick> { throw new Error('Not Implemented'); }
    public getCherryPick(project: string, cherryPickId: number, repositoryId: string): Promise<GitInterfaces.GitCherryPick> { throw new Error('Not Implemented'); }
    public getCherryPickForRefName(project: string, repositoryId: string, refName: string): Promise<GitInterfaces.GitCherryPick> { throw new Error('Not Implemented'); }
    public getCommit(commitId: string, repositoryId: string, project?: string, changeCount?: number): Promise<GitInterfaces.GitCommit> { throw new Error('Not Implemented'); }
    public getCommits(repositoryId: string, searchCriteria: GitInterfaces.GitQueryCommitsCriteria, project?: string, skip?: number, top?: number): Promise<GitInterfaces.GitCommitRef[]> { throw new Error('Not Implemented'); }
    public getPushCommits(repositoryId: string, pushId: number, project?: string, top?: number, skip?: number, includeLinks?: boolean): Promise<GitInterfaces.GitCommitRef[]> { throw new Error('Not Implemented'); }
    public getCommitsBatch(searchCriteria: GitInterfaces.GitQueryCommitsCriteria, repositoryId: string, project?: string, skip?: number, top?: number, includeStatuses?: boolean): Promise<GitInterfaces.GitCommitRef[]> { throw new Error('Not Implemented'); }
    public getDeletedRepositories(project: string): Promise<GitInterfaces.GitDeletedRepository[]> { throw new Error('Not Implemented'); }
    public createImportRequest(importRequest: GitInterfaces.GitImportRequest, project: string, repositoryId: string, validateParameters?: boolean): Promise<GitInterfaces.GitImportRequest> { throw new Error('Not Implemented'); }
    public getImportRequest(project: string, repositoryId: string, importRequestId: number): Promise<GitInterfaces.GitImportRequest> { throw new Error('Not Implemented'); }
    public queryImportRequests(project: string, repositoryId: string, includeAbandoned?: boolean): Promise<GitInterfaces.GitImportRequest[]> { throw new Error('Not Implemented'); }
    public updateImportRequest(importRequestToUpdate: GitInterfaces.GitImportRequest, project: string, repositoryId: string, importRequestId: number): Promise<GitInterfaces.GitImportRequest> { throw new Error('Not Implemented'); }
    public getItem(repositoryId: string, path: string, project?: string, scopePath?: string, recursionLevel?: GitInterfaces.VersionControlRecursionType, includeContentMetadata?: boolean, latestProcessedChange?: boolean, download?: boolean, versionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<GitInterfaces.GitItem> { throw new Error('Not Implemented'); }
    public getItemContent(repositoryId: string, path: string, project?: string, scopePath?: string, recursionLevel?: GitInterfaces.VersionControlRecursionType, includeContentMetadata?: boolean, latestProcessedChange?: boolean, download?: boolean, versionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getItems(repositoryId: string, project?: string, scopePath?: string, recursionLevel?: GitInterfaces.VersionControlRecursionType, includeContentMetadata?: boolean, latestProcessedChange?: boolean, download?: boolean, includeLinks?: boolean, versionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<GitInterfaces.GitItem[]> { throw new Error('Not Implemented'); }
    public getItemText(repositoryId: string, path: string, project?: string, scopePath?: string, recursionLevel?: GitInterfaces.VersionControlRecursionType, includeContentMetadata?: boolean, latestProcessedChange?: boolean, download?: boolean, versionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getItemZip(repositoryId: string, path: string, project?: string, scopePath?: string, recursionLevel?: GitInterfaces.VersionControlRecursionType, includeContentMetadata?: boolean, latestProcessedChange?: boolean, download?: boolean, versionDescriptor?: GitInterfaces.GitVersionDescriptor): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
    public getItemsBatch(requestData: GitInterfaces.GitItemRequestData, repositoryId: string, project?: string): Promise<GitInterfaces.GitItem[][]> { throw new Error('Not Implemented'); }
    public getPullRequestIterationCommits(repositoryId: string, pullRequestId: number, iterationId: number, project?: string): Promise<GitInterfaces.GitCommitRef[]> { throw new Error('Not Implemented'); }
    public getPullRequestCommits(repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.GitCommitRef[]> { throw new Error('Not Implemented'); }
    public getPullRequestConflict(repositoryId: string, pullRequestId: number, conflictId: number, project?: string): Promise<GitInterfaces.GitConflict> { throw new Error('Not Implemented'); }
    public getPullRequestConflicts(repositoryId: string, pullRequestId: number, project?: string, skip?: number, top?: number, includeObsolete?: boolean): Promise<GitInterfaces.GitConflict[]> { throw new Error('Not Implemented'); }
    public updatePullRequestConflict(conflict: GitInterfaces.GitConflict, repositoryId: string, pullRequestId: number, conflictId: number, project?: string): Promise<GitInterfaces.GitConflict> { throw new Error('Not Implemented'); }
    public getPullRequestIteration(repositoryId: string, pullRequestId: number, iterationId: number, project?: string): Promise<GitInterfaces.GitPullRequestIteration> { throw new Error('Not Implemented'); }
    public getPullRequestQuery(queries: GitInterfaces.GitPullRequestQuery, repositoryId: string, project?: string): Promise<GitInterfaces.GitPullRequestQuery> { throw new Error('Not Implemented'); }
    public createPullRequestReviewer(reviewer: GitInterfaces.IdentityRefWithVote, repositoryId: string, pullRequestId: number, reviewerId: string, project?: string): Promise<GitInterfaces.IdentityRefWithVote> { throw new Error('Not Implemented'); }
    public createPullRequestReviewers(reviewers: IdentityRef[], repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.IdentityRefWithVote[]> { throw new Error('Not Implemented'); }
    public deletePullRequestReviewer(repositoryId: string, pullRequestId: number, reviewerId: string, project?: string): Promise<void> { throw new Error('Not Implemented'); }
    public getPullRequestReviewer(repositoryId: string, pullRequestId: number, reviewerId: string, project?: string): Promise<GitInterfaces.IdentityRefWithVote> { throw new Error('Not Implemented'); }
    public getPullRequestReviewers(repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.IdentityRefWithVote[]> { throw new Error('Not Implemented'); }
    public getPullRequestById(pullRequestId: number): Promise<GitInterfaces.GitPullRequest> { throw new Error('Not Implemented'); }
    public getPullRequestsByProject(project: string, searchCriteria: GitInterfaces.GitPullRequestSearchCriteria, maxCommentLength?: number, skip?: number, top?: number): Promise<GitInterfaces.GitPullRequest[]> { throw new Error('Not Implemented'); }
    public createPullRequest(gitPullRequestToCreate: GitInterfaces.GitPullRequest, repositoryId: string, project?: string): Promise<GitInterfaces.GitPullRequest> { throw new Error('Not Implemented'); }
    public getPullRequest(repositoryId: string, pullRequestId: number, project?: string, maxCommentLength?: number, skip?: number, top?: number, includeCommits?: boolean, includeWorkItemRefs?: boolean): Promise<GitInterfaces.GitPullRequest> { throw new Error('Not Implemented'); }
    public getPullRequests(repositoryId: string, searchCriteria: GitInterfaces.GitPullRequestSearchCriteria, project?: string, maxCommentLength?: number, skip?: number, top?: number): Promise<GitInterfaces.GitPullRequest[]> { throw new Error('Not Implemented'); }
    public updatePullRequest(gitPullRequestToUpdate: GitInterfaces.GitPullRequest, repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.GitPullRequest> { throw new Error('Not Implemented'); }
    public createPullRequestIterationStatus(status: GitInterfaces.GitPullRequestStatus, repositoryId: string, pullRequestId: number, iterationId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus> { throw new Error('Not Implemented'); }
    public getPullRequestIterationStatus(repositoryId: string, pullRequestId: number, iterationId: number, statusId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus> { throw new Error('Not Implemented'); }
    public getPullRequestIterationStatuses(repositoryId: string, pullRequestId: number, iterationId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus[]> { throw new Error('Not Implemented'); }
    public createPullRequestStatus(status: GitInterfaces.GitPullRequestStatus, repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus> { throw new Error('Not Implemented'); }
    public getPullRequestStatus(repositoryId: string, pullRequestId: number, statusId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus> { throw new Error('Not Implemented'); }
    public getPullRequestStatuses(repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.GitPullRequestStatus[]> { throw new Error('Not Implemented'); }
    public createComment(comment: GitInterfaces.Comment, repositoryId: string, pullRequestId: number, threadId: number, project?: string): Promise<GitInterfaces.Comment> { throw new Error('Not Implemented'); }
    public getComment(repositoryId: string, pullRequestId: number, threadId: number, commentId: number, project?: string): Promise<GitInterfaces.Comment> { throw new Error('Not Implemented'); }
    public getComments(repositoryId: string, pullRequestId: number, threadId: number, project?: string): Promise<GitInterfaces.Comment[]> { throw new Error('Not Implemented'); }
    public updateComment(comment: GitInterfaces.Comment, repositoryId: string, pullRequestId: number, threadId: number, commentId: number, project?: string): Promise<GitInterfaces.Comment> { throw new Error('Not Implemented'); }
    public getPullRequestThread(repositoryId: string, pullRequestId: number, threadId: number, project?: string, iteration?: number, baseIteration?: number): Promise<GitInterfaces.GitPullRequestCommentThread> { throw new Error('Not Implemented'); }
    public updateThread(commentThread: GitInterfaces.GitPullRequestCommentThread, repositoryId: string, pullRequestId: number, threadId: number, project?: string): Promise<GitInterfaces.GitPullRequestCommentThread> { throw new Error('Not Implemented'); }
    public getPullRequestWorkItems(repositoryId: string, pullRequestId: number, project?: string): Promise<GitInterfaces.AssociatedWorkItem[]> { throw new Error('Not Implemented'); }
    public createPush(push: GitInterfaces.GitPush, repositoryId: string, project?: string): Promise<GitInterfaces.GitPush> { throw new Error('Not Implemented'); }
    public getPush(repositoryId: string, pushId: number, project?: string, includeCommits?: number, includeRefUpdates?: boolean): Promise<GitInterfaces.GitPush> { throw new Error('Not Implemented'); }
    public getPushes(repositoryId: string, project?: string, skip?: number, top?: number, searchCriteria?: GitInterfaces.GitPushSearchCriteria): Promise<GitInterfaces.GitPush[]> { throw new Error('Not Implemented'); }
    public createRefLockRequest(refLockRequest: GitInterfaces.GitRefLockRequest, project: string, repositoryId: string): Promise<void> { throw new Error('Not Implemented'); }
    public getRefs(repositoryId: string, project?: string, filter?: string, includeLinks?: boolean, latestStatusesOnly?: boolean): Promise<GitInterfaces.GitRef[]> { throw new Error('Not Implemented'); }
    public updateRefs(refUpdates: GitInterfaces.GitRefUpdate[], repositoryId: string, project?: string, projectId?: string): Promise<GitInterfaces.GitRefUpdateResult[]> { throw new Error('Not Implemented'); }
    public createFavorite(favorite: GitInterfaces.GitRefFavorite, project: string): Promise<GitInterfaces.GitRefFavorite> { throw new Error('Not Implemented'); }
    public deleteRefFavorite(project: string, favoriteId: number): Promise<void> { throw new Error('Not Implemented'); }
    public getRefFavorite(project: string, favoriteId: number): Promise<GitInterfaces.GitRefFavorite> { throw new Error('Not Implemented'); }
    public getRefFavorites(project: string, repositoryId?: string, identityId?: string): Promise<GitInterfaces.GitRefFavorite[]> { throw new Error('Not Implemented'); }
    public createRepository(gitRepositoryToCreate: GitInterfaces.GitRepository, project?: string): Promise<GitInterfaces.GitRepository> { throw new Error('Not Implemented'); }
    public deleteRepository(repositoryId: string, project?: string): Promise<void> { throw new Error('Not Implemented'); }
    public getRepositories(project?: string, includeLinks?: boolean, includeAllUrls?: boolean): Promise<GitInterfaces.GitRepository[]> { throw new Error('Not Implemented'); }
    public getRepository(repositoryId: string, project?: string): Promise<GitInterfaces.GitRepository> { throw new Error('Not Implemented'); }
    public updateRepository(newRepositoryInfo: GitInterfaces.GitRepository, repositoryId: string, project?: string): Promise<GitInterfaces.GitRepository> { throw new Error('Not Implemented'); }
    public createRevert(revertToCreate: GitInterfaces.GitAsyncRefOperationParameters, project: string, repositoryId: string): Promise<GitInterfaces.GitRevert> { throw new Error('Not Implemented'); }
    public getRevert(project: string, revertId: number, repositoryId: string): Promise<GitInterfaces.GitRevert> { throw new Error('Not Implemented'); }
    public getRevertForRefName(project: string, repositoryId: string, refName: string): Promise<GitInterfaces.GitRevert> { throw new Error('Not Implemented'); }
    public createCommitStatus(gitCommitStatusToCreate: GitInterfaces.GitStatus, commitId: string, repositoryId: string, project?: string): Promise<GitInterfaces.GitStatus> { throw new Error('Not Implemented'); }
    public getStatuses(commitId: string, repositoryId: string, project?: string, top?: number, skip?: number, latestOnly?: boolean): Promise<GitInterfaces.GitStatus[]> { throw new Error('Not Implemented'); }
    public getSuggestions(repositoryId: string, project?: string): Promise<GitInterfaces.GitSuggestion[]> { throw new Error('Not Implemented'); }
    public getTree(repositoryId: string, sha1: string, project?: string, projectId?: string, recursive?: boolean, fileName?: string): Promise<GitInterfaces.GitTreeRef> { throw new Error('Not Implemented'); }
    public getTreeZip(repositoryId: string, sha1: string, project?: string, projectId?: string, recursive?: boolean, fileName?: string): Promise<NodeJS.ReadableStream> { throw new Error('Not Implemented'); }
}

