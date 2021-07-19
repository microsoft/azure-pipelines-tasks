// TODO: This whole file is copied from AzureResourceGroupDeployment task. Move this parser to common lib
// Similar parser is used in Grid UI extension. Try to move the code to some place where all can use it.

export function parse(input: string): {[key: string]: any} {
    var result = {};
    var index = 0;
    var obj = { name: "", value: "" };
    while (index < input.length) {
        var literalData = findLiteral(input, index);
        var nextIndex = literalData.currentPosition;
        var specialCharacterFlag = literalData.specialCharacterFlag
        var literal = input.substr(index, nextIndex - index).trim();
        if (isName(literal, specialCharacterFlag)) {
            if (obj.name) {
                result[obj.name] = { value: obj.value };
                obj = { name: "", value: "" };
            }
            obj.name = literal.substr(1, literal.length);
        }
        else {
            obj.value = literal;
            result[obj.name] = { value: obj.value };
            obj = { name: "", value: "" };
        }
        index = nextIndex + 1;
    }
    if (obj.name) {
        result[obj.name] = { value: obj.value };
    }
    for (var name in result) {
        result[name].value = result[name].value.replace(/^"(.*)"$/, '$1');
    }
    return result;
}

function isName(literal: string, specialCharacterFlag: boolean): boolean {
    return literal[0] === '-' && !specialCharacterFlag && isNaN(Number(literal));
}

function findLiteral(input, currentPosition): {[key: string]: any} {
    var specialCharacterFlag = false;
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
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, ")");
            specialCharacterFlag = true;
        }
        else if (input[currentPosition] == "[") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "]");
            specialCharacterFlag = true;
        }
        else if (input[currentPosition] == "{") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "}");
            specialCharacterFlag = true;
        }
        else if (input[currentPosition] == "\"") {
            //keep going till this one closes
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "\"");
            specialCharacterFlag = true;
        }
        else if (input[currentPosition] == "'") {
            //keep going till this one closes
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "'");
            specialCharacterFlag = true;
        }
        else if (input[currentPosition] == "`") {
            currentPosition++;
            specialCharacterFlag = true;
            if (currentPosition >= input.length) {
                break;
            }
        }
    }
    return { currentPosition: currentPosition, specialCharacterFlag: specialCharacterFlag };
}

function findClosingBracketIndex(input, currentPosition, closingBracket): number {
    for (; currentPosition < input.length; currentPosition++) {
        if (input[currentPosition] == closingBracket) {
            break;
        }
        else if (input[currentPosition] == "(") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, ")");
        }
        else if (input[currentPosition] == "[") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "]");
        }
        else if (input[currentPosition] == "{") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "}");
        }
        else if (input[currentPosition] == "\"") {
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "\"");
        }
        else if (input[currentPosition] == "'") {
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "'");
        }
        else if (input[currentPosition] == "`") {
            currentPosition++;
            if (currentPosition >= input.length) {
                break;
            }
        }
    }
    return currentPosition;
}

function findClosingQuoteIndex(input, currentPosition, closingQuote) {
    for (; currentPosition < input.length; currentPosition++) {
        if (input[currentPosition] == closingQuote) {
            break;
        }
        else if (input[currentPosition] == "`") {
            currentPosition++;
            if (currentPosition >= input.length) {
                break;
            }
        }
    }
    return currentPosition;
}
