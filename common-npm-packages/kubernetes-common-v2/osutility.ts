let os = require('os');

export function getSupportedLinuxArchitecture(): string {
    let supportedArchitecture = "amd64";
    const architecture = os.arch();
    if (architecture.startsWith("arm")) { //both arm64 and arm are handled
        supportedArchitecture = architecture;
    }
    return supportedArchitecture;
}