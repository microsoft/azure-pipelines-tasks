import tl = require('azure-pipelines-task-lib');
import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as path from 'path';
import { MysqlClient } from '../sql/MysqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';

export class FirewallOperationTests  {

    public static startFirewallOperationL0Tests(){
        let tp = path.join(__dirname, 'FirewallOperationsL0Tests.js');
        let tr : tmrm.TaskMockRunner = new tmrm.TaskMockRunner(tp);
        process.env["RELEASE_RELEASEID"] = "MOCK_RELEASE_ID";
        process.env["BUILD_BUILDID"] ="MOCK_BUILD_ID";
        tr.setInput('IpDetectionMethod', 'IPAddressRange')
        tr.setInput('IpDetectionMethod', 'IPAddressRange');
        tr.setInput('ServerName', 'MOCK_SERVER_NAME');
        tr.setInput('StartIpAddress', '0.0.0.0');
        tr.setInput("EndIpAddress", "2 55.255.255.255");
        tr.setInput("IpDetectionMethod", "IPAddressRange");
        tr.setInput("ConnectedServiceName", "DEMO_CONNECTED_SERVICE_NAME");
        tr.setInput("SqlUsername", "DEMO_SQL_USERNAME");
        tr.setInput("SqlPassword","DEMO_SQL_PASSWORD");
        tr.setInput("TaskNameSelector", "SqlFile");
        Date.now = function (): number {
            return 12345;	
        } 
        tr.registerMock("../sql/MysqlClient", {
            MysqlClient: function(A,B){
                return {
                    getFirewallConfiguration : function() {
                        let firewallConfiguration: FirewallConfiguration = new FirewallConfiguration(true);
                        return firewallConfiguration;
                    },
                    executeSqlCommand : function(){
                        return 0;
                    }
                }
            }
        });
            
        tr.run();
    }


}

FirewallOperationTests.startFirewallOperationL0Tests();
