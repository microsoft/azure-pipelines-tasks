// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import child_process = require('child_process');
import fs = require('fs');
import path = require('path');
import os = require('os');
import stream = require('stream');
import * as tl from '../_build/task';
import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

const signals: (number | NodeJS.Signals)[] = ['SIGTERM', 'SIGINT', 'SIGKILL', 15, 2, 9];

describe('Toolrunner Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    it('ExecSync convenience with stdout', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var ret = tl.execSync('cmd', '/c echo \'azure-pipelines-task-lib\'', _testExecOptions);
            assert.equal(ret.code, 0, 'return code of cmd should be 0');
        }
        else {
            var ret = tl.execSync('ls', '-l -a', _testExecOptions);
            assert.equal(ret.code, 0, 'return code of ls should be 0');
        }

        assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
        done();
    })
    it('ExecSync with stdout', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true));
            cmd.arg('/c echo \'azure-pipelines-task-lib\'');

            var ret = cmd.execSync(_testExecOptions);
            assert.equal(ret.code, 0, 'return code of cmd should be 0');
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            var ret = ls.execSync(_testExecOptions);
            assert.equal(ret.code, 0, 'return code of ls should be 0');
        }

        assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
        done();
    })
    it('ExecSync fails with rc 1 and stderr', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        var tool;
        if (os.platform() === 'win32') {
            tool = tl.tool(tl.which('cmd', true));
            tool.arg('/c');
            tool.arg('echo hello from stderr 1>&2 && exit 123');
        }
        else {
            tool = tl.tool(tl.which('bash', true));
            tool.arg('--norc');
            tool.arg('-c');
            tool.arg('echo hello from stderr 1>&2 ; exit 123');
        }

        var ret = tool.execSync(_testExecOptions);
        assert.equal(ret.code, 123, 'return code of tool should be 123');
        assert.equal(ret.stderr.toString().trim(), 'hello from stderr');
        done();
    })
    it('Exec convenience with stdout', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            tl.exec('cmd', '/c echo \'azure-pipelines-task-lib\'', _testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            tl.exec('ls', '-l -a', _testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of ls should be 0');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('ToolRunner writes debug', function (done) {
        this.timeout(10000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var cmdPath = tl.which('cmd', true);
            var cmd = tl.tool(cmdPath);
            cmd.arg('/c echo \'azure-pipelines-task-lib\'');

            cmd.exec(_testExecOptions)
                .then(function (code) {
                    var contents = stdStream.getContents();
                    assert(contents.indexOf('exec tool: ' + cmdPath) >= 0, 'should exec cmd');
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            ls.exec(_testExecOptions)
                .then(function (code) {
                    var contents = stdStream.getContents();
                    const usr = os.platform() === 'linux' ? '/usr' : '';
                    assert(contents.indexOf(`exec tool: ${usr}/bin/ls`) >= 0, 'should exec ls');
                    assert.equal(code, 0, 'return code of ls should be 0');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Writes correct output line events', async function () {
        const scriptPath = path.join(__dirname, 'scripts', 'write-bufferedoutput.js');
        const node = tl.tool(tl.which('node', true));
        node.arg(scriptPath);

        const stdlines = [];
        const errlines = [];

        node.on('stdline', function (line) {
            stdlines.push(line);
        });

        node.on('errline', function (line) {
            errlines.push(line);
        });

        const code = await node.exec({
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        })

        assert.deepStrictEqual(code, 0, 'return code of cmd should be 0');
        assert.deepStrictEqual(stdlines, ['stdline 1', 'stdline 2', 'stdline 3'], 'should have emitted stdlines');
        assert.deepStrictEqual(errlines, ['errline 1', 'errline 2', 'errline 3'], 'should have emitted errlines');
    })
    it('Execs with stdout', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        var output = '';
        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true))
                .arg('/c')
                .arg('echo \'azure-pipelines-task-lib\'');

            cmd.on('stdout', (data) => {
                output = data.toString();
            });

            cmd.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    assert(output && output.length > 0, 'should have emitted stdout');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var ls = tl.tool(tl.which('ls', true));
            ls.arg('-l');
            ls.arg('-a');

            ls.on('stdout', (data) => {
                output = data.toString();
            });

            ls.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of ls should be 0');
                    assert(output && output.length > 0, 'should have emitted stdout');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Fails on return code 1 with stderr', function (done) {
        this.timeout(10000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var cmd = tl.tool(tl.which('cmd', true));
            cmd.arg('/c notExist');

            var output = '';
            cmd.on('stderr', (data) => {
                output = data.toString();
            });

            var succeeded = false;
            cmd.exec(_testExecOptions)
                .then(function (code) {
                    succeeded = true;
                    assert.fail('should not have succeeded');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(err.message.indexOf('failed with exit code 1') >= 0, `expected error message to indicate "failed with exit code 1". actual error message: "${err}"`);
                        assert(output && output.length > 0, 'should have emitted stderr');
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var bash = tl.tool(tl.which('bash', true));
            bash.arg('--noprofile');
            bash.arg('--norc');
            bash.arg('-c');
            bash.arg('echo hello from STDERR 1>&2 ; exit 123');
            var output = '';
            bash.on('stderr', (data) => {
                output = data.toString();
            });

            var succeeded = false;
            bash.exec(_testExecOptions)
                .then(function () {
                    succeeded = true;
                    assert.fail('should not have succeeded');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(err.message.indexOf('failed with exit code 123') >= 0, `expected error message to indicate "failed with exit code 123". actual error message: "${err}"`);
                        assert(output && output.length > 0, 'should have emitted stderr');
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Succeeds on stderr by default', function (done) {
        this.timeout(10000);

        var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
        var ls = tl.tool(tl.which('node', true));
        ls.arg(scriptPath);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };
        ls.exec(_testExecOptions)
            .then(function (code) {
                assert.equal(code, 0, 'should have succeeded on stderr');
                done();
            })
            .catch(function (err) {
                done(new Error('did not succeed on stderr'))
            })
    })
    it('Fails on stderr if specified', function (done) {
        this.timeout(10000);

        var scriptPath = path.join(__dirname, 'scripts', 'stderroutput.js');
        var node = tl.tool(tl.which('node', true))
            .arg(scriptPath);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        node.on('stderr', (data) => {
            output = data.toString();
        });

        var succeeded = false;
        node.exec(_testExecOptions)
            .then(function () {
                succeeded = true;
                assert.fail('should not have succeeded');
            })
            .catch(function (err) {
                if (succeeded) {
                    done(err);
                }
                else {
                    assert(err.message.indexOf('one or more lines were written to the STDERR stream') >= 0, `expected error message to indicate "one or more lines were written to the STDERR stream". actual error message: "${err}"`);
                    assert(output && output.length > 0, 'should have emitted stderr');
                    done();
                }
            })
            .catch(function (err) {
                done(err);
            });
    })
    it('Fails when process fails to launch', function (done) {
        this.timeout(10000);

        var tool = tl.tool(tl.which('node', true));
        var _testExecOptions = <trm.IExecOptions>{
            cwd: path.join(testutil.getTestTemp(), 'nosuchdir'),
            env: {},
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        }

        var output = '';
        tool.on('stderr', (data) => {
            output = data.toString();
        });

        var succeeded = false;
        tool.exec(_testExecOptions)
            .then(function () {
                succeeded = true;
                assert.fail('should not have succeeded');
            })
            .catch(function (err) {
                if (succeeded) {
                    done(err);
                }
                else {
                    assert(err.message.indexOf('This may indicate the process failed to start') >= 0, `expected error message to indicate "This may indicate the process failed to start". actual error message: "${err}"`);
                    done();
                }
            })
            .catch(function (err) {
                done(err);
            });
    })
    it('Handles child process holding streams open', function (done) {
        this.timeout(10000);

        let semaphorePath = path.join(testutil.getTestTemp(), 'child-process-semaphore.txt');
        fs.writeFileSync(semaphorePath, '');

        let nodePath = tl.which('node', true);
        let scriptPath = path.join(__dirname, 'scripts', 'wait-for-file.js');
        let shell: trm.ToolRunner;
        if (os.platform() == 'win32') {
            shell = tl.tool(tl.which('cmd.exe', true))
                .arg('/D') // Disable execution of AutoRun commands from registry.
                .arg('/E:ON') // Enable command extensions. Note, command extensions are enabled by default, unless disabled via registry.
                .arg('/V:OFF') // Disable delayed environment expansion. Note, delayed environment expansion is disabled by default, unless enabled via registry.
                .arg('/S') // Will cause first and last quote after /C to be stripped.
                .arg('/C')
                .arg(`"start "" /B "${nodePath}" "${scriptPath}" "file=${semaphorePath}""`);
        }
        else {
            shell = tl.tool(tl.which('bash', true))
                .arg('-c')
                .arg(`node '${scriptPath}' 'file=${semaphorePath}' &`);
        }

        let toolRunnerDebug = [];
        shell.on('debug', function (data) {
            toolRunnerDebug.push(data);
        });

        process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'] = "500"; // 0.5 seconds

        let options = <trm.IExecOptions>{
            cwd: __dirname,
            env: process.env,
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: process.stdout,
            errStream: process.stdout,
            windowsVerbatimArguments: true
        };

        shell.exec(options)
            .then(function () {
                assert(toolRunnerDebug.filter((x) => x.indexOf('STDIO streams did not close') >= 0).length == 1, 'Did not find expected debug message');
                done();
            })
            .catch(function (err) {
                done(err);
            })
            .finally(function () {
                fs.unlinkSync(semaphorePath);
                delete process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'];
            });
    });

    signals.forEach(signal => {
        it(`Handle child process killing with ${signal} signal`, function (done) {
            this.timeout(10000);

            let shell: trm.ToolRunner;
            let tool;
            if (os.platform() == 'win32') {
                tool = tl.which('cmd.exe', true);
                shell = tl.tool(tool)
                    .arg('/D') // Disable execution of AutoRun commands from registry.
                    .arg('/E:ON') // Enable command extensions. Note, command extensions are enabled by default, unless disabled via registry.
                    .arg('/V:OFF') // Disable delayed environment expansion. Note, delayed environment expansion is disabled by default, unless enabled via registry.
                    .arg('/S') // Will cause first and last quote after /C to be stripped.
                    .arg('/C')
                    .arg("waitfor 3");
            }
            else {
                tool = tl.which('bash', true);
                shell = tl.tool(tool)
                    .arg('-c')
                    .arg("sleep 3");
            }

            let toolRunnerDebug = [];
            shell.on('debug', function (data) {
                toolRunnerDebug.push(data);
            });

            let options = <trm.IExecOptions>{
                cwd: __dirname,
                env: process.env,
                silent: false,
                failOnStdErr: true,
                ignoreReturnCode: false,
                outStream: process.stdout,
                errStream: process.stdout,
                windowsVerbatimArguments: true
            };

            shell.exec(options)
                .then(function () {
                    done(new Error('should not have been successful'));
                    done();
                })
                .catch(function () {
                    if (typeof signal === 'number') {
                        signal = Object.keys(os.constants.signals).find(x => os.constants.signals[x] == signal) as NodeJS.Signals;
                    }
                    assert(toolRunnerDebug.pop(), `STDIO streams have closed and received exit code null and signal ${signal} for tool '${tool}'`);
                    done();
                })
                .catch(function (err) {
                    done(err);
                })

            shell.killChildProcess(signal);
        });
    });

    it('Handles child process holding streams open and non-zero exit code', function (done) {
        this.timeout(10000);

        let semaphorePath = path.join(testutil.getTestTemp(), 'child-process-semaphore.txt');
        fs.writeFileSync(semaphorePath, '');

        let nodePath = tl.which('node', true);
        let scriptPath = path.join(__dirname, 'scripts', 'wait-for-file.js');
        let shell: trm.ToolRunner;
        if (os.platform() == 'win32') {
            shell = tl.tool(tl.which('cmd.exe', true))
                .arg('/D') // Disable execution of AutoRun commands from registry.
                .arg('/E:ON') // Enable command extensions. Note, command extensions are enabled by default, unless disabled via registry.
                .arg('/V:OFF') // Disable delayed environment expansion. Note, delayed environment expansion is disabled by default, unless enabled via registry.
                .arg('/S') // Will cause first and last quote after /C to be stripped.
                .arg('/C')
                .arg(`"start "" /B "${nodePath}" "${scriptPath}" "file=${semaphorePath}"" & exit /b 123`);
        }
        else {
            shell = tl.tool(tl.which('bash', true))
                .arg('-c')
                .arg(`node '${scriptPath}' 'file=${semaphorePath}' & exit 123`);
        }

        let toolRunnerDebug = [];
        shell.on('debug', function (data) {
            toolRunnerDebug.push(data);
        });

        process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'] = "500"; // 0.5 seconds

        let options = <trm.IExecOptions>{
            cwd: __dirname,
            env: process.env,
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: process.stdout,
            errStream: process.stdout,
            windowsVerbatimArguments: true
        };

        shell.exec(options)
            .then(function () {
                done(new Error('should not have been successful'));
                done();
            })
            .catch(function (err) {
                assert(toolRunnerDebug.filter((x) => x.indexOf('STDIO streams did not close') >= 0).length == 1, 'Did not find expected debug message');
                assert(err.message.indexOf('failed with exit code 123') >= 0);
                done();
            })
            .catch(function (err) {
                done(err);
            })
            .finally(function () {
                fs.unlinkSync(semaphorePath);
                delete process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'];
            });
    })
    it('Handles child process holding streams open and stderr', function (done) {
        this.timeout(10000);

        let semaphorePath = path.join(testutil.getTestTemp(), 'child-process-semaphore.txt');
        fs.writeFileSync(semaphorePath, '');

        let nodePath = tl.which('node', true);
        let scriptPath = path.join(__dirname, 'scripts', 'wait-for-file.js');
        let shell: trm.ToolRunner;
        if (os.platform() == 'win32') {
            shell = tl.tool(tl.which('cmd.exe', true))
                .arg('/D') // Disable execution of AutoRun commands from registry.
                .arg('/E:ON') // Enable command extensions. Note, command extensions are enabled by default, unless disabled via registry.
                .arg('/V:OFF') // Disable delayed environment expansion. Note, delayed environment expansion is disabled by default, unless enabled via registry.
                .arg('/S') // Will cause first and last quote after /C to be stripped.
                .arg('/C')
                .arg(`"start "" /B "${nodePath}" "${scriptPath}" "file=${semaphorePath}"" & echo hi 1>&2`);
        }
        else {
            shell = tl.tool(tl.which('bash', true))
                .arg('-c')
                .arg(`node '${scriptPath}' 'file=${semaphorePath}' & echo hi 1>&2`);
        }

        let toolRunnerDebug = [];
        shell.on('debug', function (data) {
            toolRunnerDebug.push(data);
        });

        process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'] = "500"; // 0.5 seconds

        let options = <trm.IExecOptions>{
            cwd: __dirname,
            env: process.env,
            silent: false,
            failOnStdErr: true,
            ignoreReturnCode: false,
            outStream: process.stdout,
            errStream: process.stdout,
            windowsVerbatimArguments: true
        };

        shell.exec(options)
            .then(function () {
                done(new Error('should not have been successful'));
                done();
            })
            .catch(function (err) {
                assert(toolRunnerDebug.filter((x) => x.indexOf('STDIO streams did not close') >= 0).length == 1, 'Did not find expected debug message');
                assert(err.message.indexOf('failed because one or more lines were written to the STDERR stream') >= 0);
                done();
            })
            .catch(function (err) {
                done(err);
            })
            .finally(function () {
                fs.unlinkSync(semaphorePath);
                delete process.env['TASKLIB_TEST_TOOLRUNNER_EXITDELAY'];
            });
    })
    it('Exec pipe output to another tool, succeeds if both tools succeed', function (done) {
        this.timeout(120000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('0') // exit code
                .arg('line 2'); // match value
            var outputExe = tl.tool(compileOutputExe())
                .arg('0') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            outputExe.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of exec should be 0');
                    assert(output && output.length > 0 && output.indexOf('line 2') >= 0, 'should have emitted stdout ' + output);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('node');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('ax');
            ps.pipeExecOutputToTool(grep);

            var output = '';
            ps.on('stdout', (data) => {
                output += data.toString();
            });

            ps.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of exec should be 0');
                    assert(output && output.length > 0 && output.indexOf('node') >= 0, 'should have emitted stdout ' + output);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Exec pipe output to another tool, fails if first tool fails', function (done) {
        this.timeout(20000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('0') // exit code
                .arg('line 2'); // match value
            var outputExe = tl.tool(compileOutputExe())
                .arg('1') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            var succeeded = false;
            outputExe.exec(_testExecOptions)
                .then(function () {
                    succeeded = true;
                    assert.fail('print-output.exe | findstr "line 2" was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(err && err.message && err.message.indexOf('print-output.exe') >= 0, 'error from print-output.exe is not reported');
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('ssh');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('bad');
            ps.pipeExecOutputToTool(grep);

            var output = '';
            ps.on('stdout', (data) => {
                output += data.toString();
            });

            var succeeded = false;
            ps.exec(_testExecOptions)
                .then(function () {
                    succeeded = true;
                    assert.fail('ps bad | grep ssh was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        //assert(output && output.length > 0 && output.indexOf('ps: illegal option') >= 0, `error output "ps: illegal option" is expected. actual "${output}"`);
                        assert(err && err.message && err.message.indexOf('/bin/ps') >= 0, 'error from ps is not reported');
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                })
        }
    })
    it('Exec pipe output to another tool, fails if second tool fails', function (done) {
        this.timeout(20000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('1') // exit code
                .arg('line 2') // match value
                .arg('some error message'); // error
            var outputExe = tl.tool(compileOutputExe())
                .arg('0') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            var errOut = '';
            outputExe.on('stderr', (data) => {
                errOut += data.toString();
            });

            var succeeded = false;
            outputExe.exec(_testExecOptions)
                .then(function (code) {
                    succeeded = true;
                    assert.fail('print-output.exe 0 "line 1" "line 2" "line 3" | match-input.exe 1 "line 2" "some error message" was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(errOut && errOut.length > 0 && errOut.indexOf('some error message') >= 0, 'error output from match-input.exe is expected');
                        assert(err && err.message && err.message.indexOf('match-input.exe') >= 0, 'error from find does not match expeced. actual: ' + err.message);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('--?');

            var node = tl.tool(tl.which('node', true))
                .arg('-e')
                .arg('console.log("line1"); setTimeout(function () { console.log("line2"); }, 200);'); // allow long enough to hook up stdout to stdin
            node.pipeExecOutputToTool(grep);

            var output = '';
            node.on('stdout', (data) => {
                output += data.toString();
            });

            var errOut = '';
            node.on('stderr', (data) => {
                errOut += data.toString();
            })

            var succeeded = false;
            node.exec(_testExecOptions)
                .then(function (code) {
                    succeeded = true;
                    assert.fail('node [...] | grep --? was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(errOut && errOut.length > 0 && errOut.indexOf('grep: unrecognized option') >= 0, 'error output from ps command is expected');
                        // grep is /bin/grep on Linux and /usr/bin/grep on OSX
                        assert(err && err.message && err.message.match(/\/[usr\/]?bin\/grep/), 'error from grep is not reported. actual: ' + err.message);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Exec pipe output to file and another tool, succeeds if both tools succeed', function (done) {
        this.timeout(20000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        const testFile = path.join(testutil.getTestTemp(), 'BothToolsSucceed.log');

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('0') // exit code
                .arg('line 2'); // match value
            var outputExe = tl.tool(compileOutputExe())
                .arg('0') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe, testFile);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            outputExe.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of exec should be 0');
                    assert(output && output.length > 0 && output.indexOf('line 2') >= 0, 'should have emitted stdout ' + output);
                    assert(fs.existsSync(testFile), 'Log of first tool output is created when both tools succeed');
                    const fileContents = fs.readFileSync(testFile);
                    assert(fileContents.indexOf('line 2') >= 0, 'Log file of first tool should have stdout from first tool: ' + fileContents);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('node');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('ax');
            ps.pipeExecOutputToTool(grep, testFile);

            var output = '';
            ps.on('stdout', (data) => {
                output += data.toString();
            });

            ps.exec(_testExecOptions)
                .then(function (code) {
                    assert.equal(code, 0, 'return code of exec should be 0');
                    assert(output && output.length > 0 && output.indexOf('node') >= 0, 'should have emitted stdout ' + output);
                    assert(fs.existsSync(testFile), 'Log of first tool output is created when both tools succeed');
                    const fileContents = fs.readFileSync(testFile);
                    assert(fileContents.indexOf('PID') >= 0, 'Log of first tool should have stdout from first tool: ' + fileContents);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('Exec pipe output to file and another tool, fails if first tool fails', function (done) {
        this.timeout(20000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        const testFile = path.join(testutil.getTestTemp(), 'FirstToolFails.log');

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('0') // exit code
                .arg('line 2'); // match value
            var outputExe = tl.tool(compileOutputExe())
                .arg('1') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe, testFile);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            var succeeded = false;
            outputExe.exec(_testExecOptions)
                .then(function () {
                    succeeded = true;
                    assert.fail('print-output.exe | findstr "line 2" was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(err && err.message && err.message.indexOf('print-output.exe') >= 0, 'error from print-output.exe is not reported');
                        assert(fs.existsSync(testFile), 'Log of first tool output is created when first tool fails');
                        const fileContents = fs.readFileSync(testFile);
                        assert(fileContents.indexOf('line 3') >= 0, 'Error from first tool should be written to log file: ' + fileContents);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('ssh');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('bad');
            ps.pipeExecOutputToTool(grep, testFile);

            var output = '';
            ps.on('stdout', (data) => {
                output += data.toString();
            });

            var succeeded = false;
            ps.exec(_testExecOptions)
                .then(function () {
                    succeeded = true;
                    assert.fail('ps bad | grep ssh was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(err && err.message && err.message.indexOf('/bin/ps') >= 0, 'error from ps is not reported');
                        assert(fs.existsSync(testFile), 'Log of first tool output is created when first tool fails');
                        const fileContents = fs.readFileSync(testFile);
                        assert(fileContents.indexOf('illegal option') >= 0 || fileContents.indexOf('unsupported option') >= 0,
                            'error from first tool should be written to log file: ' + fileContents);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                })
        }
    })
    it.skip('Exec pipe output to file and another tool, fails if second tool fails', function (done) {
        this.timeout(20000);

        var _testExecOptions = <trm.IExecOptions>{
            cwd: __dirname,
            env: {},
            silent: false,
            failOnStdErr: false,
            ignoreReturnCode: false,
            outStream: testutil.getNullStream(),
            errStream: testutil.getNullStream()
        };

        const testFile = path.join(testutil.getTestTemp(), 'SecondToolFails.log');

        if (os.platform() === 'win32') {
            var matchExe = tl.tool(compileMatchExe())
                .arg('1') // exit code
                .arg('line 2') // match value
                .arg('some error message'); // error
            var outputExe = tl.tool(compileOutputExe())
                .arg('0') // exit code
                .arg('line 1')
                .arg('line 2')
                .arg('line 3');
            outputExe.pipeExecOutputToTool(matchExe, testFile);

            var output = '';
            outputExe.on('stdout', (data) => {
                output += data.toString();
            });

            var errOut = '';
            outputExe.on('stderr', (data) => {
                errOut += data.toString();
            });

            var succeeded = false;
            outputExe.exec(_testExecOptions)
                .then(function (code) {
                    succeeded = true;
                    assert.fail('print-output.exe 0 "line 1" "line 2" "line 3" | match-input.exe 1 "line 2" "some error message" was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(errOut && errOut.length > 0 && errOut.indexOf('some error message') >= 0, 'error output from match-input.exe is expected');
                        assert(err && err.message && err.message.indexOf('match-input.exe') >= 0, 'error from find does not match expeced. actual: ' + err.message);
                        assert(fs.existsSync(testFile), 'Log of first tool output is created when second tool fails');
                        const fileContents = fs.readFileSync(testFile);
                        assert(fileContents.indexOf('some error message') < 0, 'error from second tool should not be in the log for first tool: ' + fileContents);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
        else {
            var grep = tl.tool(tl.which('grep', true));
            grep.arg('--?');

            var ps = tl.tool(tl.which('ps', true));
            ps.arg('ax');
            ps.pipeExecOutputToTool(grep, testFile);

            var output = '';
            ps.on('stdout', (data) => {
                output += data.toString();
            });

            var errOut = '';
            ps.on('stderr', (data) => {
                errOut += data.toString();
            })

            var succeeded = false;
            ps.exec(_testExecOptions)
                .then(function (code) {
                    succeeded = true;
                    assert.fail('ps ax | grep --? was a bad command and it did not fail');
                })
                .catch(function (err) {
                    if (succeeded) {
                        done(err);
                    }
                    else {
                        assert(errOut && errOut.length > 0 && errOut.indexOf('grep: unrecognized option') >= 0, 'error output from ps command is expected');
                        // grep is /bin/grep on Linux and /usr/bin/grep on OSX
                        assert(err && err.message && err.message.match(/\/[usr\/]?bin\/grep/), 'error from grep is not reported. actual: ' + err.message);
                        assert(fs.existsSync(testFile), 'Log of first tool output is created when second tool fails');
                        const fileContents = fs.readFileSync(testFile);
                        assert(fileContents.indexOf('unrecognized option') < 0, 'error from second tool should not be in the first tool log file: ' + fileContents);
                        done();
                    }
                })
                .catch(function (err) {
                    done(err);
                });
        }
    })
    it('handles single args', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.arg('one');
        node.arg('two');
        assert.equal((node as any).args.length, 2, 'should have 2 args');
        assert.equal((node as any).args.toString(), 'one,two', 'should be one,two');
        done();
    })
    it('handles arg chaining', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.arg('one').arg('two').argIf(true, 'three').line('four five');
        //node.arg('one').arg('two').argIf(true, 'three');
        assert.equal((node as any).args.length, 5, 'should have 5 args');
        assert.equal((node as any).args.toString(), 'one,two,three,four,five', 'should be one,two,three,four,five');
        done();
    })
    it('handles padded spaces', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.arg(' one ');
        node.arg('two');
        assert.equal((node as any).args.length, 2, 'should have 2 args');
        assert.equal((node as any).args.toString(), 'one,two', 'should be one,two');
        done();
    })
    it('handles basic arg string with spaces', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('one two');
        node.arg('three');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'one,two,three', 'should be one,two,three');
        done();
    })
    it('handles arg string with extra spaces', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('one   two');
        node.arg('three');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'one,two,three', 'should be one,two,three');
        done();
    })
    it('handles arg string with backslash', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('one two\\arg');
        node.arg('three');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'one,two\\arg,three', 'should be one,two,three');
        done();
    })
    it('handles multiple escaped backslashes', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('one "\\\\two\\arg"');
        assert.equal((node as any).args.length, 2, 'should have 2 args');
        assert.equal((node as any).args.toString(), 'one,\\\\two\\arg', 'should be one,\\\\two\\arg');
        done();
    })
    it('handles equals and switches', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo=bar -x');
        node.arg('-y');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'foo=bar,-x,-y', 'should be foo=bar,-x,-y');
        done();
    })
    it('handles double quotes', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo="bar baz" -x');
        node.arg('-y');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'foo=bar baz,-x,-y', 'should be foo=bar baz,-x,-y');
        done();
    })
    it('handles quote in double quotes', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('foo="bar \\" baz" -x');
        node.arg('-y');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), 'foo=bar " baz,-x,-y', 'should be foo=bar " baz,-x,-y');
        done();
    })
    it('handles empty string', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.line('"" -x');
        node.arg('-y');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), ',-x,-y', 'should be ,-x,-y');
        done();
    })
    it('handles literal path', function (done) {
        this.timeout(10000);

        var node = tl.tool(tl.which('node', true));
        node.arg('--path').arg('/bin/working folder1');
        assert.equal((node as any).args.length, 2, 'should have 2 args');
        assert.equal((node as any).args.toString(), '--path,/bin/working folder1', 'should be --path /bin/working folder1');
        done();
    })
    it('handles escaped quotes', function (done) {
        this.timeout(10000);
        var node = tl.tool(tl.which('node', true));
        node.line('-TEST="escaped\\\"quotes" -x');
        node.arg('-y');
        assert.equal((node as any).args.length, 3, 'should have 3 args');
        assert.equal((node as any).args.toString(), '-TEST=escaped"quotes,-x,-y', 'should be -TEST=escaped"quotes,-x,-y');
        done();        
    })
    if (process.platform != 'win32') {
        it('exec prints [command] (OSX/Linux)', function (done) {
            this.timeout(10000);
            let bash = tl.tool(tl.which('bash'))
                .arg('--norc')
                .arg('--noprofile')
                .arg('-c')
                .arg('echo hello    world');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let output = '';
            bash.on('stdout', (data) => {
                output += data.toString();
            });
            bash.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        `[command]${tl.which('bash')} --norc --noprofile -c echo hello    world`);
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'hello world');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });
    }
    else { // process.platform == 'win32'

        // --------------------------
        // exec arg tests (Windows)
        // --------------------------

        it('exec .exe AND verbatim args (Windows)', function (done) {
            this.timeout(10000);

            // the echo built-in is a good tool for this test
            let exePath = process.env.ComSpec;
            let exeRunner = tl.tool(exePath)
                .arg('/c')
                .arg('echo')
                .arg('helloworld')
                .arg('hello:"world again"');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let output = '';
            exeRunner.on('stdout', (data) => {
                output += data.toString();
            });
            exeRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        `[command]"${exePath}" /c echo helloworld hello:"world again"`);
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'helloworld hello:"world again"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('exec .exe AND arg quoting (Windows)', function (done) {
            this.timeout(10000);

            // the echo built-in is a good tool for this test
            let exePath = process.env.ComSpec;
            let exeRunner = tl.tool(exePath)
                .arg('/c')
                .arg('echo')
                .arg('helloworld')
                .arg('hello world')
                .arg('hello:"world again"')
                .arg('hello,world'); // "," should not be quoted for .exe (should be for .cmd)
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream };
            let output = '';
            exeRunner.on('stdout', (data) => {
                output += data.toString();
            });
            exeRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        '[command]' + exePath + ' /c echo'
                        + ' helloworld'
                        + ' "hello world"'
                        + ' "hello:\\"world again\\""'
                        + ' hello,world');
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'helloworld'
                        + ' "hello world"'
                        + ' "hello:\\"world again\\""'
                        + ' hello,world');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('exec .exe with space AND verbatim args (Windows)', function (done) {
            this.timeout(20000);

            // this test validates the quoting that tool runner adds around the tool path
            // when using the windowsVerbatimArguments option. otherwise the target process
            // interprets the args as starting after the first space in the tool path.
            let exePath = compileArgsExe('print args exe with spaces.exe');
            let exeRunner = tl.tool(exePath)
                .arg('myarg1 myarg2');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let output = '';
            exeRunner.on('stdout', (data) => {
                output += data.toString();
            });
            exeRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        `[command]"${exePath}" myarg1 myarg2`);
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        "args[0]: 'args'\r\n"
                        + "args[1]: 'exe'\r\n"
                        + "args[2]: 'with'\r\n"
                        + "args[3]: 'spaces.exe'\r\n"
                        + "args[4]: 'myarg1'\r\n"
                        + "args[5]: 'myarg2'");
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('exec .cmd with space AND verbatim args (Windows)', function (done) {
            this.timeout(10000);

            // this test validates the quoting that tool runner adds around the script path.
            // otherwise cmd.exe will not be able to resolve the path to the script.
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('arg1 arg2')
                .arg('arg3');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let output = '';
            cmdRunner.on('stdout', (data) => {
                output += data.toString();
            });
            cmdRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        `[command]${process.env.ComSpec} /D /S /C ""${cmdPath}" arg1 arg2 arg3"`);
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'args[0]: "arg1"\r\n'
                        + 'args[1]: "arg2"\r\n'
                        + 'args[2]: "arg3"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
        });

        it('exec .cmd with space AND arg with space (Windows)', function (done) {
            this.timeout(10000);

            // this test validates the command is wrapped in quotes (i.e. cmd.exe /S /C "<COMMAND>").
            // otherwise the leading quote (around the script with space path) would be stripped
            // and cmd.exe would not be able to resolve the script path.
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('my arg 1')
                .arg('my arg 2');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream };
            let output = '';
            cmdRunner.on('stdout', (data) => {
                output += data.toString();
            });
            cmdRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        `[command]${process.env.ComSpec} /D /S /C ""${cmdPath}" "my arg 1" "my arg 2""`);
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'args[0]: "<quote>my arg 1<quote>"\r\n'
                        + 'args[1]: "<quote>my arg 2<quote>"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                })
        });

        it('exec .cmd AND arg quoting (Windows)', function (done) {
            this.timeout(10000);

            // this test validates .cmd quoting rules are applied, not the default libuv rules
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('helloworld')
                .arg('hello world')
                .arg('hello\tworld')
                .arg('hello&world')
                .arg('hello(world')
                .arg('hello)world')
                .arg('hello[world')
                .arg('hello]world')
                .arg('hello{world')
                .arg('hello}world')
                .arg('hello^world')
                .arg('hello=world')
                .arg('hello;world')
                .arg('hello!world')
                .arg('hello\'world')
                .arg('hello+world')
                .arg('hello,world')
                .arg('hello`world')
                .arg('hello~world')
                .arg('hello|world')
                .arg('hello<world')
                .arg('hello>world')
                .arg('hello:"world again"')
                .arg('hello world\\');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream };
            let output = '';
            cmdRunner.on('stdout', (data) => {
                output += data.toString();
            });
            cmdRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        '[command]' + process.env.ComSpec + ' /D /S /C ""' + cmdPath + '"'
                        + ' helloworld'
                        + ' "hello world"'
                        + ' "hello\tworld"'
                        + ' "hello&world"'
                        + ' "hello(world"'
                        + ' "hello)world"'
                        + ' "hello[world"'
                        + ' "hello]world"'
                        + ' "hello{world"'
                        + ' "hello}world"'
                        + ' "hello^world"'
                        + ' "hello=world"'
                        + ' "hello;world"'
                        + ' "hello!world"'
                        + ' "hello\'world"'
                        + ' "hello+world"'
                        + ' "hello,world"'
                        + ' "hello`world"'
                        + ' "hello~world"'
                        + ' "hello|world"'
                        + ' "hello<world"'
                        + ' "hello>world"'
                        + ' "hello:""world again"""'
                        + ' "hello world\\\\"'
                        + '"');
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'args[0]: "helloworld"\r\n'
                        + 'args[1]: "<quote>hello world<quote>"\r\n'
                        + 'args[2]: "<quote>hello\tworld<quote>"\r\n'
                        + 'args[3]: "<quote>hello&world<quote>"\r\n'
                        + 'args[4]: "<quote>hello(world<quote>"\r\n'
                        + 'args[5]: "<quote>hello)world<quote>"\r\n'
                        + 'args[6]: "<quote>hello[world<quote>"\r\n'
                        + 'args[7]: "<quote>hello]world<quote>"\r\n'
                        + 'args[8]: "<quote>hello{world<quote>"\r\n'
                        + 'args[9]: "<quote>hello}world<quote>"\r\n'
                        + 'args[10]: "<quote>hello^world<quote>"\r\n'
                        + 'args[11]: "<quote>hello=world<quote>"\r\n'
                        + 'args[12]: "<quote>hello;world<quote>"\r\n'
                        + 'args[13]: "<quote>hello!world<quote>"\r\n'
                        + 'args[14]: "<quote>hello\'world<quote>"\r\n'
                        + 'args[15]: "<quote>hello+world<quote>"\r\n'
                        + 'args[16]: "<quote>hello,world<quote>"\r\n'
                        + 'args[17]: "<quote>hello`world<quote>"\r\n'
                        + 'args[18]: "<quote>hello~world<quote>"\r\n'
                        + 'args[19]: "<quote>hello|world<quote>"\r\n'
                        + 'args[20]: "<quote>hello<world<quote>"\r\n'
                        + 'args[21]: "<quote>hello>world<quote>"\r\n'
                        + 'args[22]: "<quote>hello:<quote><quote>world again<quote><quote><quote>"\r\n'
                        + 'args[23]: "<quote>hello world\\\\<quote>"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                })
        });

        // -------------------------------
        // exec sync arg tests (Windows)
        // -------------------------------

        it('exec sync .exe AND verbatim args (Windows)', function (done) {
            this.timeout(10000);

            // the echo built-in is a good tool for this test
            let exePath = process.env.ComSpec;
            let exeRunner = tl.tool(exePath)
                .arg('/c')
                .arg('echo')
                .arg('helloworld')
                .arg('hello:"world again"');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let result: trm.IExecSyncResult = exeRunner.execSync(options);
            assert.equal(result.code, 0, 'return code of cmd should be 0');
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                `[command]"${exePath}" /c echo helloworld hello:"world again"`);
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                'helloworld hello:"world again"');
            done();
        });

        it('exec sync .exe AND arg quoting (Windows)', function (done) {
            this.timeout(10000);

            // the echo built-in is a good tool for this test
            let exePath = process.env.ComSpec;
            let exeRunner = tl.tool(exePath)
                .arg('/c')
                .arg('echo')
                .arg('helloworld')
                .arg('hello world')
                .arg('hello:"world again"')
                .arg('hello,world'); // "," should not be quoted for .exe (should be for .cmd)
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream };
            let result: trm.IExecSyncResult = exeRunner.execSync(options);
            assert.equal(result.code, 0, 'return code of cmd should be 0');
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                '[command]' + exePath + ' /c echo'
                + ' helloworld'
                + ' "hello world"'
                + ' "hello:\\"world again\\""'
                + ' hello,world');
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                'helloworld'
                + ' "hello world"'
                + ' "hello:\\"world again\\""'
                + ' hello,world');
            done();
        });

        it('exec sync .exe with space AND verbatim args (Windows)', function (done) {
            this.timeout(20000);

            // this test validates the quoting that tool runner adds around the tool path
            // when using the windowsVerbatimArguments option. otherwise the target process
            // interprets the args as starting after the first space in the tool path.
            let exePath = compileArgsExe('print args exe with spaces.exe');
            let exeRunner = tl.tool(exePath)
                .arg('myarg1 myarg2');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let result: trm.IExecSyncResult = exeRunner.execSync(options);
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                `[command]"${exePath}" myarg1 myarg2`);
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                "args[0]: 'args'\r\n"
                + "args[1]: 'exe'\r\n"
                + "args[2]: 'with'\r\n"
                + "args[3]: 'spaces.exe'\r\n"
                + "args[4]: 'myarg1'\r\n"
                + "args[5]: 'myarg2'")
            done();
        });

        it('exec sync .cmd with space AND verbatim args (Windows)', function (done) {
            this.timeout(10000);

            // this test validates the quoting that tool runner adds around the script path.
            // otherwise cmd.exe will not be able to resolve the path to the script.
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('arg1 arg2')
                .arg('arg3');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let result: trm.IExecSyncResult = cmdRunner.execSync(options);
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                `[command]${process.env.ComSpec} /D /S /C ""${cmdPath}" arg1 arg2 arg3"`);
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                'args[0]: "arg1"\r\n'
                + 'args[1]: "arg2"\r\n'
                + 'args[2]: "arg3"');
            done();
        });

        it('exec sync .cmd with space AND arg with space (Windows)', function (done) {
            this.timeout(10000);

            // this test validates the command is wrapped in quotes (i.e. cmd.exe /S /C "<COMMAND>").
            // otherwise the leading quote (around the script with space path) would be stripped
            // and cmd.exe would not be able to resolve the script path.
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('my arg 1')
                .arg('my arg 2');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream };
            let result: trm.IExecSyncResult = cmdRunner.execSync(options);
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                `[command]${process.env.ComSpec} /D /S /C ""${cmdPath}" "my arg 1" "my arg 2""`);
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                'args[0]: "<quote>my arg 1<quote>"\r\n'
                + 'args[1]: "<quote>my arg 2<quote>"');
            done();
        });

        it('exec sync .cmd AND arg quoting (Windows)', function (done) {
            this.timeout(10000);

            // this test validates .cmd quoting rules are applied, not the default libuv rules
            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('helloworld')
                .arg('hello world')
                .arg('hello\tworld')
                .arg('hello&world')
                .arg('hello(world')
                .arg('hello)world')
                .arg('hello[world')
                .arg('hello]world')
                .arg('hello{world')
                .arg('hello}world')
                .arg('hello^world')
                .arg('hello=world')
                .arg('hello;world')
                .arg('hello!world')
                .arg('hello\'world')
                .arg('hello+world')
                .arg('hello,world')
                .arg('hello`world')
                .arg('hello~world')
                .arg('hello|world')
                .arg('hello<world')
                .arg('hello>world')
                .arg('hello:"world again"')
                .arg('hello world\\');
            let outStream = testutil.createStringStream();
            let options = <trm.IExecSyncOptions>{ outStream: <stream.Writable>outStream };
            let result: trm.IExecSyncResult = cmdRunner.execSync(options);
            // validate the [command] header
            assert.equal(
                outStream.getContents().split(os.EOL)[0],
                '[command]' + process.env.ComSpec + ' /D /S /C ""' + cmdPath + '"'
                + ' helloworld'
                + ' "hello world"'
                + ' "hello\tworld"'
                + ' "hello&world"'
                + ' "hello(world"'
                + ' "hello)world"'
                + ' "hello[world"'
                + ' "hello]world"'
                + ' "hello{world"'
                + ' "hello}world"'
                + ' "hello^world"'
                + ' "hello=world"'
                + ' "hello;world"'
                + ' "hello!world"'
                + ' "hello\'world"'
                + ' "hello+world"'
                + ' "hello,world"'
                + ' "hello`world"'
                + ' "hello~world"'
                + ' "hello|world"'
                + ' "hello<world"'
                + ' "hello>world"'
                + ' "hello:""world again"""'
                + ' "hello world\\\\"'
                + '"');
            // validate stdout
            assert.equal(
                result.stdout.trim(),
                'args[0]: "helloworld"\r\n'
                + 'args[1]: "<quote>hello world<quote>"\r\n'
                + 'args[2]: "<quote>hello\tworld<quote>"\r\n'
                + 'args[3]: "<quote>hello&world<quote>"\r\n'
                + 'args[4]: "<quote>hello(world<quote>"\r\n'
                + 'args[5]: "<quote>hello)world<quote>"\r\n'
                + 'args[6]: "<quote>hello[world<quote>"\r\n'
                + 'args[7]: "<quote>hello]world<quote>"\r\n'
                + 'args[8]: "<quote>hello{world<quote>"\r\n'
                + 'args[9]: "<quote>hello}world<quote>"\r\n'
                + 'args[10]: "<quote>hello^world<quote>"\r\n'
                + 'args[11]: "<quote>hello=world<quote>"\r\n'
                + 'args[12]: "<quote>hello;world<quote>"\r\n'
                + 'args[13]: "<quote>hello!world<quote>"\r\n'
                + 'args[14]: "<quote>hello\'world<quote>"\r\n'
                + 'args[15]: "<quote>hello+world<quote>"\r\n'
                + 'args[16]: "<quote>hello,world<quote>"\r\n'
                + 'args[17]: "<quote>hello`world<quote>"\r\n'
                + 'args[18]: "<quote>hello~world<quote>"\r\n'
                + 'args[19]: "<quote>hello|world<quote>"\r\n'
                + 'args[20]: "<quote>hello<world<quote>"\r\n'
                + 'args[21]: "<quote>hello>world<quote>"\r\n'
                + 'args[22]: "<quote>hello:<quote><quote>world again<quote><quote><quote>"\r\n'
                + 'args[23]: "<quote>hello world\\\\<quote>"');
            done();
        });

        // -------------------------------
        // exec pipe arg tests (Windows)
        // -------------------------------

        it('exec pipe .cmd to .exe AND arg quoting (Windows)', function (done) {
            this.timeout(10000);

            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('"hello world"');

            let exePath = path.join(process.env.windir, 'System32', 'find.exe');
            let exeRunner = tl.tool(exePath)
                .arg('hello world');

            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream };
            let output = '';
            cmdRunner.on('stdout', (data) => {
                output += data.toString();
            });
            cmdRunner.pipeExecOutputToTool(exeRunner);
            cmdRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        '[command]' + process.env.ComSpec + ' /D /S /C ""' + cmdPath + '" """hello world""""'
                        + ' | ' + exePath + ' "hello world"');
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'args[0]: "<quote><quote><quote>hello world<quote><quote><quote>"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                })
        });

        it('exec pipe .cmd to .exe AND verbatim args (Windows)', function (done) {
            this.timeout(10000);

            let cmdPath = path.join(__dirname, 'scripts', 'print args cmd with spaces.cmd');
            let cmdRunner = tl.tool(cmdPath)
                .arg('hello world');

            let exePath = path.join(process.env.windir, 'System32', 'find.exe');
            let exeRunner = tl.tool(exePath)
                .arg('"world"');

            let outStream = testutil.createStringStream();
            let options = <trm.IExecOptions>{ outStream: <stream.Writable>outStream, windowsVerbatimArguments: true };
            let output = '';
            cmdRunner.on('stdout', (data) => {
                output += data.toString();
            });
            cmdRunner.pipeExecOutputToTool(exeRunner);
            cmdRunner.exec(options)
                .then(function (code) {
                    assert.equal(code, 0, 'return code should be 0');
                    // validate the [command] header
                    assert.equal(
                        outStream.getContents().split(os.EOL)[0],
                        '[command]' + process.env.ComSpec + ' /D /S /C ""' + cmdPath + '" hello world"'
                        + ' | "' + exePath + '" "world"');
                    // validate stdout
                    assert.equal(
                        output.trim(),
                        'args[1]: "world"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                })
        });

        // --------------------------------------
        // arg quoting function tests (Windows)
        // --------------------------------------

        it('_windowsQuoteCmdArg quotes .exe args (Windows)', function (done) {
            this.timeout(10000);

            // create a .exe file
            let testPath = path.join(testutil.getTestTemp(), 'which-finds-file-name');
            tl.mkdirP(testPath);
            let filePath = path.join(testPath, 'some.exe');
            fs.writeFileSync(filePath, '');

            let tr: any = tl.tool(filePath);

            // ---------------------------------------------
            // libuv quoting rules should applied for .exe
            // ---------------------------------------------

            // need double quotation for empty argument
            assert.equal(tr._windowsQuoteCmdArg(''), '""');

            // no quotation needed
            assert.equal(tr._windowsQuoteCmdArg('hello'), 'hello');

            // space and tab should be quoted
            assert.equal(tr._windowsQuoteCmdArg('hello world'), '"hello world"');
            assert.equal(tr._windowsQuoteCmdArg('hello\tworld'), '"hello\tworld"');

            // slash not preceeding a quote should not be doubled
            assert.equal(tr._windowsQuoteCmdArg('hello \\world'), '"hello \\world"');

            // --------------------------------------------------------------------------
            // the following test cases are based on the comments in the UV source code
            // --------------------------------------------------------------------------

            // input : hello"world
            // output: "hello\"world"
            assert.equal(tr._windowsQuoteCmdArg('hello"world'), '"hello\\"world"');

            // input : hello""world
            // output: "hello\"\"world"
            assert.equal(tr._windowsQuoteCmdArg('hello""world'), '"hello\\"\\"world"');

            // input : hello\world
            // output: hello\world
            assert.equal(tr._windowsQuoteCmdArg('hello\\world'), 'hello\\world');

            // input : hello\\world
            // output: hello\\world
            assert.equal(tr._windowsQuoteCmdArg('hello\\\\world'), 'hello\\\\world');

            // input : hello\"world
            // output: "hello\\\"world"
            assert.equal(tr._windowsQuoteCmdArg('hello\\"world'), '"hello\\\\\\"world"');

            // input : hello\\"world
            // output: "hello\\\\\"world"
            assert.equal(tr._windowsQuoteCmdArg('hello\\\\"world'), '"hello\\\\\\\\\\"world"');

            // input : hello world\
            // output: "hello world\\" - note the comment actually reads: "hello world\"
            //                           so it is either a bug in UV or the comment is wrong.
            assert.equal(tr._windowsQuoteCmdArg('hello world\\'), '"hello world\\\\"');

            // --------------------------------------------------
            // cmd.exe special character rules should not apply
            // --------------------------------------------------

            // rules for cmd.exe special characters rules should not apply since the
            // supplied tool path is not a .cmd
            assert.equal(tr._windowsQuoteCmdArg('hello&world'), 'hello&world');
            assert.equal(tr._windowsQuoteCmdArg('hello(world'), 'hello(world');
            assert.equal(tr._windowsQuoteCmdArg('hello)world'), 'hello)world');
            assert.equal(tr._windowsQuoteCmdArg('hello[world'), 'hello[world');
            assert.equal(tr._windowsQuoteCmdArg('hello]world'), 'hello]world');
            assert.equal(tr._windowsQuoteCmdArg('hello{world'), 'hello{world');
            assert.equal(tr._windowsQuoteCmdArg('hello}world'), 'hello}world');
            assert.equal(tr._windowsQuoteCmdArg('hello^world'), 'hello^world');
            assert.equal(tr._windowsQuoteCmdArg('hello=world'), 'hello=world');
            assert.equal(tr._windowsQuoteCmdArg('hello;world'), 'hello;world');
            assert.equal(tr._windowsQuoteCmdArg('hello!world'), 'hello!world');
            assert.equal(tr._windowsQuoteCmdArg('hello\'world'), 'hello\'world');
            assert.equal(tr._windowsQuoteCmdArg('hello+world'), 'hello+world');
            assert.equal(tr._windowsQuoteCmdArg('hello,world'), 'hello,world');
            assert.equal(tr._windowsQuoteCmdArg('hello`world'), 'hello`world');
            assert.equal(tr._windowsQuoteCmdArg('hello~world'), 'hello~world');
            assert.equal(tr._windowsQuoteCmdArg('hello|world'), 'hello|world');
            assert.equal(tr._windowsQuoteCmdArg('hello<world'), 'hello<world');
            assert.equal(tr._windowsQuoteCmdArg('hello>world'), 'hello>world');

            done();
        });

        it('_windowsQuoteCmdArg quotes .cmd args (Windows)', function (done) {
            this.timeout(10000);

            // create a .cmd file
            let testPath = path.join(testutil.getTestTemp(), 'which-finds-file-name');
            tl.mkdirP(testPath);
            let filePath = path.join(testPath, 'some.cmd');
            fs.writeFileSync(filePath, '');

            let tr: any = tl.tool(filePath);

            // ---------------------------------------------------------------
            // cmd.exe command line quoting rules should be applied for .cmd
            // ---------------------------------------------------------------

            // need double quotation for empty argument
            assert.equal(tr._windowsQuoteCmdArg(''), '""');

            // no quotation needed
            assert.equal(tr._windowsQuoteCmdArg('hello'), 'hello');

            // quotes should be doubled
            assert.equal(tr._windowsQuoteCmdArg('hello"world'), '"hello""world"');
            assert.equal(tr._windowsQuoteCmdArg('hello:"world again"'), '"hello:""world again"""');

            // slashes preceeding a quote should be doubled, otherwise not doubled
            assert.equal(tr._windowsQuoteCmdArg('helloworld\\'), 'helloworld\\');
            assert.equal(tr._windowsQuoteCmdArg('hello \\world'), '"hello \\world"');
            assert.equal(tr._windowsQuoteCmdArg('hello world\\'), '"hello world\\\\"');
            assert.equal(tr._windowsQuoteCmdArg('hello\\"world'), '"hello\\\\""world"');
            assert.equal(tr._windowsQuoteCmdArg('h\\ello\\\\"worl\\d'), '"h\\ello\\\\\\\\""worl\\d"');

            // cmd.exe special characters should be quoted
            assert.equal(tr._windowsQuoteCmdArg('hello world'), '"hello world"');
            assert.equal(tr._windowsQuoteCmdArg('hello\tworld'), '"hello\tworld"');
            assert.equal(tr._windowsQuoteCmdArg('hello&world'), '"hello&world"');
            assert.equal(tr._windowsQuoteCmdArg('hello(world'), '"hello(world"');
            assert.equal(tr._windowsQuoteCmdArg('hello)world'), '"hello)world"');
            assert.equal(tr._windowsQuoteCmdArg('hello[world'), '"hello[world"');
            assert.equal(tr._windowsQuoteCmdArg('hello]world'), '"hello]world"');
            assert.equal(tr._windowsQuoteCmdArg('hello{world'), '"hello{world"');
            assert.equal(tr._windowsQuoteCmdArg('hello}world'), '"hello}world"');
            assert.equal(tr._windowsQuoteCmdArg('hello^world'), '"hello^world"');
            assert.equal(tr._windowsQuoteCmdArg('hello=world'), '"hello=world"');
            assert.equal(tr._windowsQuoteCmdArg('hello;world'), '"hello;world"');
            assert.equal(tr._windowsQuoteCmdArg('hello!world'), '"hello!world"');
            assert.equal(tr._windowsQuoteCmdArg('hello\'world'), '"hello\'world"');
            assert.equal(tr._windowsQuoteCmdArg('hello+world'), '"hello+world"');
            assert.equal(tr._windowsQuoteCmdArg('hello,world'), '"hello,world"');
            assert.equal(tr._windowsQuoteCmdArg('hello`world'), '"hello`world"');
            assert.equal(tr._windowsQuoteCmdArg('hello~world'), '"hello~world"');
            assert.equal(tr._windowsQuoteCmdArg('hello|world'), '"hello|world"');
            assert.equal(tr._windowsQuoteCmdArg('hello<world'), '"hello<world"');
            assert.equal(tr._windowsQuoteCmdArg('hello>world'), '"hello>world"');
            assert.equal(tr._windowsQuoteCmdArg('hello"world'), '"hello""world"');

            done();
        });

        it('_windowsQuoteCmdArg quotes .bat args (Windows)', function (done) {
            this.timeout(10000);

            // create a .bat file
            let testPath = path.join(testutil.getTestTemp(), 'which-finds-file-name');
            tl.mkdirP(testPath);
            let filePath = path.join(testPath, 'some.bat');
            fs.writeFileSync(filePath, '');

            // cmd.exe command line quoting rules should be applied for .bat
            let tr: any = tl.tool(filePath);
            assert.equal(tr._windowsQuoteCmdArg('hello:"world again"'), '"hello:""world again"""');
            assert.equal(tr._windowsQuoteCmdArg('hello|world'), '"hello|world"');

            done();
        });
    }

    // function to compile a .NET program on Windows.
    let compileExe = (sourceFileName: string, targetFileName: string): string => {
        let directory = path.join(testutil.getTestTemp(), sourceFileName);
        tl.mkdirP(directory);
        let exePath = path.join(directory, targetFileName);

        // short-circuit if already compiled
        try {
            fs.statSync(exePath);
            return exePath;
        }
        catch (err) {
            if (err.code != 'ENOENT') {
                throw err;
            }
        }

        let sourceFile = path.join(__dirname, 'scripts', sourceFileName);
        let cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
        fs.statSync(cscPath);
        child_process.execFileSync(
            cscPath,
            [
                '/target:exe',
                `/out:${exePath}`,
                sourceFile
            ]);
        return exePath;
    }

    describe('Executing inside shell', function () {

        let tempPath: string = testutil.getTestTemp();
        let _testExecOptions: trm.IExecOptions;

        before (function () {
            _testExecOptions = <trm.IExecOptions>{
                cwd: __dirname,
                env: {
                    WIN_TEST: 'test value',
                    TESTPATH: tempPath,
                    TEST_NODE: 'node',
                    TEST: 'test value'
                },
                silent: false,
                failOnStdErr: false,
                ignoreReturnCode: false,
                shell: true,
                outStream: testutil.getNullStream(),
                errStream: testutil.getNullStream()
            };

        })

        it('Exec sync inside shell', function (done) {
            this.timeout(10000);

            if (os.platform() === 'win32') {
                let exePath = compileArgsExe('print args with spaces.exe');
                let exeRunner = tl.tool(exePath);
                exeRunner.line('%WIN_TEST%')
                var ret = exeRunner.execSync(_testExecOptions);
                assert.equal(ret.code, 0, 'return code of cmd should be 0');
                assert.equal(ret.stdout.trim(), 'args[0]: \'test value\'', 'Command should return \"args[0]: \'test value\'\"');
            }
            else {
                var ret = tl.execSync('stat', '$TESTPATH', _testExecOptions);
                assert.equal(ret.code, 0, 'return code of stat should be 0');
                assert(ret.stdout.includes(tempPath), `Result should include \'${tempPath}\'`);
            }

            assert(ret.stdout && ret.stdout.length > 0, 'should have emitted stdout');
            done();
        });
        it('Exec inside shell', function (done) {
            this.timeout(10000);

            let output: string = '';
            if (os.platform() === 'win32') {
                let exePath = compileArgsExe('print args with spaces.exe');
                let exeRunner = tl.tool(exePath);
                exeRunner.line('%WIN_TEST%');
                exeRunner.on('stdout', (data) => {
                    output = data.toString();
                });
                exeRunner.exec(_testExecOptions).then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    assert.equal(output.trim(), 'args[0]: \'test value\'', 'Command should return \"args[0]: \'test value\'\"');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
            }
            else {
                let statRunner = tl.tool('stat');
                statRunner.line('$TESTPATH');
                statRunner.on('stdout', (data) => {
                    output = data.toString();
                });
                statRunner.exec(_testExecOptions).then(function (code) {
                    assert.equal(code, 0, 'return code of stat should be 0');
                    assert(output.includes(tempPath), `Result should include \'${tempPath}\'`);
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
            }
        });
        it('Exec pipe output to another tool inside shell, succeeds if both tools succeed', function (done) {
            this.timeout(30000);

            if (os.platform() === 'win32') {
                const matchExe = tl.tool(compileMatchExe())
                    .arg('0') // exit code
                    .arg('test value'); // match value
                const outputExe = tl.tool(compileOutputExe())
                    .arg('0') // exit code
                    .arg('line 1')
                    .arg('"%WIN_TEST%"')
                    .arg('line 3');
                outputExe.pipeExecOutputToTool(matchExe);

                let output = '';
                outputExe.on('stdout', (data) => {
                    output += data.toString();
                });

                outputExe.exec(_testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of exec should be 0');
                        assert(output && output.length > 0 && output.indexOf('test value') >= 0, 'should have emitted stdout ' + output);
                        done();
                    })
                    .catch(function (err) {
                        done(err);
                    });
            }
            else {
                const grep = tl.tool(tl.which('grep', true));
                grep.arg('$TEST_NODE');

                const ps = tl.tool(tl.which('ps', true));
                ps.arg('ax');
                ps.pipeExecOutputToTool(grep);

                let output = '';
                ps.on('stdout', (data) => {
                    output += data.toString();
                });

                ps.exec(_testExecOptions)
                    .then(function (code) {
                        assert.equal(code, 0, 'return code of exec should be 0');
                        assert(output && output.length > 0 && output.indexOf('node') >= 0, 'should have emitted stdout ' + output);
                        done();
                    })
                    .catch(function (err) {
                        done(err);
                    });
            }
        });
        it('Should handle arguments with quotes properly', function (done) {
            this.timeout(10000);

            let output: string = '';
            if (os.platform() === 'win32') {
                let exePath = compileArgsExe('print args with spaces.exe');
                let exeRunner = tl.tool(exePath);
                exeRunner.line('-TEST1="space test" "-TEST2=%WIN_TEST%" \'-TEST3=value\'');
                exeRunner.on('stdout', (data) => {
                    output += data.toString();
                });
                exeRunner.exec(_testExecOptions).then(function (code) {
                    assert.equal(code, 0, 'return code of cmd should be 0');
                    assert.equal(output.trim(), 'args[0]: \'-TEST1=space test\'\r\n'
                        + 'args[1]: \'-TEST2=test value\'\r\n'
                        + 'args[2]: \'\'-TEST3=value\'\'');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
            }
            else {
                let statRunner = tl.tool('echo');
                statRunner.line('-TEST1="$TEST;test" "-TEST2=/one/two/three" \'-TEST3=out:$TEST\'');
                statRunner.on('stdout', (data) => {
                    output = data.toString();
                });
                statRunner.exec(_testExecOptions).then(function (code) {
                    assert.equal(code, 0, 'return code of stat should be 0');
                    assert.equal(output, '-TEST1=test value;test -TEST2=/one/two/three -TEST3=out:$TEST\n');
                    done();
                })
                .catch(function (err) {
                    done(err);
                });
            }
        });
    })

    // function to compile a .NET program that prints the command line args.
    // the helper program is used to validate that command line args are passed correctly.
    let compileArgsExe = (targetFileName: string): string => {
        return compileExe('print-args-exe.cs', targetFileName);
    }

    // function to compile a .NET program that matches input lines.
    // the helper program is used on Windows to validate piping output between tools.
    let compileMatchExe = (): string => {
        return compileExe('match-input-exe.cs', 'match-input.exe');
    }

    // function to compile a .NET program that prints lines.
    // the helper program is used on Windows to validate piping output between tools.
    let compileOutputExe = (): string => {
        return compileExe('print-output-exe.cs', 'print-output.exe');
    }
});
