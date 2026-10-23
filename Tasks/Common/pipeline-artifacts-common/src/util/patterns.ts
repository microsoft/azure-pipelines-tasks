import minimatch = require('minimatch');
import { Logger, nullLogger } from './logger';
import { trimDotNet } from './dotnet';

export interface MatchOptions {
    dot?: boolean;
    nobrace?: boolean;
    nocase?: boolean;
    nocomment?: boolean;
    nonegate?: boolean;
    flipNegate?: boolean;
    matchBase?: boolean;
    noglobstar?: boolean;
    noext?: boolean;
}

function braceExpand(pattern: string): string[] {
    return (minimatch as unknown as { braceExpand(pattern: string, options: object): string[] }).braceExpand(pattern, { nobrace: false });
}

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
    dot: true,
    nobrace: true,
    nocase: process.platform === 'win32'
};

/**
 * Filters `paths` the way the BlobStore (dedup) download client of the agent does. Every pattern is evaluated on its
 * own and a path is selected as soon as ANY pattern accepts it. A pattern starting with '!' accepts the paths that do
 * NOT match the rest of the pattern, so "**\/*.txt" together with "!**\/c.txt" selects every file, and "!**\/*.txt"
 * alone selects every file that is not a .txt file. This differs from matchPaths (ordered include/exclude).
 */
export function matchAnyPattern(paths: readonly string[], patterns: readonly string[], options: MatchOptions = DEFAULT_MATCH_OPTIONS, logger: Logger = nullLogger): string[] {
    const matchers: minimatch.IMinimatch[] = [];
    for (const rawPattern of patterns) {
        const pattern = rawPattern.trim();
        logger.debug(`Pattern: ${rawPattern}`);
        if (!pattern) {
            continue;
        }
        matchers.push(new minimatch.Minimatch(pattern, {
            dot: options.dot,
            nocase: options.nocase,
            nobrace: options.nobrace,
            nocomment: options.nocomment,
            nonegate: options.nonegate,
            flipNegate: options.flipNegate,
            matchBase: options.matchBase,
            noglobstar: options.noglobstar,
            noext: options.noext
        }));
    }
    return paths.filter(path => matchers.some(matcher => matcher.match(path)));
}

/**
 * Filters `paths` with an ordered list of minimatch patterns the way the agent artifact plugins (and
 * azure-pipelines-task-lib's match()) do: every pattern is applied in order, a plain pattern adds the paths it
 * matches, a pattern starting with '!' removes them. The result keeps the order of `paths`.
 */
export function matchPaths(paths: readonly string[], patterns: readonly string[], options: MatchOptions = DEFAULT_MATCH_OPTIONS, logger: Logger = nullLogger): string[] {
    const selected = new Set<string>();

    for (const rawPattern of patterns) {
        logger.debug(`Pattern: ${rawPattern}`);
        let pattern = trimDotNet(rawPattern);
        if (!pattern) {
            logger.debug('Skipping empty pattern.');
            continue;
        }

        if (!options.nocomment && pattern.startsWith('#')) {
            logger.debug('Skipping comment.');
            continue;
        }

        let negateCount = 0;
        if (!options.nonegate) {
            while (negateCount < pattern.length && pattern[negateCount] === '!') {
                negateCount++;
            }
            pattern = pattern.substring(negateCount);
            if (negateCount > 0) {
                logger.debug(`Trimmed leading '!'. Pattern: '${pattern}'`);
            }
        }

        const include = negateCount === 0
            || (negateCount % 2 === 0 && !options.flipNegate)
            || (negateCount % 2 === 1 && !!options.flipNegate);

        pattern = trimDotNet(pattern);
        if (!pattern) {
            logger.debug('Skipping empty pattern.');
            continue;
        }

        const expanded = options.nobrace
            ? [pattern]
            : braceExpand(process.platform === 'win32' ? pattern.replace(/\\/g, '/') : pattern);

        // Brace expansion can produce a leading '#' or '!', which must not be interpreted again.
        const matchOptions: minimatch.IOptions = {
            dot: options.dot,
            nocase: options.nocase,
            matchBase: options.matchBase,
            noglobstar: options.noglobstar,
            noext: options.noext,
            nocomment: true,
            nonegate: true,
            nobrace: true
        };

        for (const candidate of expanded) {
            const current = trimDotNet(candidate);
            if (!current) {
                logger.debug('Skipping empty pattern.');
                continue;
            }
            if (current !== pattern) {
                logger.debug(`Pattern: ${current}`);
            }

            const matcher = new minimatch.Minimatch(current, matchOptions);
            let matches = 0;
            for (const path of paths) {
                if (matcher.match(path)) {
                    matches++;
                    if (include) {
                        selected.add(path);
                    } else {
                        selected.delete(path);
                    }
                }
            }
            logger.debug(`${matches} matches (${include ? 'include' : 'exclude'})`);
        }
    }

    return paths.filter(path => selected.has(path));
}
