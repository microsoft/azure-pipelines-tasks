import { TaskLibAnswers } from 'azure-pipelines-task-lib/mock-answer';

export const successAnswers: TaskLibAnswers = <TaskLibAnswers>{
    "which": {
        "ant": "/usr/local/bin/ANT",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/ANT -version": {
            "code": 0,
            "stdout": "Apache Ant(TM) version 1.9.7 compiled on April 9 2016"
        },
        "/usr/local/bin/ANT -buildfile /build/build.xml": {
            "code": 0,
            "stdout": ""
        },
        "reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\1.5 /v JavaHome /reg:32": {
            "code": 222,
            "stdout": ""
        },
        "reg query HKLM\\SOFTWARE\\JavaSoft\\Java Development Kit\\ /f 1.5 /k": {
            "code": 50,
            "stdout": ""
        }
    },
    "checkPath": {
        "/usr/local/bin/ANT": true,
        "/build/build.xml": true,
        "/usr/local/bin/ANT2": true
    },
    "getVariable": {
        "ANT_HOME": "/user/local/bin/ANT",
        "JAVA_HOME_8_x86": "/user/local/bin/ANT8",
        "JAVA_HOME_8_X64": "/user/local/bin/ANT8",
        "System.DefaultWorkingDirectory": "/user/build"
    },
    "find": {
        "/user/build": [
            "/user/build/fun/test-123.xml"
        ]
    },
    "findMatch": {
        "**/TEST-*.xml": [
            "/user/build/fun/test-123.xml"
        ]
    }
};

export const failAnswers: TaskLibAnswers = <TaskLibAnswers>{
    "which": {
        "ant": "/usr/local/bin/ANT",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/ANT -version": {
            "code": 0,
            "stdout": "Apache Ant(TM) version 1.9.7 compiled on April 9 2016"
        },
        "/usr/local/bin/ANT -buildfile /build/build.xml": {
            "code": 222,
            "stdout": ""
        }
    },
    "checkPath": {
        "/usr/local/bin/ANT": true,
        "/build/build.xml": true
    },
    "getVariable": {
        "ANT_HOME": "/user/local/bin/ANT"
    },
    "find": {
        "/user/build": [
            "/user/build/fun/test-123.xml"
        ]
    },
    "findMatch": {
        "**/TEST-*.xml": [
            "/user/build/fun/test-123.xml"
        ]
    }
};

export const versionFailAnswers: TaskLibAnswers = <TaskLibAnswers> {
    "which": {
        "ant": "/usr/local/bin/ANT",
        "node": "/usr/local/bin/node"
    },
    "exec": {
        "/usr/local/bin/ANT -version": {
            "code": 222,
            "stdout": "Apache Ant(TM) version 1.9.7 compiled on April 9 2016"
        },
        "/usr/local/bin/ANT -buildfile /build/build.xml": {
            "code": 0,
            "stdout": ""
        }
    },
    "checkPath" : {
        "/usr/local/bin/ANT": true,
        "/build/build.xml": true
    }
}
