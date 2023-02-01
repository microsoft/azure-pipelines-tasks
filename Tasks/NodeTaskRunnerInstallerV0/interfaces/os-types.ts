// TODO: Reuse in node-installer-common

// https://nodejs.org/api/os.html#osplatform
export type NodeOsPlatform = NodeJS.Platform;

// https://nodejs.org/api/os.html#osarch
export type NodeOsArch = 'arm' | 'arm64' | 'ia32' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 's390' | 's390x' | 'x64';

/**
 * Node.js distribution architectures names not everytime matches with os.arch().
 *
 * Example: ia32 => x86
 */
export type NodeDistroOsArch = Exclude<NodeOsArch, 'ia32'> | 'x86';

export type TargetOsInfo = {
    osArch: NodeDistroOsArch,
    osPlatform: NodeOsPlatform
};
