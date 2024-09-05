const m = require('module');

export interface MockOptions {
    useCleanCache?: boolean,
    warnOnReplace?: boolean,
    warnOnUnregistered?: boolean
};

let registeredMocks = {};
let registeredAllowables = new Set<string>();  
let originalLoader: Function | null = null;
let originalCache: Record<string, any> = {};
let options: MockOptions = {};
let defaultOptions: MockOptions = {
    useCleanCache: false,
    warnOnReplace: true,
    warnOnUnregistered: true
};

function _getEffectiveOptions(opts: MockOptions): MockOptions {
    var options: MockOptions = {};

    Object.keys(defaultOptions).forEach(function (key) {
        if (opts && opts.hasOwnProperty(key)) {
            options[key] = opts[key];
        } else {
            options[key] = defaultOptions[key];
        }
    });
    return options;
}

/*
 * Loader function that used when hooking is enabled.
 * if the requested module is registered as a mock, return the mock.
 * otherwise, invoke the original loader + put warning in the output.
 */
function _hookedLoader(request: string, parent, isMain: boolean) {
    if (!originalLoader) {
        throw new Error("Loader has not been hooked");
    }

    if (registeredMocks.hasOwnProperty(request)) {
        return registeredMocks[request];
    }

    if (!registeredAllowables.has(request) && options.warnOnUnregistered) {
        console.warn("WARNING: loading non-allowed module: " + request);
    }

    return originalLoader(request, parent, isMain);
}


/**
 * Remove references to modules in the cache from
 * their parents' children.
 */
function _removeParentReferences(): void {
    Object.keys(m._cache).forEach(function (k) {
        if (k.indexOf('\.node') === -1) {
            // don't touch native modules, because they're special
            const mod = m._cache[k];
            const idx = mod?.parent?.children.indexOf(mod);
            if (idx > -1) {
                mod.parent.children.splice(idx, 1);
            }
        }
    });
}

/*
 * Starting in node 0.12 node won't reload native modules
 * The reason is that native modules can register themselves to be loaded automatically
 * This will re-populate the cache with the native modules that have not been mocked
 */
function _repopulateNative(): void {
    Object.keys(originalCache).forEach(function (k) {
        if (k.indexOf('\.node') > -1 && !m._cache[k]) {
            m._cache[k] = originalCache[k];
        }
    });
}

/*
 * Enable function, hooking the Node loader with options.
 */
export function enable(opts: MockOptions): void {
    if (originalLoader) {
        // Already hooked
        return;
    }

    options = _getEffectiveOptions(opts);

    if (options.useCleanCache) {
        originalCache = m._cache;
        m._cache = {};
        _repopulateNative();
    }

    originalLoader = m._load;
    m._load = _hookedLoader;
}

/*
 * Disables mock loading, reverting to normal 'require' behaviour.
 */
export function disable(): void {
    if (!originalLoader) return;

    if (options.useCleanCache) {
        Object.keys(m._cache).forEach(function (k) {
            if (k.indexOf('\.node') > -1 && !originalCache[k]) {
                originalCache[k] = m._cache[k];
            }
        });
        _removeParentReferences();
        m._cache = originalCache;
        originalCache = {};
    }

    m._load = originalLoader;
    originalLoader = null;
}

/*
* If the clean cache option is in effect, reset the module cache to an empty
* state. Calling this function when the clean cache option is not in effect
* will have no ill effects, but will do nothing.
*/
export function resetCache(): void {
    if (options.useCleanCache && originalCache) {
        _removeParentReferences();
        m._cache = {};
        _repopulateNative();
    }
}

/*
 * Enable or disable warnings to the console when previously registered mocks are replaced.
 */
export function warnOnReplace(enable: boolean): void {
    options.warnOnReplace = enable;
}

/*
 * Enable or disable warnings to the console when modules are loaded that have
 * not been registered as a mock.
 */
export function warnOnUnregistered(enable: boolean): void {
    options.warnOnUnregistered = enable;
}

/*
 * Register a mock object for the specified module.
 */
export function registerMock(mod: string, mock): void {
    if (options.warnOnReplace && registeredMocks.hasOwnProperty(mod)) {
        console.warn("WARNING: Replacing existing mock for module: " + mod);
    }
    registeredMocks[mod] = mock;
}

/*
 * Deregister a mock object for the specified module.
 */
export function deregisterMock(mod: string): void {
    if (registeredMocks.hasOwnProperty(mod)) {
        delete registeredMocks[mod];
    }
}

/*
 * Deregister all mocks.
 */
export function deregisterAll(): void {
    registeredMocks = {};
    registeredAllowables = new Set();
}

/*
   Register a module as 'allowed'. 
   This will allow the module to be loaded without mock otherwise a warning would be thrown.
 */
export function registerAllowable(mod: string): void {
    registeredAllowables.add(mod);
}

/*
 * Register an array of 'allowed' modules.
 */
export function registerAllowables(mods: string[]): void {
    mods.forEach((mod) => registerAllowable(mod));
}

/*
 * Deregister a module as 'allowed'.
 */
export function deregisterAllowable(mod: string): void {
    if (registeredAllowables.hasOwnProperty(mod)) {
        registeredAllowables.delete(mod);
    }
}

/*
 * Deregister an array of modules as 'allowed'.
 */
export function deregisterAllowables(mods) {
    mods.forEach(function (mod) {
        deregisterAllowable(mod);
    });
}