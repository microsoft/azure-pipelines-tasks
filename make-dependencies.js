var dependencies = {
    node: {
        versionArguments: "-v",
        validate: function (output) {
            if (semver.lt(output, '6.10.3')) {
                fail('requires node >= 6.10.3');
            }
        }
    },
    npm: function (output) {
        if (semver.lt(output, '5.6.0')) {
            fail('Expected 5.6.0 or higher. To fix, run: npm install -g npm');
        }
    },
    tsc: "Version 2.3.4",
    mocha: "6.2.3"
}

module.exports = dependencies;