# Instructions for Contributing Code

## Contributing bug fixes

We are currently accepting contributions in the form of bug fixes. A bug must have an issue tracking it in the issue tracker. Your pull request should include a link to the bug that you are fixing. If you've submitted a PR for a bug, please post a comment in the bug to avoid duplication of effort.

## Contributing features

Features (things that add new or improved functionality) may be accepted, but will need to first be approved in the form of a suggestion issue.

Design changes will not be accepted at this time. If you have a design change proposal, please log a suggestion issue.

## Legal

You will need to complete a Contributor License Agreement (CLA). Briefly, this agreement testifies that you are granting us permission to use the submitted change according to the terms of the project's license, and that the work being submitted is under appropriate copyright.

Please submit a Contributor License Agreement (CLA) before submitting a pull request. You may visit <https://cla.microsoft.com> to sign digitally.

## Housekeeping

Your pull request should:

* Include a description of what your change intends to do
* Be a child commit of a reasonably recent commit in the **master** branch
  * Requests need not be a single commit, but should be a linear sequence of commits (i.e. no merge commits in your PR)
* It is desirable, but not necessary, for the tests to pass at each commit
* Have clear commit messages
  * e.g. "Refactor feature", "Fix issue", "Add tests for issue"
* Include adequate tests
  * At least one test should fail in the absence of your non-test code changes. If your PR does not match this criteria, please specify why
  * Tests should include reasonable permutations of the target fix/change
  * Include baseline changes with your change
  * All changed code must have 100% code coverage
