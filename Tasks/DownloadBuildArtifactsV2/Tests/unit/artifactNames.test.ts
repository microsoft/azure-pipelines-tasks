import * as assert from 'assert';
import { invalidArtifactNameMessage, isValidArtifactName } from '../../DownloadEngine/util/artifactNames';

describe('artifact names', () => {
    it('accepts the names that artifacts have', () => {
        for (const name of ['drop', 'my artifact', 'release-1.2', '.build', 'a.b', 'drop_(1)', 'Ünïcode', 'x'.repeat(200), 'name ', ' name', 'a..b', '..a', 'a..']) {
            assert.ok(isValidArtifactName(name), `"${name}" is valid`);
        }
    });

    it('refuses what cannot be a folder name, or leads out of the folder', () => {
        const invalid = ['', '.', '..', '...', ' ', '. .', ' . . ', '../outside', '..\\outside', 'a/b', 'a\\b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a\u0000b', 'a\nb', 'a\tb', '\u001f'];
        for (const name of invalid) {
            assert.ok(!isValidArtifactName(name), `${JSON.stringify(name)} is invalid`);
        }
        assert.ok(!isValidArtifactName(undefined));
        assert.ok(!isValidArtifactName(null));
    });

    it('has the text of the agent for the error', () => {
        assert.strictEqual(
            invalidArtifactNameMessage('..'),
            'Artifact name is not valid: ... It cannot contain \'\\\', /\', "\', \':\', \'<\', \'>\', \'|\', \'*\', and \'?\'. It cannot be empty or consist entirely of dots or spaces.');
    });
});
