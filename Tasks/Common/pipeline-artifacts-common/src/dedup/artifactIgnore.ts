/*
 * .artifactignore is applied like the agent plugin does, which is not how .gitignore works: every rule becomes one or two
 * DotNet.Glob patterns (see dotNetGlob.ts) that are matched against the path of each file and empty directory. A file is
 * ignored when a rule matches and no "!" rule does. Without an .artifactignore file the rule ".git" is used.
 */

import { ArtifactError } from '../errors';
import { DotNetGlob, GlobComplexityError, GlobIndexError, GlobSyntaxError } from './dotNetGlob';

export class ArtifactIgnoreError extends ArtifactError { }

const WINDOWS_ROOT = 'C:\\~~\\~~\\~~';
const POSIX_ROOT = '/~~/~~/~~';

const MAX_RULE_LENGTH = 16384;

const SENTINEL_FILE = '\u0001';

const LITERAL_RULE = /^(?:\*\*[/\\])?[\p{L}\p{Nd} .!#\-;=@~_:/\\]+$/u;

interface CompiledGlob {
    glob: DotNetGlob;
    nameOnly: boolean;
    wide: boolean;
    prunable: boolean;
    rule: string;
}

interface Patterns {
    pattern: string;
    nameOnly: boolean;
    wide: boolean;
    prunable: boolean;
}

function patternsOf(rule: string, windows: boolean, root: string): Patterns[] {
    const separator = windows ? '\\' : '/';
    const otherSeparator = windows ? '/' : '\\';
    const last = rule.length > 0 ? rule[rule.length - 1] : '';
    const hasStar = rule.includes('*');
    const startsWithDoubleStar = rule.startsWith('**');
    const endsWithSeparator = windows ? last === '/' || last === '\\' : last === '/';
    const hasSeparator = rule.includes('/') || rule.includes('\\');

    const file = (pattern: string): Patterns => ({ pattern, nameOnly: false, wide: false, prunable: false });
    const wide = (body: string): Patterns[] => (last === '*' ? [] : [{ pattern: body + (endsWithSeparator ? '' : separator) + '**', nameOnly: false, wide: true, prunable: LITERAL_RULE.test(rule) }]);

    if (!startsWithDoubleStar && rule.startsWith(otherSeparator)) {
        const body = root + separator + rule;
        return [file(body), ...wide(body)];
    }
    if (!startsWithDoubleStar && rule.includes(separator)) {
        let start = 0;
        while (rule[start] === separator) {
            start++;
        }
        const body = root + separator + rule.substring(start);
        return [file(body), ...wide(body)];
    }
    if (startsWithDoubleStar) {
        return [file(rule), ...wide(rule)];
    }
    if (!hasSeparator && !hasStar) {
        return [{ pattern: '*' + rule, nameOnly: true, wide: false, prunable: false }, ...wide('**' + separator + rule)];
    }
    return [file('**' + separator + (hasStar ? '' : '*') + rule), ...wide('**' + separator + rule)];
}

function lastSegment(relativePath: string): string {
    return relativePath.substring(relativePath.lastIndexOf('/') + 1);
}

function tooComplex(rule: string): ArtifactIgnoreError {
    return new ArtifactIgnoreError(`The .artifactignore rule '${rule.substring(0, 80)}' is too complex.`);
}

export class ArtifactIgnore {
    private readonly ignoreGlobs: CompiledGlob[];
    private readonly keepGlobs: CompiledGlob[];
    private readonly windows: boolean;
    private readonly root: string;
    private readonly separator: string;
    private readonly warn: ((message: string) => void) | undefined;
    private readonly reported = new Set<string>();

    private constructor(ignoreGlobs: CompiledGlob[], keepGlobs: CompiledGlob[], windows: boolean, warn: ((message: string) => void) | undefined) {
        this.ignoreGlobs = ignoreGlobs;
        this.keepGlobs = keepGlobs;
        this.windows = windows;
        this.root = windows ? WINDOWS_ROOT : POSIX_ROOT;
        this.separator = windows ? '\\' : '/';
        this.warn = warn;
    }

    static parse(content: string | undefined, ignoreCase: boolean = process.platform === 'win32', windows: boolean = process.platform === 'win32', warn?: (message: string) => void): ArtifactIgnore {
        const lines = content === undefined ? ['.git'] : (content.charCodeAt(0) === 0xFEFF ? content.substring(1) : content).split(/\r\n|\r|\n/);

        const ignoreRules: string[] = [];
        const keepRules: string[] = [];
        for (const line of lines) {
            if (line === '' || line.startsWith('#')) {
                continue;
            }
            const negate = line.startsWith('!');
            const rule = negate ? line.substring(1) : line;
            const list = negate ? keepRules : ignoreRules;
            if (!list.includes(rule)) {
                list.push(rule);
            }
        }

        const root = windows ? WINDOWS_ROOT : POSIX_ROOT;
        const compile = (rules: string[]): CompiledGlob[] => {
            const compiled: CompiledGlob[] = [];
            for (const rule of rules) {
                if (rule.length > MAX_RULE_LENGTH) {
                    throw new ArtifactIgnoreError(`The .artifactignore rule '${rule.substring(0, 80)}' is too long.`);
                }
                for (const patterns of patternsOf(rule, windows, root)) {
                    try {
                        compiled.push({ glob: DotNetGlob.parse(patterns.pattern, { caseInsensitive: ignoreCase }), nameOnly: patterns.nameOnly, wide: patterns.wide, prunable: patterns.prunable, rule });
                    } catch (error) {
                        if (error instanceof GlobSyntaxError) {
                            throw new ArtifactIgnoreError(error.message);
                        }
                        if (error instanceof GlobIndexError) {
                            throw new ArtifactIgnoreError(`The .artifactignore rule '${rule.substring(0, 80)}' is not valid.`);
                        }
                        if (error instanceof RangeError) {
                            throw tooComplex(rule);
                        }
                        throw error;
                    }
                }
            }
            return compiled;
        };
        return new ArtifactIgnore(compile(ignoreRules), compile(keepRules), windows, warn);
    }

    private test(compiled: CompiledGlob, file: string, name: string): boolean {
        try {
            return compiled.glob.isMatch(compiled.nameOnly ? name : file);
        } catch (error) {
            if (error instanceof GlobIndexError) {
                this.report(compiled, 'cannot be evaluated for some paths and does not match them');
                return false;
            }
            if (error instanceof GlobComplexityError || error instanceof RangeError) {
                throw tooComplex(compiled.rule);
            }
            throw error;
        }
    }

    private report(compiled: CompiledGlob, problem: string): void {
        if (this.warn && !this.reported.has(compiled.rule)) {
            this.reported.add(compiled.rule);
            this.warn(`The .artifactignore rule '${compiled.rule.substring(0, 80)}' ${problem}.`);
        }
    }

    private absolute(relativePath: string): string {
        return this.root + this.separator + (this.windows ? relativePath.replace(/\//g, '\\') : relativePath);
    }

    ignores(relativePath: string): boolean {
        if (this.ignoreGlobs.length === 0) {
            return false;
        }
        const file = this.absolute(relativePath);
        const name = lastSegment(relativePath);
        if (!this.ignoreGlobs.some(compiled => this.test(compiled, file, name))) {
            return false;
        }
        return !this.keepGlobs.some(compiled => this.test(compiled, file, name));
    }

    ignoresWholeDirectory(relativePath: string): boolean {
        if (this.keepGlobs.length > 0) {
            return false;
        }
        const directory = this.absolute(relativePath);
        const child = directory + this.separator + SENTINEL_FILE;
        const grandchild = child + this.separator + SENTINEL_FILE;
        return this.ignoreGlobs.some(compiled => {
            if (!compiled.prunable) {
                return false;
            }
            try {
                return compiled.glob.isMatch(child) && compiled.glob.isMatch(grandchild);
            } catch (error) {
                if (error instanceof GlobIndexError) {
                    return false;
                }
                if (error instanceof GlobComplexityError || error instanceof RangeError) {
                    throw tooComplex(compiled.rule);
                }
                throw error;
            }
        });
    }
}
