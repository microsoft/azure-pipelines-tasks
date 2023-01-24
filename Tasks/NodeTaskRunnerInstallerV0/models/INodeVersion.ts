//
// Node versions interface
// see https://nodejs.org/dist/index.json
//
export interface INodeVersion {
    version: string;
    files: string[];
    semanticVersion: string;
}
