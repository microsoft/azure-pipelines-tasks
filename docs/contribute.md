# Contributing

This repo contains the in-the-box tasks for VSO build.  Tasks in this repo get deployed every three weeks to VSO and appear in TFS quarterly updates.

If you are creating tasks that you believe the community can benefit from consider creating an extension.
[create an extension](https://www.visualstudio.com/integrate/extensions/develop/add-build-task)

## Node and Npm:
**Windows and Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 4.2 and npm 3:
```bash
$ node -v && npm -v
v4.2.0
3.5.0
```

To install npm separately:
```
[sudo] npm install npm@3 -g
npm -v
3.5.0
```

Note: on windows if it's still returning npm 2.x run where npm.  Notice hits in program files. Rename those two npm files and the 3.5.0 in AppData will win.

## Gulp

Install gulp
```bash
npm install gulp -g
```

From the root of the repo, install the dependencies to build:
```bash
npm install
```

## TypeScript

Install TypeScript
```bash
npm install typescript -g
```

You'll need at least TypeScript 1.6 but would recommend latest at time of writing this which is 1.8.7

Validate it's resolving from your terminal after installing:

```bash
$ tsc --version
Version 1.8.7
```

## Build
Tasks are built using gulp.  

From the root of the repo:
```bash
gulp
```

Tasks will be created in the _build directory.  It will also generate a tasks.loc.json and an english strings file under Strings in your source tree.  You can check these back in.  Another localization process will create the other strings files.

## Package
This must be done on a windows machine with nuget.exe in the path
From the root of the repo (replace version with appropriate version)
```bash
gulp package --version 1.0.29
```

Tasks will be create a nuget package in the _package directory.  This is only used for TFS internal engineering.

## Tests
Tests should be run with changes.  Ideally, new tests are added for your change.  
[Read here](runningtests.md)