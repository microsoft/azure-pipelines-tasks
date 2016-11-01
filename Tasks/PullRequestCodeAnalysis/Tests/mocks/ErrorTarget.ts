/**
 * A collection of places where an error can come from
 * 
 * @export
 * @enum {number}
 */
export enum ErrorTarget {
    none,
    getPullRequestIterations,
    getPullRequestIterationChanges,
    createThread,
    deleteComment,
    getThreads

}