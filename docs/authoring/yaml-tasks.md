# Tasks and YAML

The task model was designed thoughtfully, and it shows.
It has evolved to keep up with growing needs: task lifecycle (preview and deprecation), distribution on the Marketplace, and of course, the introduction of YAML pipelines.
The last one requires some care on the part of the task author to create an ideal experience.
The community has asked for a guide to thinking about "YAMLizing" their tasks.
This doc attempts to capture what we've learned as we've evolved our in-box tasks to support YAML.

## Observation

In a designer pipeline, the editing UI allows for "if/else" logic, rich input types, and in-situ error checking.
A YAML editor could hypothetically offer the same, but we made a choice that the YAML representation would be human editable.
Therefore, over-reliance on editor features is an anti-pattern.
Nearly all of the advice here flows from this fundamental difference.

As it turns out, simplifying the "shape" of a task's inputs doesn't really harm the designer experience.
In fact, we've got some regrets about the number of inputs that several of our in-box tasks have historically taken.
The move towards single- or reduced-use-case tasks benefits composibility and understability regardless of the pipeline editor used.

## Advice for new tasks

- Keep your list of inputs relatively short.
Each input to a task takes up another vertical line in YAML.
My gut feel is that 4-5 inputs is about the most I ever want to pass to a single task.
- Keep your inputs orthogonal.
The designer lets you go crazy with `groups` and `visibleRule`s, allowing you to funnel the users to a small set of inputs.
In YAML, there's no affordance for which inputs go together, which are mutually exclusive, and which ones cause others to become required.
- Follow the principle of least surprise when choosing `defaultValue`s.
None of our YAML experiences offer insight into task defaults right now.
Users have to trust you won't do something silly.

### Should a task even be a task?

- Tasks which are merely wrappers around a multi-verb command line aren't valuable.
Example: we would not ship a task called `Git` with an input `Action` whose values are `clone`, `checkout`, and `push`.
Customers should be advised to simply add a script step which directly called `git clone` or whatever.
(We've done this before, and we've always regretted it.)
- Tasks which can automate the setup a developer would perform on their local machine are great.
For instance, setting up SSH keys is typically a one-time thing on a dev machine, but has to be repeated in each CI run.
Also, SSH private keys should be stored as secure files, which can only be downloaded to the agent by virtue of being a task input.
- Tasks offer the ability to inject pre- and post-steps on the job.
This can occasionally be the only mechanism to accomplish something: for instance, cleaning up after use of a secure resource.

## Advice for upgrading tasks

_TODO_
