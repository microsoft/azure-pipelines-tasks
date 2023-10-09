import { NodeDistroOsArch, NodeOsArch } from '../interfaces/os-types';

export function mapOsArchToDistroVariant(osArch: NodeOsArch): NodeDistroOsArch {

    switch (osArch) {
        case 'ia32': return 'x86';

        default: return osArch;
    }
}
