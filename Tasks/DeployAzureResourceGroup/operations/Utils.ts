class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }

    public static getError(error: any) {
        if (error && error.message) {
            return error.message;
        }

        return error;
    }
}

export = Utils;