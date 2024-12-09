import * as TaskManifestData from "./task.json";
import os = require('os');
import tl = require("azure-pipelines-task-lib/task");
import { ArgumentError } from "./errors";

export class Utils {

    public static GenerateUserAgent(): string {
        const taskVersion: string = `${TaskManifestData.version.Major}.${TaskManifestData.version.Minor}.${TaskManifestData.version.Patch}`;
        const userAgent: string = `AzurePipelines.AzureAppConfiguration.Export/${taskVersion} Node/${process["version"]} OS/(${os.arch()}-${os.type()}-${os.release()})`;
        // webClient.WebRequest will load environment variable as user-agent.
        return userAgent;
    }

    public static TrimKey(key: string, prefixesToTrim: string[]): string {
        if (!key) {
            throw tl.loc("KeyIsRequired");
        }
        
        for (const prefix of prefixesToTrim) {
            if (prefix) {

                if (key.startsWith(prefix)) {

                    key = key.substring(prefix.length);

                    break;
                }
            }
        }
        return key;
    }

    public static SetVariable(key: string, value: string, isSecret: boolean) {
        try {
            tl.setVariable(key, value, isSecret);
        }
        catch (e) {
            if (isSecret) {
                throw new ArgumentError(tl.loc("FailedToSetSecretVariable", key));
            } 
            throw e;
        }
    }

    //
    // BUG: set variable may fail if key contains reserved symbols,
    // with no exception bubble up. 
    // Workaround: 
    // 1. set variable with a mask value
    // 2. check if kv exists, if not exists, means the setVariable failed.
    // 3. otherwise, set key with real value.
    public static ValidateKey(key: string): boolean {
        if (!key) {
            return false;
        }

        const tempVal: string = "****";

        process.env[key] = tempVal;

        const isSet: boolean = !!process.env[key];

        //
        // reset 
        delete process.env[key];

        return isSet;
    }
}