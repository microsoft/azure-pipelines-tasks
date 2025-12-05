import * as assert from 'assert';
import path = require('path');

import tmrm = require('azure-pipelines-task-lib/mock-run');
import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

const tr = new tmrm.TaskMockRunner(path.join(__dirname, '..', 'kubelogin.js'));

export class GetKubeloginReleaseErrorHandlingL0Tests {
  static tagVersion = 'v0.0.29';

  public static startTests() {
    this.validateGithubApiRateLimitErrorForLatestTag();
    this.validateLatestTagNotFoundError();
    this.validateGithubApiRateLimitErrorDownloadSpecificRelease();
    this.validateGithubApiDownloadSpecificReleaseNotFoundError();
  }

  public static validateGithubApiRateLimitErrorForLatestTag() {
    tr.setInput('kubeloginVersion', 'latest');

    tr.registerMock('azure-pipelines-tasks-azure-arm-rest/webClient', {
      WebRequest: webClient.WebRequest,
      sendRequest: (request) => {
        if (request.uri.endsWith('/releases/latest')) {
          return {
            statusCode: 403,
            headers: {
              'x-ratelimit-remaining': '0'
            }
          };
        }
      }
    });

    try {
      tr.run();
    } catch (error) {
      assert(error.includes("##vso[task.complete result=Failed;]loc_mock_Err_GithubApiRateLimitExceeded"), 'Should have contained rate limit error message');
    }
  }

  public static validateLatestTagNotFoundError() {
    tr.setInput('kubeloginVersion', 'latest');

    tr.registerMock('azure-pipelines-tasks-azure-arm-rest/webClient', {
      WebRequest: webClient.WebRequest,
      sendRequest: (request) => {
        if (request.uri.endsWith('/releases/latest')) {
          return {
            statusCode: 404
          };
        }
      }
    });

    try {
      tr.run();
    } catch (error) {
      assert(error.includes("##vso[task.complete result=Failed;]loc_mock_Err_LatestTagNotFound"), 'Should have contained latest tag not found error message');
    }
  }

  public static validateGithubApiRateLimitErrorDownloadSpecificRelease() {
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

        return {
          statusCode: 403,
          headers: {
            'x-ratelimit-remaining': '0'
          }
        };
      }
    });

    try {
      tr.run();
    } catch (error) {
      assert(error.includes("##vso[task.complete result=Failed;]loc_mock_Err_GithubApiRateLimitExceeded"), 'Should have contained rate limit error message');
    }
  }

  public static validateGithubApiDownloadSpecificReleaseNotFoundError() {
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
          return {
            statusCode: 404,
            statusMessage: 'Not Found'
          };
        }
      }
    });

    try {
      tr.run();
    } catch (error) {
      assert(error.includes("##vso[task.complete result=Failed;]loc_mock_Err_VersionNotFound"), 'Should have contained version not found error message');
    }
  }
}

GetKubeloginReleaseErrorHandlingL0Tests.startTests();
