import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';

export const emptyAnswers: TaskLibAnswers = <TaskLibAnswers>{
    "getVariable": {
        "System.DefaultWorkingDirectory": "/someDir"
    },
    "find": {
    },
    "findMatch": {
        "/user/admin/summary.xml": []
    },
    "exist": {
        "/user/admin/summary.xml": false
    }
};

export const noncoreAnswers: TaskLibAnswers = <TaskLibAnswers>{
    "getVariable": {
        "System.DefaultWorkingDirectory": "/someDir",
        "ignore.coverage.autogenerate": true
    },
    "find": {
        "/someDir": [
            "someDir/someFile2",
            "/someDir/someFile1"
        ]
    },
    "exist": {
        "/user/admin/summary.xml": true
    },
    "which": {
        "dotnet": null
    },
    "findMatch": {
        "/user/admin/summary.xml": [
            "/user/admin/summary.xml"
        ],
        "/some/*pattern": [
            "some/path",
            "some/path/one",
            "some/path/two"
        ],
        "/some/*pattern/path": [
            "some/path"
        ],
        "/some/*pattern/one": [
            "some/path/one"
        ],
        "/other/*pattern": [],
        "/user/admin/report": [
            "user/admin/report"
        ]
    },
    "stats": {
        "some/path": {
            "isFile": false
        },
        "some/path/one": {
            "isFile": true
        },
        "some/path/two": {
            "isFile": true
        },
        "/tmp/sources": {
            "isDirectory": true
        }
    }
};

export const defaultAnswers: TaskLibAnswers = <TaskLibAnswers> {
    "getVariable": {
        "System.DefaultWorkingDirectory": "/someDir",
        "ignore.coverage.autogenerate": true,
        "Agent.TempDirectory": '/someDir'
    },
    "find": {
        "/someDir": [
            "someDir/someFile2",
            "/someDir/someFile1"
        ],
        "\\user\\admin\\summary.xml": [
            "/user/admin/summary.xml"
        ]
    },
    "exist": {
        "/user/admin/summary.xml": true
    },
    "which": {
        "dotnet": "/tmp/dotnet"
    },
    "findMatch": {
        "\\user\\admin\\summary.xml": [
            "/user/admin/summary.xml"
        ],
        "/user/admin/summary.xml": [
            "/user/admin/summary.xml"
        ],
        "/some/*pattern": [
            "some/path",
            "some/path/one",
            "some/path/two"
        ],
        "/some/*pattern/path": [
            "some/path"
        ],
        "/some/*pattern/one": [
            "some/path/one"
        ],
        "/other/*pattern": [],
        "/user/admin/report": [
            "user/admin/report"
        ]
    },
    "findPath": {
        "\\user\\admin\\summary.xml": [
            "/user/admin/summary.xml"
        ]
    },
    "stats": {
        "some/path": {
            "isFile": false
        },
        "some/path/one": {
            "isFile": true
        },
        "some/path/two": {
            "isFile": true
        },
        "/tmp/sources": {
            "isDirectory" : true
        }
    }
}
