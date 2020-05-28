// Jobs transition between states as follows:
// ------------------------------------------
// BEGINNING STATE: New
// New →            Locating, Streaming, Joined, Cut
// Locating →       Streaming, Joined, Cut
// Streaming →      Finishing
// Finishing →      Downloading, Queued, Done, Killed
// Downloading →    Done
// TERMINAL STATES: Done, Queued, Joined, Cut
export enum JobState {
    New,         // 0 - The job is yet to begin
    Locating,    // 1 - The job is being located
    Streaming,   // 2 - The job is running and its console output is streaming
    Finishing,   // 3 - The job has run and is "finishing"
    Done,        // 4 - The job has run and is done
    Joined,      // 5 - The job is considered complete because it has been joined to the execution of another matching job execution
    Queued,      // 6 - The job was queued and will not be tracked for completion (as specified by the "Capture..." task setting)
    Cut,         // 7 - The job was cut from execution by the pipeline
    Downloading, // 8 - The job has run and its results are being downloaded (occurs when the TFS Plugin for Jenkins is installed)
    Killed,      // 9 - The job has run and while "finishing" Jenkins provided unexpected answer via an HTTP request
}

export function checkStateTransitions (currentState: JobState, newState: JobState): boolean {
    let isValidTransition: boolean = false;
    let possibleStates: Array<JobState> = [];

    switch (currentState) {
        case (JobState.New): {
            possibleStates = [JobState.Locating, JobState.Streaming, JobState.Joined, JobState.Cut];
            break;
        }

        case (JobState.Locating): {
            possibleStates = [JobState.Streaming, JobState.Joined, JobState.Cut];
            break;
        }

        case (JobState.Streaming): {
            possibleStates = [JobState.Finishing];
            break;
        }

        case (JobState.Finishing): {
            possibleStates = [JobState.Downloading, JobState.Queued, JobState.Done, JobState.Killed];
            break;
        }

        case (JobState.Downloading): {
            possibleStates = [JobState.Done];
            break;
        }

        case (JobState.Done):
        case (JobState.Joined):
        case (JobState.Queued):
        case (JobState.Cut):
        case (JobState.Killed): {
            break;
        }

        default: {
            throw new Error(`No transition rules defined for the ${currentState} state!`);
        }
    }

    if (possibleStates.length > 0) {
        isValidTransition = (possibleStates.indexOf(newState) !== -1);
    }

    return isValidTransition;
}
