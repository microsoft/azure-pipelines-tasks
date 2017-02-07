export class Helper{
    public static addToProcessEnvVars(envVars: { [key: string]: string; }, name: string, value: string) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value;
        }
    }

    public static setEnvironmentVariableToString(envVars: { [key: string]: string; }, name: string, value: any) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }

    public static isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }

    public static isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }
}