// Jobs transition between states as follows:
// ------------------------------------------
// BEGINNING STATE: New
// New →            Locating, Streaming, Joined, Cut
// Locating →       Streaming, Joined, Cut
// Streaming →      Finishing
// Finishing →      Downloading, Queued, Done
// Downloading →    Done
// TERMINAL STATES: Done, Queued, Joined, Cut
export enum JobState {
    New,       // 0 - The job is yet to begin
    Locating,  // 1 - The job is being located
    Streaming, // 2 - The job is running and its console output is streaming
    Finishing, // 3 - The job has run and is "finishing"
    Done,      // 4 - The job has run and is done
    Joined,    // 5 - The job is considered complete because it has been joined to the execution of another matching job execution
    Queued,    // 6 - The job was queued and will not be tracked for completion (as specified by the "Capture..." task setting)
    Cut,       // 7 - The job was cut from execution by the pipeline
    Downloading// 8 - The job has run and its results are being downloaded (occurs when the TFS Plugin for Jenkins is installed)
}

export function checkStateTransitions (currentState: JobState, newState: JobState): boolean {
    let validStateChange: boolean = false;

    if (currentState !== newState) {
        if (currentState === JobState.New) {
            validStateChange = (newState === JobState.Locating || newState === JobState.Streaming || newState === JobState.Joined || newState === JobState.Cut);
        } else if (currentState === JobState.Locating) {
            validStateChange = (newState === JobState.Streaming || newState === JobState.Joined || newState === JobState.Cut);
        } else if (currentState === JobState.Streaming) {
            validStateChange = (newState === JobState.Finishing);
        } else if (currentState === JobState.Finishing) {
            validStateChange = (newState === JobState.Downloading || newState === JobState.Queued || newState === JobState.Done);
        } else if (currentState === JobState.Downloading) {
            validStateChange = (newState === JobState.Done);
        } else if (currentState === JobState.Done || currentState === JobState.Joined || currentState === JobState.Cut) {
            validStateChange = false; // these are terminal states
        }
    }

    return validStateChange;
}
