Visual Studio Tools for Apache Cordova (TACo) Cordova CLI Support Plugin
===============
**Note: This plugin no longer includes support for executing Task Runner Explorer bindings from the command line. Check out [this repository](https://github.com/Chuxel/taco-tricks/tree/master/hook-task-runner-binding) for how to use a Cordova project "hook" to accomplish the same thing.**

License: MIT

This is a sample Cordova plugin designed to add in support three two Visual Studio [Tools for Apache Cordova](http://aka.ms/cordova) features along with number of workarounds for Cordova issues such that they work with the standard Cordova CLI and deriviatives like the Ionic CLI or PhoneGap CLI. Specifically:

- Support for the VS res/native folder structure 
- Support for VS specific config.xml elements for Windows packaging
- Removing bad plugin related json files when associated platforms folder is not present
- Fixing symlinks for iOS custom frameworks inside plugins as needed
- Fixing missing execute bits on Cordova platform scripts on OSX as needed

The plugin can also be safely installed and used with Visual Studio projects as the plugin does not interfere with normal operation.

##Installation
Note: Cordova 5.1.1 has a bug that can cause plugins installed from a Git repo to fail if the project is on a different drive than your temp folder. Either move the project to the same drive when installing or you can instead download a copy, unzip it, and add the plugin from the filesystem.

From Visual Studio:

1. Open the config.xml designer by double clicking on the file
2. Select the "Plugins" > "Custom"
3. Select "Git"
3. Enter in "https://github.com/Chuxel/taco-cordova-support-plugin.git" and press the arrow
4. Click "Add"


From the command line:

1. Install the Cordova CLI
2. Navigate to your project root
3. Type "cordova plugin add https://github.com/Chuxel/taco-cordova-support-plugin.git"

## Terms of Use
By downloading and running this project, you agree to the license terms of the third party application software, Microsoft products, and components to be installed. 

The third party software and products are provided to you by third parties. You are responsible for reading and accepting the relevant license terms for all software that will be installed. Microsoft grants you no rights to third party software.

## License
Unless otherwise mentioned, the code samples are released under the MIT license.

```
The MIT License (MIT)

Copyright (c) Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
