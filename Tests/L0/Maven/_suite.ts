/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Maven Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function() {

    });

    it('run maven with all default inputs and M2_HOME not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with all default inputs and M2_HOME set', (done) => {
        setResponseFile('responseM2_HOME.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        process.env['M2_HOME'] = '/anotherHome/bin/maven/bin/mvn';

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        //tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenVersionSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with INVALID mavenVersionSelection', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath valid)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath missing)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: mavenPath') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenVersionSelection set to Path (mavenPath INVALID)', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven333')
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('not found mavenPath:') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to garbage', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'garbage');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with mavenSetM2Home set to true', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Path');
        tr.setInput('mavenPath', '/home/bin/maven2') // Make that checkPath returns true for this filename in the response file
        tr.setInput('mavenSetM2Home', 'true');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven2/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven2/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set M2_HOME=/home/bin/maven2') >= 0, 'M2_HOME not set');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with options set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p "/t:i o" /n /s');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t:i o /n /s package'), 'it should have run mvn -f pom.xml /o /p /t:i o /n /s package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with goals not set', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        //tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: goals') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with tasks set to multiple', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with missing publishJUnitResults input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with publishJUnitResults set to "garbage"', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '/o /p /t /i /o /n /s');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml /o /p /t /i /o /n /s build test package'), 'it should have run mvn -f pom.xml /o /p /t /i /o /n /s build test package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven and publish tests', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('##vso[results.publish type=JUnit;mergeResults=true;publishRunAttachments=true;resultFiles=/user/build/fun/test-123.xml;]') >= 0, 'test files not published');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing testResultsFiles input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'build test package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: testResultsFiles') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('fails if missing javaHomeSelection input', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        //tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stderr.indexOf('Input required: javaHomeSelection') >= 0, 'wrong error message: "' + tr.stderr + '"');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with jdkVersion set to 1.8', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.8');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.indexOf('set JAVA_HOME=/user/local/bin/Java8') >= 0, 'JAVA_HOME not set correctly');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with jdkVersion set to 1.5', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('publishJUnitResults', 'garbage');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('jdkVersion', '1.5');
        tr.setInput('jdkArchitecture', 'x86');

        tr.run()
            .then(() => {
                assert(tr.invokedToolCount == 0, 'should not have run maven');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('Failed to find specified JDK version') >= 0, 'JAVA_HOME set?');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven with Valid inputs but it fails', (done) => {
        setResponseFile('response.json');

        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'FAIL package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml FAIL package'), 'it should have run mvn -f pom.xml FAIL package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.failed, 'task should have failed');
                assert(tr.stdout.indexOf('FAILED') >= 0, 'It should have failed');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven including SonarQube analysis', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('run maven including SonarQube analysis (with db details)', (done) => {
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'Default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('publishJUnitResults', 'false');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');
        tr.setInput('sqDbDetailsRequired', 'true');
        tr.setInput('sqDbUrl', 'dbURL');
        tr.setInput('sqDbUsername', 'dbUser');
        tr.setInput('sqDbPassword', 'dbPass');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jdbc.url=dbURL -Dsonar.jdbc.username=dbUser -Dsonar.jdbc.password=dbPass -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('maven calls enable code coverage and publish code coverage when jacoco is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage , publish code coverage and sonar analysis when jacoco  and sonar analysis is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -Dsonar.jacoco.reportPath=CCReport43F6D5EF\/jacoco.exec -f pom.xml sonar:sonar'), 'it should have run SQ analysis');               
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 4, 'should have only run maven 4 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when jacoco is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml jacoco:report'), 'it should have run mvn -f pom.xml jacoco:report');
                // calls maven to generate cc report.
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=CCReport43F6D5EF\/jacoco.xml;reportdirectory=CCReport43F6D5EF;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=JaCoCo;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })


    it('maven calls enable code coverage and publish code coverage when cobertura is selected', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage , publish code coverage and sonar analysis when cobertura is selected and sonar analysis enabled', (done) => {
        setResponseFile('responseCodeCoverage.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');
        tr.setInput('sqAnalysisEnabled', 'true');
        tr.setInput('sqConnectedServiceName', 'ID1');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.ran('/home/bin/maven/bin/mvn -Dsonar.host.url=http://sonarqube/end/point -Dsonar.login=uname -Dsonar.password=pword -f pom.xml sonar:sonar'), 'it should have run SQ analysis');
                assert(tr.invokedToolCount == 3, 'should have only run maven 3 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;\]/) >= 0, 'should have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })

    it('maven calls enable code coverage and not publish code coverage when cobertura is selected and report generation failed', (done) => {
        setResponseFile('response.json');
        var tr = new trm.TaskRunner('maven', true);
        tr.setInput('mavenVersionSelection', 'default');
        tr.setInput('mavenPOMFile', 'pom.xml'); // Make that checkPath returns true for this filename in the response file
        tr.setInput('options', '');
        tr.setInput('goals', 'package');
        tr.setInput('javaHomeSelection', 'JDKVersion');
        tr.setInput('jdkVersion', 'default');
        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('publishJUnitResults', 'true');
        tr.setInput('testResultsFiles', '**/TEST-*.xml');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/maven/bin/mvn -version'), 'it should have run mvn -version');
                assert(tr.ran('/home/bin/maven/bin/mvn -f pom.xml package'), 'it should have run mvn -f pom.xml package');
                assert(tr.invokedToolCount == 2, 'should have only run maven 2 times');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stdout.search(/##vso\[codecoverage.enable buildfile=pom.xml;summaryfile=target\/site\/cobertura\/coverage.xml;reportdirectory=target\/site\/cobertura;reportbuildfile=CCReportPomA4D283EG.xml;buildtool=Maven;codecoveragetool=Cobertura;\]/) >= 0, 'should have called enable code coverage.');
                assert(tr.stdout.search(/##vso\[codecoverage.publish\]/) < 0, 'should not have called publish code coverage.');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                assert.fail("should not have thrown error");
                done(err);
            });
    })
});