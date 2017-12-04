import webClient = require('./webClient');
import tl = require('vsts-task-lib/task');
import Q = require('q');

export class KuduService {
    private scmUri: string;
    private userName: string;
    private password: string;
    private accessToken: string;
    
    constructor(scmUri: string, userName: string, password: string) {
        this.scmUri = scmUri;
        this.userName = userName;
        tl.setVariable('KUDU_SCM_USERNAME', userName, true);
        this.password = password;
        tl.setVariable('KUDU_SCM_PASSWORD', password, true);
        var userNamePasswordbase64 = new Buffer(userName + ':' + password).toString('base64');
        this.accessToken = `Basic ${userNamePasswordbase64}`;
    }

    /**
     * List all continuous jobs
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#list-all-continuous-jobs
     */
    public async getContinuousWebJobs(): Promise<WebJob[]> {
        let dataDeferred = Q.defer<WebJob[]>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'GET';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body as WebJob[]);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        })
        return dataDeferred.promise;
    }

    /**
     * Start a continous WebJob
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#start-a-continuous-job
     */
    public async startContinuousJob(webJobName: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'POST';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs/${webJobName}/start`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });     

        return dataDeferred.promise;
    }

    /**
     * Stop a continous WebJob
     * 
     * https://github.com/projectkudu/kudu/wiki/WebJobs-API#stop-a-continuous-job
     */
    public async stopContinuousJob(webJobName: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'POST';
        webRequest.uri = `${this.scmUri}/api/continuouswebjobs/${webJobName}/stop`;
        webRequest.headers = {
            'authorization': this.accessToken
        }

        webClient.sendRequest(webRequest).then((response) => {
            if(response.statusCode == 200) {
                dataDeferred.resolve(response.body);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });     

        return dataDeferred.promise;
    }

    /**
     * Creates folder(s) from given relative path
     * @param path physical path (say: /site/wwwroot)
     */
    public async createPath(path: string) {
        let dataDeferred = Q.defer<any>();
        let webRequest = new webClient.WebRequest();
        webRequest.method = 'PUT';
        webRequest.uri = `${this.scmUri}/api/vfs/${path}`;
        webRequest.headers = {
            'authorization': this.accessToken,
            'If-Match': '*'
        }

        webClient.sendRequest(webRequest).then((response) => {
            // 200 - OK, 201 - Created, 204 - No Content (if already exists)
            if([200, 201, 204].indexOf(response.statusCode)) {
                dataDeferred.resolve(response);
            }
            else {
                dataDeferred.reject(JSON.stringify(response));
            }
        }, (error) => {
            dataDeferred.reject(error);
        });

        return dataDeferred.promise;
    }
}

export interface WebJob {
    name: string;
    status: string;
    runCommand: string;
    log_url: string;
    url: string;
    type: string;
}