import ma = require('vsts-task-lib/mock-answer');
export var gulpGlobalGood: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "gulp": "/usr/local/bin/gulp",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/gulp --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        }
    },
    "checkPath": {
        "/usr/local/bin/gulp": true,
        "/usr/local/bin/node": true,
        "gulpfile.js": true
    },
    "exist": {
        "/usr/local/bin/gulp": true
    },
    "findMatch": {
        "**/*.js": [
            "/test/test.js"
        ],
        "gulpfile.js": [
            "gulpfile.js"
        ],
        "/invalid/input": []
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "/user/build"
    }
}

export var gulpLocalGood: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/node /fake/wd/node_modules/gulp/gulp.js --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        },
        "/usr/local/bin/node c:\\fake\\wd\\node_modules\\gulp\\gulp.js --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        }
    },
    "checkPath": {
        "/usr/local/bin/node": true,
        "gulpfile.js": true
    },
    "exist": {
        "/fake/wd/node_modules/gulp/gulp.js": true,
        "c:\\fake\\wd\\node_modules\\gulp\\gulp.js": true
    },
    "findMatch": {
        "gulpfile.js": [
            "gulpfile.js"
        ]
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "/user/build"
    }
}

export var gulpNoGulpFile: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "gulp": "/usr/local/bin/gulp",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/gulp --gulpfile gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        }
    },
    "checkPath": {
        "/usr/local/bin/gulp": true,
        "/usr/local/bin/node": true,
        "gulpfile.js": false
    },
    "findMatch": {
        "gulpfile.js": []
    },
    "exist": {
        "/usr/local/bin/gulp": true
    }
}

export var gulpNoGulp: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "node": "/usr/local/bin/node"
    },
    "checkPath": {
        "/usr/local/bin/node": true,
        "gulpfile.js": true
    },
    "findMatch": {
        "gulpfile.js": [
            "gulpfile.js"
        ]
    }
}

export var gulpFail: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "gulp": "/usr/local/bin/gulp",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/gulp --gulpfile gulpfile.js": {
            "code": 1,
            "stdout": "gulp output here",
            "stderr": "gulp failed with this output"
        }
    },
    "checkPath": {
        "/usr/local/bin/gulp": true,
        "/usr/local/bin/node": true,
        "gulpfile.js": true
    },
    "exist": {
        "/usr/local/bin/gulp": true
    },
    "findMatch": {
        "gulpfile.js": [
            "gulpfile.js"
        ]
    }
}

export var gulpMultipleGulpFiles: ma.TaskLibAnswers = <ma.TaskLibAnswers>{
    "which": {
        "gulp": "/usr/local/bin/gulp",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/gulp --gulpfile /user/build/one/gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        },
        "/usr/local/bin/gulp --gulpfile /user/build/two/gulpfile.js": {
            "code": 0,
            "stdout": "gulp output here"
        }
    },
    "checkPath": {
        "/usr/local/bin/gulp": true,
        "/usr/local/bin/node": true,
        "/user/build/one/gulpfile.js": true,
        "/user/build/two/gulpfile.js": true
    },
    "exist": {
        "/usr/local/bin/gulp": true
    },
    "match": {
        "**/*.js": [
            "/test/test.js"
        ]
    },
    "findMatch": {
        "**/gulpfile.js": [
            "/user/build/one/gulpfile.js",
            "/user/build/two/gulpfile.js"
        ],
        "**/*.js": [
            "/test/test.js"
        ]
    },
    "getVariable": {
        "System.DefaultWorkingDirectory": "/user/build"
    }
}