export default class Constants {
    static readonly ipv4MatchPattern = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    static readonly connectionStringTester = /^[;\s]*([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*)))(;[;\s]*([\w\s]+=(?:('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))))*[;\s]*$/;
    static readonly connectionStringParserRegex = /(?<key>[\w\s]+)=(?<val>('[^']*(''[^']*)*')|("[^"]*(""[^"]*)*")|((?!['"])[^;]*))/g;

    static readonly dacpacExtension = ".dacpac";
    static readonly sqlFileExtension = ".sql";
    static readonly sqlprojExtension = ".sqlproj";

    static readonly sqlcmdPasswordEnvVarName = "SQLCMDPASSWORD";
}
