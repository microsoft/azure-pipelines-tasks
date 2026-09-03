import * as assert from 'assert';
import * as DockerComposeUtils from '../dockercomposeutils';

describe('DockerComposeUtils Tests', function() {
    describe('parseComposeArguments', function() {
        it('should parse --profile flag as global argument', function() {
            const result = DockerComposeUtils.parseComposeArguments('--profile build');
            assert.deepEqual(result.globalArgs, ['--profile', 'build']);
            assert.deepEqual(result.commandArgs, []);
        });

        it('should parse --profile=value flag as global argument', function() {
            const result = DockerComposeUtils.parseComposeArguments('--profile=build');
            assert.deepEqual(result.globalArgs, ['--profile=build']);
            assert.deepEqual(result.commandArgs, []);
        });

        it('should separate global and command flags correctly', function() {
            const result = DockerComposeUtils.parseComposeArguments('--profile build --no-cache');
            assert.deepEqual(result.globalArgs, ['--profile', 'build']);
            assert.deepEqual(result.commandArgs, ['--no-cache']);
        });

        it('should handle multiple global flags', function() {
            const result = DockerComposeUtils.parseComposeArguments('--profile build --parallel 4 --no-cache');
            assert.deepEqual(result.globalArgs, ['--profile', 'build', '--parallel', '4']);
            assert.deepEqual(result.commandArgs, ['--no-cache']);
        });

        it('should handle order independence', function() {
            const result = DockerComposeUtils.parseComposeArguments('--no-cache --profile build --parallel 2');
            assert.deepEqual(result.globalArgs, ['--profile', 'build', '--parallel', '2']);
            assert.deepEqual(result.commandArgs, ['--no-cache']);
        });

        it('should handle command-only arguments', function() {
            const result = DockerComposeUtils.parseComposeArguments('--pull --compress');
            assert.deepEqual(result.globalArgs, []);
            assert.deepEqual(result.commandArgs, ['--pull', '--compress']);
        });

        it('should handle empty input', function() {
            const result = DockerComposeUtils.parseComposeArguments('');
            assert.deepEqual(result.globalArgs, []);
            assert.deepEqual(result.commandArgs, []);
        });

        it('should handle null/undefined input', function() {
            const result1 = DockerComposeUtils.parseComposeArguments(null as any);
            assert.deepEqual(result1.globalArgs, []);
            assert.deepEqual(result1.commandArgs, []);

            const result2 = DockerComposeUtils.parseComposeArguments(undefined as any);
            assert.deepEqual(result2.globalArgs, []);
            assert.deepEqual(result2.commandArgs, []);
        });

        it('should handle quoted arguments', function() {
            const result = DockerComposeUtils.parseComposeArguments('--profile "my profile" --no-cache');
            assert.deepEqual(result.globalArgs, ['--profile', 'my profile']);
            assert.deepEqual(result.commandArgs, ['--no-cache']);
        });

        it('should handle all supported global flags', function() {
            const globalFlags = [
                '--profile test',
                '--ansi auto',
                '--compatibility',
                '--dry-run',
                '--env-file .env',
                '--parallel 2',
                '--progress plain',
                '--project-directory /path'
            ];
            
            globalFlags.forEach(flag => {
                const result = DockerComposeUtils.parseComposeArguments(flag + ' --build');
                assert(result.globalArgs.length > 0, `${flag} should be parsed as global flag`);
                assert.deepEqual(result.commandArgs, ['--build']);
            });
        });
    });
});