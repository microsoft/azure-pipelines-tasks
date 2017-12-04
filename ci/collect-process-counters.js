var ncp = require('child_process');
var path = require('path');

var run = function (cl) {
    console.log();
    console.log('> ' + cl);
    var options = {
        stdio: 'inherit'
    };
    var rc = 0;
    try {
        ncp.execSync(cl, options);
    }
    catch (err) {
    }
}

describe('Monitor Processes Suite', function () {
    this.timeout(60000);

    it('Monitor Processes', (done) => {
        this.timeout(60000);

        // remove any previously created collector
        var logmanPath = 'C:\\Windows\\System32\\logman.exe';
        console.log('Deleting collector');
        var collectorName = 'vsts-tasks-processes';
        run(`${logmanPath} delete -n ${collectorName}`);

        // create the collector
        console.log('Creating collector');
        var counters = [
            '\\Process(*)\\% Processor Time',
            '\\Process(*)\\Creating Process ID',
            '\\Process(*)\\Handle Count',
            '\\Process(*)\\Elapsed Time',
            '\\Process(*)\\ID Process',
            '\\Process(*)\\IO Read Bytes/sec',
            '\\Process(*)\\IO Write Bytes/sec',
            '\\Process(*)\\Page Faults/sec',
            '\\Process(*)\\Thread Count',
            '\\Process(*)\\Working Set'
        ];
        counters = counters.map(function (val) { return '"' + val + '"'}).join(' ');
        var sampleInterval = '1'; // 1 second
        var maxSize = '1000'; // 1,000 mb
        var jobName = process.env.SYSTEM_JOBDISPLAYNAME;
        // the script is copied to _build/Tasks when it is run, so outputFile needs to be
        // relative from that directory
        var outputFile = path.join(__dirname, '..', '..', `process-monitors-${jobName}`);
        run(`${logmanPath} create counter -n ${collectorName} -c ${counters} -o ${outputFile} -v nnnnnn -f bin -a -max ${maxSize}`);

        // start the collector
        console.log('Starting collector');
        run(`${logmanPath} start -n ${collectorName}`);

        // wait 20 seconds
        run('ping -n 20 127.0.0.1');

        // stop the collector
        console.log('Stopping collector');
        run(`${logmanPath} stop -n ${collectorName}`);

        done();
    });
});
