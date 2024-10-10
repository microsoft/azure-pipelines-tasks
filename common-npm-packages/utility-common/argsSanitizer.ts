type ArgsSplitSymbols = '``' | '\\\\';
type SymbolsDictionary = { [symbol: string]: number }

export interface SanitizeScriptArgsOptions {
    argsSplitSymbols: ArgsSplitSymbols;
    saniziteRegExp?: RegExp;
    removedSymbolSign?: string
}

interface ArgsSanitizerTelemetry {
    removedSymbols: SymbolsDictionary;
    removedSymbolsCount: number;
}

/**
 * This function sanitizes input arguments. We're sanitizing each symbol which we think is dangerous.
 * @param {string} args - original input arguments param
 * @param {SanitizeScriptArgsOptions} options - sanitizer options
 * @returns {[string, ArgsSanitizerTelemetry]} sanitized input arguments, and telemetry
 */
export function sanitizeArgs(args: string, options: SanitizeScriptArgsOptions): [string, ArgsSanitizerTelemetry | null] {
    if (!args) {
        return [args, null];
    }

    const { argsSplitSymbols } = options;
    const removedSymbolSign = options.removedSymbolSign ?? '_#removed#_';
    const matchesChunks: RegExpMatchArray[] = [];

    // '?<!`' - checks if before a character is no escaping symbol. '^a-zA-Z0-9\`\\ _'"\-=/:' - checking if character is allowed. Instead replaces to _#removed#_
    const saniziteRegExp = options.saniziteRegExp ?? new RegExp(`(?<!${getEscapingSymbol(argsSplitSymbols)})([^a-zA-Z0-9\\\`\\\\ _'"\\\-=\\\/:\.])`, 'g');
    if (!saniziteRegExp.global) {
        throw new Error("Only global regular expressions are allowed.");
    }

    // We're splitting by esc. symbol pairs, removing all suspicious characters and then join back
    const argsChunks = args.split(argsSplitSymbols);
    for (let i = 0; i < argsChunks.length; i++) {
        matchesChunks[i] = argsChunks[i].match(saniziteRegExp);
        argsChunks[i] = argsChunks[i].replace(saniziteRegExp, removedSymbolSign);
    }

    const resultArgs = argsChunks.join(argsSplitSymbols);

    let telemetry: ArgsSanitizerTelemetry = null
    if (resultArgs != args) {
        const matches = [].concat(...matchesChunks ?? []);
        telemetry = {
            removedSymbols: combineMatches(matches),
            removedSymbolsCount: matches.length
        }
    }

    return [resultArgs, telemetry];
}

function getEscapingSymbol(argsSplitSymbols: ArgsSplitSymbols): string {
    switch (argsSplitSymbols) {
        case '\\\\':
            return '\\\\';
        case '``':
            return '`';
        default:
            throw new Error('Unknown args splitting symbols.');
    }
}

function combineMatches(matches: string[]): SymbolsDictionary {
    const matchesData = {};

    for (const m of matches) {
        if (matchesData[m]) {
            matchesData[m]++;

            continue;
        }

        matchesData[m] = 1;
    }

    return matchesData;
}
