import ma = require('vsts-task-lib/mock-answer');
import tmrm = require('vsts-task-lib/mock-run');
import path = require('path');
import mockTask = require('vsts-task-lib/mock-task');

const taskPath = path.join(__dirname, '..', 'javatoolinstaller.js');
const tr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

tr.setInput("versionSpec", "8.1");
tr.setInput("jdkSource", "Azure Storage")
tr.setInput("artifactProvider", "azureStorage");
tr.setInput("azureResourceManagerEndpoint", "ARM1");
tr.setInput("azureStorageAccountName", "storage1");
tr.setInput("azureContainerName", "container1");
tr.setInput("azureCommonVirtualPath", "");
tr.setInput("fileType", ".tar.gz");
tr.setInput("destinationFolder", "javaJDK");
tr.setInput("cleanDestinationFolder", "false");

process.env['ENDPOINT_URL_ID1'] = 'http://url';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_username'] = 'dummyusername';
process.env['ENDPOINT_AUTH_PARAMETER_connection1_password'] = 'dummypassword';
process.env['ENDPOINT_DATA_ID1_acceptUntrustedCerts'] = 'true';

tr.run();
