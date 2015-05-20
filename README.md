# VSO Build.Preview Tasks
<br/>
![Build Tasks](/taskbanner.png?raw=true "Build Tasks")
<br/>
## Configure

Before you run the builds, you need to configure an agent:

[Windows](https://youtu.be/ZzrDPmTOEEk)

[OSX/Linux](https://github.com/Microsoft/vso-agent)

## Available Build Steps

* Android
* Ant
* BashScript
* Azure Cloud Deployment
* [Azure PowerShell (Video)](http://youtu.be/uRI94SJ_XoE)
* [Azure WebSite Deployment (Video)](http://youtu.be/aLprCE3uRHs)
* CMake
* Command Line
* Gulp
* Gradle
* Maven
* MSBuild
* PowerShell
* ShellScript
* [VSBuild (Video)](http://youtu.be/Jx8s7KAATH4)
* Visual Studio Test
* Xamarin
* [Xcode Build (Video)](http://youtu.be/OxmBuqtgHuM)

## Overview
Tasks are simply tool runners.  They know how to run MSBuild, VSTest, etc... in a first class way and handle return codes, how to treat std/err out, and how to write timeline records based on expected output.  Your build logic should be in the build
DSL that the CI server runs ... the same as what the dev runs.

## Contributing
Tasks are built using gulp.  

### Node and Npm:
**Windows and Mac OSX**: Download and install node from [nodejs.org](http://nodejs.org/)

**Linux**: Install [using package manager](https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager)

From a terminal ensure at least node 0.10 and npm 1.4:
```bash
$ node -v && npm -v
v0.12.0
2.5.1
```

### Gulp

Install gulp
```bash
npm install gulp -g
```

From the root of the repo, install the dependencies to build:
```bash
npm install
```

### Build
From the root of the repo:
```bash
gulp
```

Tasks will be created in the _build directory.  It will also generate a tasks.loc.json and an english strings file under Strings in your source tree.  You can check these back in.  Another localization process will create the other strings files.

### Package
This must be done on a windows machine with nuget.exe in the path
From the root of the repo (replace version with appropriate version)
```bash
gulp package --version 1.0.29
```

Tasks will be create a nuget package in the _package directory.  This is only used for TFS internal engineering.
