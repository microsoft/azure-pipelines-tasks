import os = require('os');
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

export class MocksRegistrator {
    public static register(taskRunner: TaskMockRunner) {
        let secureFileHelperMock = require('./secure-files-mock.js');
        taskRunner.registerMock('azure-pipelines-tasks-securefiles-common/securefiles-common', secureFileHelperMock);
        class MockStats {
            mode = 600;
        };
        class MockUser {
            username = "testUser";
        };
        const fs = require('fs');
        const fsClone = Object.assign({}, fs);
        const fsClone2 = Object.assign({}, fs);
        fsClone.writeFileSync = function (filePath, contents) { };
        fsClone.existsSync = function (filePath, contents) {
            return true;
        };
        fsClone.readFileSync = function (filePath) {
            //return 'contents';
            if (filePath.endsWith("known_hosts")) {
                return 'contents';
            }
            return fsClone2.readFileSync(filePath, 'utf-8');
        };
        fsClone.statSync = function (filePath) {
            let s = new MockStats();
            return s;
        };
        fsClone.chmodSync = function (filePath, string) { };
        taskRunner.registerMock('fs', fsClone);
        
        const os = require('os');
        const osClone = Object.assign({}, os);
        taskRunner.registerMock('os', {
            userInfo: function () {
                let user = new MockUser();
                return user;
            },
            type: function () {
                return osClone.type();
            },
            homedir: function () {
                return osClone.homedir();
            }
        });
    }
}