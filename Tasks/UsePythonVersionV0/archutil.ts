export type Arch = 'x86' | 'x64' | 'arm' | 'arm64';

export function resolveArchitecture(input?: string): Arch {
  if (input && ['x86', 'x64', 'arm', 'arm64'].includes(input)) {
    return input as Arch;
  }

  const envArch = (process.env['AGENT_OSARCH'] || '').toLowerCase();
  if (envArch.includes('arm64') || envArch.includes('aarch64')) return 'arm64';
  if (envArch.startsWith('arm')) return 'arm';
  if (envArch.includes('x86')) return 'x86';

  const nodeArch = (process.arch || '').toLowerCase();
  if (nodeArch === 'arm64' || nodeArch === 'aarch64') return 'arm64';
  if (nodeArch.startsWith('arm')) return 'arm';
  if (nodeArch === 'ia32' || nodeArch === 'x86') return 'x86';
  return 'x64';
}