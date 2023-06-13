import { resolvePlatform } from '../utils';

export class ResolvePlatformL0Tests {
  public static async startTests() {
    await this.validateResolvePlatform();
  }

  public static async validateResolvePlatform() {
    // Test case for darwin-x64 platform

    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    Object.defineProperty(process, 'arch', {
      value: 'x64'
    });

    console.log(resolvePlatform());

    // Test case for darwin-arm64 platform

    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    Object.defineProperty(process, 'arch', {
      value: 'arm64'
    });

    console.log(resolvePlatform());

    // Test case for linux-x64 platform

    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    Object.defineProperty(process, 'arch', {
      value: 'x64'
    });

    console.log(resolvePlatform());

    // Test case for linux-arm64 platform

    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });
    Object.defineProperty(process, 'arch', {
      value: 'arm64'
    });

    console.log(resolvePlatform());

    // Test case for win32-x64 platform

    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });
    Object.defineProperty(process, 'arch', {
      value: 'x64'
    });

    console.log(resolvePlatform());

    // Test case for unsupported platform

    Object.defineProperty(process, 'platform', {
      value: 'unsupported'
    });
    Object.defineProperty(process, 'arch', {
      value: 'unsupported'
    });

    try {
      resolvePlatform();
    } catch (err) {
      console.log(err);
    }
  }
}

ResolvePlatformL0Tests.startTests();
