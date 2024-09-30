const tl = require('azure-pipelines-task-lib/mock-task');

export const tlClone = Object.assign({}, tl);

tlClone.setStdStream({
    write: (msg) => null
});

tlClone.getVariable = variable => {
    if (variable.toLowerCase() == 'system.teamfoundationcollectionuri') {
        return 'https://localhost/';
    }

    return variable;
};
tlClone.getEndpointAuthorizationParameter = (id: string, key: string, optional: boolean) => `${id}_${key}_${optional}`;
tlClone.getSecureFileName = (secureFileId: number) => secureFileId;
tlClone.getSecureFileTicket = () => {
    return true;
};
