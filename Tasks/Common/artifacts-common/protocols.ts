export enum ProtocolType {
    NuGet,
    Maven,
    Npm,
    PyPi
}

export function getAreaIdForProtocol(protocolType: ProtocolType): string {
    switch (protocolType) {
        case ProtocolType.Maven:
            return '6F7F8C07-FF36-473C-BCF3-BD6CC9B6C066';
        case ProtocolType.Npm:
            return '4C83CFC1-F33A-477E-A789-29D38FFCA52E';
        case ProtocolType.PyPi:
            return '92F0314B-06C5-46E0-ABE7-15FD9D13276A';
        default:
        case ProtocolType.NuGet:
            return 'B3BE7473-68EA-4A81-BFC7-9530BAAA19AD';
    }
}