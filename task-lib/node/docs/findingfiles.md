# Finding Files

## Task UI

When designing a task glob input experience, one of the following UI layout patterns is generally appropriate:

1. Use only a `filePath` input only, when the following conditions are true:
 - The task is designed to resolve a single file most of the time.
 - AND adding a second instance of the task is acceptable for scenarios that require resolving multiple files.
   - Note, although multiple files can be resolved from a single match pattern, some scenarios may be too complex for a single pattern.

2. Use a `filePath` input to specify a root directory or default-root directory, followed by a `multiLine` input for match patterns, when the following conditions are true:
 - The task is designed to resolve multiple files/directories most of the time.
 - OR the task is designed to resolve a single input most of the time, but adding a second instance of the task is unacceptable for scenarios that require resolving multiple files.
   - Again, although multiple files can be resolved from a single match pattern, some scenarios may be too complex for a single pattern.

## Task Lib Functions

The above UI experiences translate to one of the following consumption patterns of the [task lib API](azure-pipelines-task-lib.md):

1. `filePath` input only
 - Call [findMatch](azure-pipelines-task-lib.md#taskfindMatch) and pass the filePath input as the pattern.

2. `filePath` input to specify a root directory, followed by a `multiLine` input for match patterns.
 - Call [find](azure-pipelines-task-lib.md#taskfind) to recursively find all paths under the specified root directory.
 - Then call [match](azure-pipelines-task-lib.md#taskmatch) to filter the results using the multiLine input as the patterns.

3. `filePath` input to specify a *default* root directory to root any unrooted patterns, followed by a `multiLine` input for match patterns.
 - Call [findMatch](azure-pipelines-task-lib.md#taskfindMatch) and pass the filePath input as the defaultRoot and the multiLine input as the patterns.

Note, use [getDelimitedInput](azure-pipelines-task-lib.md#taskgetDelimitedInput) to split a multiLine input using the delimiter `'\n'`.

## Recommended FindOptions and MatchOptions

The find and match functions apply the below defaults when the options parameters are not specified.

### FindOptions
The recommended defaults for FindOptions are below. Following soft links is generally appropriate unless deleting files.

```javascript
<FindOptions>{
    followSpecifiedSymbolicLink = true,
    followSymbolicLinks = true
}
```

### MatchOptions
The recommended defaults for MatchOptions are below. Supported pattern syntax is discussed further below in detail.

```javascript
<MatchOptions>{
    debug = false,
    nobrace = true,     // brace expansion off - brace expansion cannot be escaped on Windows
    noglobstar = false, // globstar on
    dot = true,         // make * match files that start with . without requiring an additional
                        // pattern .* to match files that start with .
    noext = false,      // extended globbing on
    nocase = process.platform == 'win32' // case insensitive on Windows, otherwise case sensitive
    nonull = false,
    matchBase = false,
    nocomment = false,  // support comments
    nonegate = false,   // support negate pattern
    flipNegate = false
}
```

## Pattern Syntax

### Basic globbing
`*`, `?`, and `[]` (e.g. `[abc]` or `[a-z]`)

### Globstar
`**` recursive wildcard. For example, `/hello/**/*` matches all descendants of `/hello`.

### Extended Globbing
* `?(hello|world)` - matches `hello` or `world` zero or one times
* `*(hello|world)` - zero or more occurrences
* `+(hello|world)` - one or more occurrences
* `@(hello|world)` - exactly once
* `!(hello|world)` - not `hello` or `world`

Note, extended globs cannot span directory separators. For example, `+(hello/world|other)` is not valid.

### Brace Expansion
It is recommended to turn off the brace expansion option when using `match` or `findMatch`. Brace expansion is turned off in the defaults that are applied when the MatchOptions parameter is not specified. On Windows, brace expansion cannot be escaped. On Linux/OSX, `\` can be used to escape braces.

Brace expansion is unique since it can include directory separators. The pattern `/my/{solution1,legacy/solution2}` effectively expands into two patterns `/my/solution1` and `/my/legacy/solution2`.

### Comments
Patterns that begin with `#` are treated as comments.

### Exclude patterns
Leading `!` changes the meaning of an include pattern to exclude. The lib functions `match` and `findMatch` support interleaved exclude patterns.

Note, multiple leading `!` flips the meaning.

### Escaping
Wrapping special characters in `[]` can be used to escape literal glob characters in a file name. For example the literal file name `hello[a-z]` can be escaped as `hello[[]a-z]`.
