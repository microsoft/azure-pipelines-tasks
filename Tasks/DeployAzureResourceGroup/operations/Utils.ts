export class Utils {
    public static isNonEmpty(str: string): boolean {
        return (!!str && !!str.trim());
    }
}