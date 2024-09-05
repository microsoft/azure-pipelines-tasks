import * as assert from "assert";
import * as mockery from "mockery";
import * as path from "path";

export function runCopyDirectoryTests(): void {
    const fileList: { path: string, isDirectory: boolean}[] = [];
    let mkdirPCount: number;
    let cpfilesCount: number;

    before(async () => {

        const taskLibMock = {
            exist: function (path: string): boolean {
                console.log("exist : " + path);
                return fileList.map(f => f.path).indexOf(path) !== -1;
            },
            find: function (path: string): string[] {
                console.log("find : " + path);
                return fileList.map(f => f.path).filter(f => f.startsWith(path));
            },
            mkdirP: function (path: string): void {
                if (fileList.filter(f => f.isDirectory).map(f => f.path).indexOf(path) !== -1) {
                    return;
                }
                
                mkdirPCount++;
                fileList.push({
                    path: path,
                    isDirectory: true
                });
                console.log("mkdirp : " + path);
            },
            cp: function (source: string, dest: string, _options: any, _continueOnError: boolean): void {
                const files = fileList.filter(f => !f.isDirectory).map(f => f.path);
                if (files.indexOf(source) === -1) {
                    return;
                }
                if (files.indexOf(dest) !== -1) {
                    return;
                }
                cpfilesCount++;
                fileList.push({
                    path: dest,
                    isDirectory: false
                });
                console.log('cp ' + source + ' to ' + dest);
            },
            stats: function (path: string): any {
                return {
                    isDirectory: function (): boolean {
                        return fileList.some(f => f.path === path && f.isDirectory);
                    }
                };
            },
            debug: function (message: string) {
                console.log(message);
            }
        };
        mockery.registerMock('azure-pipelines-task-lib/task', taskLibMock);
        mockery.registerMock('./packageUtility', {});
        mockery.registerMock('./ziputility', {});
        mockery.registerAllowable('../utility');

        mockery.enable({
            useCleanCache: true,
            warnOnReplace: false,
            warnOnUnregistered: false
        });
    });

    after(() => {
        mockery.disable();
    });

    beforeEach(() => {
        mkdirPCount = 0;
        cpfilesCount = 0;
        fileList.splice(0);
    });

    it("Should copy files and folders as expected", async () => {
        fileList.push(
            { path: path.join("C:", "source", "path"), isDirectory: true },
            { path: path.join("C:", "source", "path", "myfile.txt"), isDirectory: false },
            { path: path.join("C:", "source", "path", "New Folder"), isDirectory: true },
            { path: path.join("C:", "source", "path", "New Folder", "Another New Folder"), isDirectory: true },
            { path: path.join("C:", "source", "New Folder", "anotherfile.py"), isDirectory: false },
            { path: path.join("C:", "source", "New Folder", "Another New Folder", "mynewfile.txt"), isDirectory: false }
        );

        const utility = await import('../utility')
        utility.copyDirectory(path.join('C:','source'), path.join('C:', 'destination'));

        assert.strictEqual(cpfilesCount, 3, 'Should create three files');
        assert.strictEqual(mkdirPCount, 6, 'Should create six folder including destination folder');
    });
}