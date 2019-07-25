# Making tasks YAML-friendly

The task model was designed thoughtfully, and it shows.
It has evolved to keep up with growing needs: task lifecycle (preview and deprecation), distribution on the Marketplace, and of course, the introduction of YAML pipelines.
The last one requires some care on the part of the task author to create an ideal experience.
The community has asked for a guide to thinking about "YAMLizing" their tasks.
This doc attempts to capture what we've learned as we've evolved our in-box tasks to support YAML.

## Observation

In a classic editor pipeline, the editing UI allows for conditional logic, rich input types, and in-situ error checking.
A YAML editor could hypothetically offer the same, but we made a choice that the YAML representation would be human editable.
Therefore, over-reliance on editor features is an anti-pattern.
Nearly all of the advice here flows from this fundamental difference.

As it turns out, simplifying the "shape" of a task's inputs doesn't really harm the classic editor experience.
In fact, the usefulness of some in-box tasks has been hindered by having a large number of inputs even in the classic editor.
The move towards single- or reduced-use-case tasks benefits composibility and understability regardless of the pipeline editor used.

### First ask: should this even be a task?

- Tasks which provide little value above a script aren't valuable.
In particular, those that are merely wrappers around a multi-verb command line are an anti-pattern.
Example: we would not ship a task called `Git` with an input `Action` whose values are `clone`, `checkout`, and `push`.
Customers should be advised to simply add a script step which directly called `git clone` or whatever.
(We've done this before, and we've always regretted it.)
- Tasks offer the ability to inject pre- and post-steps on the job.
Also, they allow for the download of secure files and service connections when used as inputs.
Therefore, tasks can occasionally be the only mechanism to accomplish something: for instance, downloading and then cleaning up after use of a secure resource.
- Tasks which can automate the environment setup a developer would perform on their local machine are great.
For instance, setting up SSH keys is typically a one-time thing on a dev machine, but has to be repeated in each CI run.
Also, SSH private keys should be stored as secure files, which are only available as task inputs.
Both of those factors weigh in favor of SSH setup being a task rather than a script.

## Advice for new tasks

- Keep your list of inputs short.
Each input to a task takes up another vertical line in YAML.
Aesthetically, 4-5 inputs is about the most you ever want to pass to a single task.
- Keep your inputs orthogonal.
The classic editor lets you go crazy with `groups` and `visibleRule`s, allowing you to funnel the users to a small set of inputs.
In YAML, there's no affordance for which inputs go together, which are mutually exclusive, and which ones cause others to become required.
- Choose human-friendly input names.
The name will be used in the `input` block.
It should describe the expected data, both syntax and semantics.
But it should also be as short as reasonable.
Not so good: `minutesBeforeTimingOut`. Better: `timeoutInMinutes`. Best, if it'll be fairly obvious what the units are: `timeout`.
- Follow the principle of least surprise when choosing `defaultValue`s.
None of our YAML experiences offer insight into task defaults right now.
Users have to trust you won't do something silly.
- Document your inputs, including a YAML snippet showing how to use it.
We're improving on the product side with things like IntelliSense in the YAML editor, but at the moment, discovering inputs isn't easy.
At a minimum, wherever your helpMarkdown links to should show an example.
You can mimic how we document tasks if you like: [example for the Bash task](https://docs.microsoft.com/en-us/azure/devops/pipelines/tasks/utility/bash?view=azure-devops).

## Advice for upgrading tasks

Updating an existing task is _much_ trickier than building a new task.
If, after reviewing this advice, you can't find a clean way to upgrade, you might consider marking your current task deprecated and offering a new, "green field" task that follows the above guidance.
Consider that a last resort, though, since it's fairly disruptive for your customers.

### Making life easier for YAML users

- YAML exposes the raw input name in a way that the classic editor did not.
If you don't want to make a breaking change to your task, you can add an `aliases` array to the `input` definition.
It's an array of strings which will be considered equivalent to the input's real name.
The first one in the list will usually be suggested by IntelliSense.
Example: the `InstallSSHKey` task took an input called `hostName` but actually expected a line from a `known_hosts` file.
In the classic editor, this was clear because the label was "Known hosts entry".
I added an alias, `knownHostsEntry`, so that it's also clear in YAML what's actually expected.
- The full syntax for referring to an extension-installed task is a little verbose.
It includes the extension publisher, extension ID, task contribution ID, and task `name` (NOT `friendlyName`).
(_TODO: we probably don't need ALL of those._)
If your task is unlikely to collide with any other task a customer is likely to install, your users can drop all the leading segments and refer just to the task name.
For example: `publisher-id.extension-id.task-contribution-id.printHelloWorld` can also be written as just `printHelloWorld`.
  - ~~If you're doing the kind of "one-time setup as a dev might do on their machine", consider using the `ecosystem` feature.~~ (This feature is currently paused.)
<!--  `ecosystem` tells the YAML parser that your task will set the machine's PATH to point to a tool at a specific version, optionally that it knows how download versions of a tool, and that it will set the tool's proxy settings to match the agent's.
  (In the future, `use` will also map authentication settings and install problem matchers.)
  Instead of referring to `- task: UseNodeVersion@0`, the end user simply writes `- use: node`. -->
  - We're actively soliciting other classes of syntactic sugar we can add over top of raw `- task` usage.\
  If you have ideas, please open an issue in https://github.com/Microsoft/azure-pipelines-yaml to discuss.
- You can change your task name when you do a major version.
As long as it uses the same `id` GUID, the classic editor won't break.
(Technically you can change it on a minor or patch version, but you risk breaking existing YAML users.)

### Keeping your classic editor users in mind

When you offer a new major version of a task, a classic editor user is notified by a little badge.
When they click the dropdown to go to the new major version:
- Inputs with the same names and types should automatically remain.
- New inputs and inputs whose types have changed will be set to their defaults.
- Inputs which no longer exist will disappear.

Carefully consider this behavior when you decide which inputs to bring forward in a new task version.

### Contributions welcomed!

If you have additional thoughts, feel free to open a PR against this doc.
I hope it's a living document that changes as the YAML pipelines system continues to evolve.
