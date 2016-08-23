export class VersionInfoVersion {
    public a: number;
    public b: number;
    public c: number;
    public d: number;

    public constructor(a: number, b: number, c: number, d: number) {
        this.a = a;
        this.b = b;
        this.c = c;
        this.d = d;
    }

    public static fromDWords(highDWord: number, lowDWord: number): VersionInfoVersion {
        // tslint:disable-next-line:no-bitwise
        return new VersionInfoVersion(highDWord >>> 16, highDWord & 0xFFFF, lowDWord >>> 16, lowDWord & 0xFFFF);
    }

    public static compare(left: VersionInfoVersion, right: VersionInfoVersion): number {
        return left.a - right.a || left.b - right.b || left.c - right.c || left.d - right.d;
    }

    public toString() {
        return `${this.a}.${this.b}.${this.c}.${this.d}`;
    }

    public equals(other: VersionInfoVersion): boolean {
        return VersionInfoVersion.compare(this, other) === 0;
    }

    public static MAX_VERSION = new VersionInfoVersion(0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF);
    public static MIN_VERSION = new VersionInfoVersion(0x0, 0x0, 0x0, 0x0);
}

export default VersionInfoVersion;
