export declare enum ProtocolType {
    NuGet = 0,
    Maven = 1,
    Npm = 2,
    PyPi = 3,
}
export declare function getAreaIdForProtocol(protocolType: ProtocolType): string;
