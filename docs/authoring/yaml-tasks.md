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

_TODO_

## Advice for upgrading tasks

_TODO_
