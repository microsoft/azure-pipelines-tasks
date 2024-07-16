import { unzipRelease } from '../utils';
import * as taskLib from 'azure-pipelines-task-lib/task';

const fs = require('fs');
import path = require('path');

export class UnzipL0Tests {
  public static async startTests() {
    taskLib.setVariable('agent.TempDirectory', '/tmp/');
    await this.validateUnzipRelease();
    await this.unzipPathDoesnotExist();
    await this.validateUnzipFailedRelease();
  }

  public static async validateUnzipFailedRelease() {
    const zipPath = path.join(__dirname + '/testfailed.zip');
    try {
      const extractedPath = await unzipRelease(zipPath);
    } catch (err) {
      console.log(err);
    }
  }

  public static async validateUnzipRelease() {
    const zipPath = path.join(__dirname + '/test.zip');
    const extractedPath = await unzipRelease(zipPath);

    const isExists = fs.existsSync(extractedPath);
    console.log(extractedPath);
    if (isExists) {
      console.log('unzip path exist');
    }
  }

  public static async unzipPathDoesnotExist() {
    const zipPath = './testtest.zip';
    try {
      const extractedPath = await unzipRelease(zipPath);
    } catch (err) {
      console.log(err);
    }
  }
}

UnzipL0Tests.startTests();
