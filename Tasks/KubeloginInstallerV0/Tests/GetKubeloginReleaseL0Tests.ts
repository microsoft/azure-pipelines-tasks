import { getKubeloginRelease, KUBELOGIN_REPO_OWNER, KUBELOGIN_REPO } from '../utils';
import * as mockery from 'mockery';
import path = require('path');
import { TestString } from './TestStrings';

export class GetKubeloginReleaseL0Tests {
  public static async startTests() {
    mockery.registerMock('@octokit/rest', {
      repos: {
        getLatestRelease: async function () {
          return new Promise(async (resolve, reject) => {
            resolve({
              data: {
                tag_name: '0.0.29'
              }
            });
          });
        },
        getReleaseByTag: async function () {
          return new Promise(async (resolve, reject) => {
            resolve({
              data: {
                assets: [
                  {
                    name: 'kubelogin-win-amd64.zip',
                    browser_download_url: 'https://github.com/Azure/kubelogin/releases/download/v0.0.29/kubelogin-win-amd64.zip'
                  },
                  {
                    name: 'kubelogin-win-amd64.zip.sha256',
                    browser_download_url: 'https://github.com/Azure/kubelogin/releases/download/v0.0.29/kubelogin-win-amd64.zip.sha256'
                  }
                ]
              }
            });
          });
        }
      }
    });
    await this.validateGetKubeloginRelease0_0_29();
    await this.validateGetKubeloginReleasev0_0_29();
    await this.validateGetKubeloginReleaseLatestVersion();
    await this.validateGetKubeloginReleaseWrongVersion();
  }

  private static isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (err) {
      return false;
    }
  }

  public static async validateGetKubeloginRelease0_0_29() {
    const release = await getKubeloginRelease('0.0.29', 'darwin-amd64');
    console.log(release);

    if (release.version == 'v0.0.29') {
      console.log(TestString.Found0_0_29);
    }
    if (release.platform == 'darwin-amd64') {
      console.log(TestString.PlatformCorrect0_0_29);
    }
    if (this.isValidUrl(release.releaseUrl)) {
      console.log(TestString.ReleaseUrlValid0_0_29);
    }
    if (this.isValidUrl(release.checksumUrl)) {
      console.log(TestString.CheckSumValid0_0_29);
    }
  }

  public static async validateGetKubeloginReleasev0_0_29() {
    const release = await getKubeloginRelease('v0.0.29', 'darwin-amd64');

    if (release.version == 'v0.0.29') {
      console.log(TestString.Foundv0_0_29);
    }
    if (release.platform == 'darwin-amd64') {
      console.log(TestString.PlatformCorrectv0_0_29);
    }
    if (this.isValidUrl(release.releaseUrl)) {
      console.log(TestString.ReleaseUrlValidv0_0_29);
    }
    if (this.isValidUrl(release.checksumUrl)) {
      console.log(TestString.CheckSumValidv0_0_29);
    }
  }

  public static async validateGetKubeloginReleaseLatestVersion() {
    const release = await getKubeloginRelease('latest', 'darwin-amd64');

    if (release.version) {
      console.log(TestString.Foundlatest);
    }
    if (release.platform == 'darwin-amd64') {
      console.log(TestString.PlatformCorrectlatest);
    }
    if (this.isValidUrl(release.releaseUrl)) {
      console.log(TestString.ReleaseUrlValidlatest);
    }
    if (this.isValidUrl(release.checksumUrl)) {
      console.log(TestString.CheckSumValidlatest);
    }
  }

  public static async validateGetKubeloginReleaseWrongVersion() {
    try {
      const release = await getKubeloginRelease('123.1323', 'darwin-amd64');
    } catch (err) {
      console.log(TestString.NotFound123_1323);
    }
  }
}

GetKubeloginReleaseL0Tests.startTests();
