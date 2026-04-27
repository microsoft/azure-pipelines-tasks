import * as path from 'path';
import * as os from 'os';
import * as tmrm from 'azure-pipelines-task-lib/mock-run';

const taskPath = path.join(__dirname, '..', 'usenode.js');
const tmr: tmrm.TaskMockRunner = new tmrm.TaskMockRunner(taskPath);

const mirrorBase = 'https://mymirror.example.com/node/';

tmr.setInput('version', '10.x');
tmr.setInput('checkLatest', 'true');
tmr.setInput('nodejsMirror', mirrorBase);

const isWin = os.platform() === 'win32';
const platform = isWin ? 'win' : os.platform();
const arch = os.arch() === 'ia32' ? 'x86' : os.arch();

// This is the filename pattern used by installer.ts
const expectedVersion = '10.15.1';
const expectedArchive =
    `node-v${expectedVersion}-${platform}-${arch}` + (isWin ? '.7z' : '.tar.gz');

const expectedIndexUrl = `${mirrorBase}index.json`;
const expectedDownloadUrl = `${mirrorBase}v${expectedVersion}/${expectedArchive}`;

// --- mock typed-rest-client/RestClient to validate index.json URL ---
tmr.registerMock('typed-rest-client/RestClient', {
    RestClient: function() {
        return {
            get: async (url: string) => {
                console.log(`REST_GET ${url}`);
                    if (url !== expectedIndexUrl) {
                        throw new Error(`Expected index.json from ${expectedIndexUrl}, got ${url}`);
                    }

                  // Minimal index.json shape consumed by installer.ts
                  const filesKey =
                      os.platform() === 'linux' ? `linux-${arch}` :
                        os.platform() === 'darwin' ? `osx-${arch}-tar` :
                         `win-${arch}${arch === 'arm64' ? '-7z' : '-exe'}`;

                  return {
                      result: [
                          { version: `v${expectedVersion}`, files: [filesKey], semanticVersion: '' }
                      ]
                };
            }
        };
    }
});

// --- mock azure-pipelines-tool-lib/tool to validate download URL ---
tmr.registerMock('azure-pipelines-tool-lib/tool', {
    // keep only what installer.ts calls in this path
    cleanVersion: (v: string) => v.replace(/^v/, ''),
    isExplicitVersion: () => false,
    findLocalTool: () => '',
    evaluateVersions: () => expectedVersion,
    downloadToolWithRetries: async (url: string) => {
        console.log(`DOWNLOAD ${url}`);
        if (url !== expectedDownloadUrl) {
          throw new Error(`Expected download from ${expectedDownloadUrl}, got ${url}`);
        }
        return 'download-path';
    },
    extractTar: async () => 'ext-path',
    extract7z: async () => 'ext-path',
    cacheDir: async () => 'cached-tool-path',
    prependPath: () => undefined
});

// --- mock telemetry to avoid noise ---
tmr.registerMock('azure-pipelines-tasks-utility-common/telemetry', {
    emitTelemetry: () => undefined
});

tmr.run();