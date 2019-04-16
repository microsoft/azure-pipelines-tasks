import * as tl from 'vsts-task-lib/task';
import * as util from './utilities';

export async function isCodeCoverageFileEmpty(codeCoverageFile: string, codeCoverageTool: string): Promise<boolean> {
    if (!tl.exist(codeCoverageFile)) {
        return Promise.resolve(true);
    }

    const resp = await util.readXmlFileAsJson(codeCoverageFile);
    if (resp) {
        if (codeCoverageTool.toLowerCase() === 'jacoco' && resp.report && resp.report.counter) {
            return Promise.resolve(false);
        } else if (codeCoverageTool.toLowerCase() === 'cobertura' && resp.coverage) {
            const linesCovered: number = Number(resp.coverage.$['lines-covered']);
            if (linesCovered && linesCovered > 0) {
                return Promise.resolve(false);
            }
        }
    }
    return Promise.resolve(true);
}