/**
 * Data class for a message that will be posted to the current code review
 * 
 * @export
 * @class Message
 */
export class Message {

    private _content: string;
    private _file: string;
    private _line: number;
    private _priority: number;

    /**
     * Creates an instance of Message.
     * 
     */
    constructor(content: string, file: string, line: number, priority: number) {
        if (!content) {
            throw new ReferenceError('A message must have content');
        }

        if (!file) {
            throw new ReferenceError('A message must belong to a file');
        }

        if (line < 1) {
            throw new ReferenceError('A message must belong to a line in the file.');
        }

        this._content = content;
        this._file = file;
        this._line = line;
        this._priority = priority;
    }

    public static compare(a: Message, b: Message): number {
            return a.priority - b.priority;
    }

    /**
     * The textual content of the message that will be posted. MD format might be supported
     * 
     * @readonly
     * @type {string}
     */
    get content(): string {
        return this._content;
    }

    /**
     * The path, relative to the repo root, to the file where the comment will be posted.
     * 
     * @readonly
     * @type {string}
     */
    get file(): string {
        return this._file;
    }

    /**
     * The line number where the message is to be posted
     * 
     * @readonly
     * @type {number}
     */
    get line(): number {
        return this._line;
    }

    /**
     * The priority of the message, used to limit the number of messages that get posted. 
     * A lower number means a message is more likely to be posted.
     * 
     * @readonly
     * @type {number}
     */
    get priority(): number {
        return this._priority;
    }

    /**
     * Returns a string representation fo the message, useful for outputting in the logs / errors
     * 
     * @returns {string}
     * 
     * @memberOf Message
     */
    public toString() : string {
        return JSON.stringify(this, null, 4);
    }

}