// Probe script invoked as a child process by L0.ts.
//
// This script requires the real (non-mocked) `azure-pipelines-task-lib`
// transitively via `../logging`. If `logging` (or any of its dependents)
// invokes `tl.loc()` at module scope -- before `tl.setResourcePath()` runs --
// task-lib emits a "Resource file haven't been set" warning to stdout. The
// parent test inspects stdout to detect the regression.
//
// The probe deliberately does NOT call `tl.setResourcePath()` so any
// module-scope localization attempt is observable.

require('../logging');
