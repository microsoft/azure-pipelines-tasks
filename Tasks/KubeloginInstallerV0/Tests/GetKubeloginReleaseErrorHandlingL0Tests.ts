import path = require('path');

import tmrm = require('azure-pipelines-task-lib/mock-run');
import * as taskLib from 'azure-pipelines-task-lib/task';
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

const taskPath = path.join(__dirname, '..', 'kubelogin.js');
const tr = new tmrm.TaskMockRunner(taskPath);

export class GetKubeloginReleaseErrorHandlingL0Tests {
  static tagVersion = 'v0.0.29';

  public static startTests() {
    taskLib.setResourcePath(path.join(__dirname, '..', 'task.json'));

    this.validateGithubApiRateLimitError();
    this.validateGithubApiError();
  }

  /**
   * This test validates that when GitHub API returns a 403 rate limit error,
   * the appropriate error message is thrown.
   */
  public static validateGithubApiRateLimitError() {
    tr.setInput('kubeloginVersion', 'latest');

    tr.registerMock('azure-pipelines-tasks-azure-arm-rest/webClient', {
      WebRequest: webClient.WebRequest,
      sendRequest: (request) => {
        if (request.uri.endsWith('/releases/latest')) {
          return {
            body: {
              tag_name: this.tagVersion
            }
          };
        }

        if (request.uri.includes(`/releases/tags/${this.tagVersion}`)) {
          throw new Error(taskLib.loc('Err_GithubApiRateLimitExceeded'));
        }
      }
    });

    try {
      tr.run();
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * This test validates that when GitHub API returns a generic error,
   * the appropriate error message is thrown.
   */
  public static validateGithubApiError() {
    tr.setInput('kubeloginVersion', 'latest');

    tr.registerMock('azure-pipelines-tasks-azure-arm-rest/webClient', {
      WebRequest: webClient.WebRequest,
      sendRequest: (request) => {
        if (request.uri.endsWith('/releases/latest')) {
          return {
            body: {
              tag_name: this.tagVersion
            }
          };
        }

        if (request.uri.includes(`/releases/tags/${this.tagVersion}`)) {
          throw new Error(taskLib.loc('Err_VersionNotFound', this.tagVersion));
        }
      }
    });

    try {
      tr.run();
    } catch (error) {
      console.log(error);
    }
  }
}

GetKubeloginReleaseErrorHandlingL0Tests.startTests();
