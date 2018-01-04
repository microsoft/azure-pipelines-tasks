// This class manages the powershell parameters format

export interface NameValuePair {
    name: string;
    value: string;
}

export class PowerShellParameters {

    // Parses the string and retuens array of key-value pairs
    public static parse(input: string, removeQuotes?: boolean, escapeCharacter?: string): NameValuePair[] {
        if (!!escapeCharacter) {
            this.escapeCharacter = escapeCharacter;
        }
        var result: NameValuePair[] = [];
        var index = 0;
        var obj: NameValuePair = { name: "", value: "" };

        input = input.trim();

        while (index < input.length) {
            var literalData = this.findLiteral(input, index);
            var nextIndex = literalData.currentPosition;
            var hasSpecialCharacter = literalData.hasSpecialCharacter;
            var literal = input.substr(index, nextIndex - index).trim();
            if (this.isName(literal, hasSpecialCharacter)) {
                if (obj.name) {
                    result.push(obj);
                    obj = { name: "", value: "" };
                }
                //substr from index 1 to remove '-' in the starting of literal
                obj.name = literal.substr(1, literal.length);
            }
            else {
                obj.value = literal;
                result.push(obj);
                obj = { name: "", value: "" };
            }

            index = nextIndex + 1;
        }

        if (obj.name) {
            result.push(obj);
        }
        if (!!removeQuotes) {
            for (var name in result) {
                result[name].value = result[name].value.replace(/^"(.*)"$/, '$1');
            }
        }

        this.escapeCharacter = "`"; // Resetting escape character
        return result;
    }

    // Serializes the parameter array to string
    public static serialize(parameters: NameValuePair[]): string {
        var result = "";
        if (parameters) {
            for (var i = 0; i < parameters.length; i++) {
                if (parameters[i].name) {
                    result += "-" + parameters[i].name + " ";
                }
                if (parameters[i].value) {
                    result += parameters[i].value + " ";
                }
            }
        }

        return result.trim();
    }

    public static findFirst(parameters: NameValuePair[], name: string) {
        var index = -1;
        for (var i = 0; i < parameters.length; ++i) {
            if (parameters[i].name.toLowerCase() === name.toLowerCase()) {
                index = i;
                break;
            }
        }
        return index;
    }

    // Deletes the first occurance of parameter if exists and returns the deleted value
    public static delete(parameters: NameValuePair[], name: string): NameValuePair {

        var deleteIndex = -1;
        var deletedValue = null;

        // Find first occurance
        var deleteIndex = this.findFirst(parameters, name);

        // Save a copy and Delete
        if (deleteIndex >= 0) {
            deletedValue = parameters.splice(deleteIndex, 1)[0];
        }

        return deletedValue;
    }

    private static isName(literal: string, hasSpecialCharacter: boolean): boolean {
        return literal[0] === '-' && !hasSpecialCharacter && isNaN(Number(literal));
    }

    private static findLiteral(input, currentPosition) {
        var hasSpecialCharacter = false;
        for (; currentPosition < input.length; currentPosition++) {
            if (input[currentPosition] == " " || input[currentPosition] == "\t") {
                for (; currentPosition < input.length; currentPosition++) {
                    if (input[currentPosition + 1] != " " && input[currentPosition + 1] != "\t") {
                        break;
                    }
                }

                break;
            }
            else if (input[currentPosition] == "(") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, ")");
                hasSpecialCharacter = true;
            }
            else if (input[currentPosition] == "[") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, "]");
                hasSpecialCharacter = true;
            }
            else if (input[currentPosition] == "{") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, "}");
                hasSpecialCharacter = true;
            }
            else if (input[currentPosition] == "\"") {
                //keep going till this one closes
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "\"");
                hasSpecialCharacter = true;
            }
            else if (input[currentPosition] == "'") {
                //keep going till this one closes
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "'");
                hasSpecialCharacter = true;
            }
            else if (input[currentPosition] == this.escapeCharacter) {
                currentPosition++;
                hasSpecialCharacter = true;
                if (currentPosition >= input.length) {
                    break;
                }
            }

        }
        return { currentPosition: currentPosition, hasSpecialCharacter: hasSpecialCharacter };
    }

    private static findClosingBracketIndex(input, currentPosition, closingBracket): number {
        for (; currentPosition < input.length; currentPosition++) {
            if (input[currentPosition] == closingBracket) {
                break;
            }
            else if (input[currentPosition] == "(") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, ")");
            }
            else if (input[currentPosition] == "[") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, "]");
            }
            else if (input[currentPosition] == "{") {
                currentPosition = this.findClosingBracketIndex(input, currentPosition + 1, "}");
            }
            else if (input[currentPosition] == "\"") {
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "\"");
            }
            else if (input[currentPosition] == "'") {
                currentPosition = this.findClosingQuoteIndex(input, currentPosition + 1, "'");
            }
            else if (input[currentPosition] == this.escapeCharacter) {
                currentPosition++;
                if (currentPosition >= input.length) {
                    break;
                }
            }
        }

        return currentPosition;
    }

    private static findClosingQuoteIndex(input, currentPosition, closingQuote) {
        for (; currentPosition < input.length; currentPosition++) {
            if (input[currentPosition] == this.escapeCharacter) {
                currentPosition++;
                if (currentPosition >= input.length) {
                    break;
                }
            }
            else if (input[currentPosition] == closingQuote) {
                break;
            }
        }

        return currentPosition;
    }

    private static escapeCharacter = "`";
}
