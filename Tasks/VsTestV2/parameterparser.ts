import tl = require('azure-pipelines-task-lib/task');
// resusing from https://github.com/Microsoft/azure-pipelines-tasks/tree/04293a25f9ecc7d91cecd2c4f130904bdbf3544d/Tasks/AzureResourceGroupDeployment

export function parse(input: string) {
    var result = {};
    var index = 0;
    var obj = { name: "", value: "" };
    while (index < input.length) {
        var literalData = findLiteral(input, index);
        var nextIndex = literalData.currentPosition;
        var specialCharacterFlag = literalData.specialCharacterFlag;
        var literal = input.substr(index, nextIndex - index).trim();
        if (isName(literal, specialCharacterFlag)) {
            if (obj.name) {
                result[obj.name] = { value: obj.value };
                obj = { name: "", value: "" };
            }
            obj.name = literal.substr(1, literal.length);
        } else {
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
        result[name].value = result[name].value.replace(/^"(.*)"$/, "$1");
        tl.debug("Name : "+ name + " Value : " + result[name].value);
    }
    return result;
}

function isName(literal: string, specialCharacterFlag: boolean): boolean {
    return literal[0] === "-" && !specialCharacterFlag;
}

function findLiteral(input, currentPosition) {
    var specialCharacterFlag = false;
    for (; currentPosition < input.length; currentPosition++) {
        if (input[currentPosition] === " " || input[currentPosition] === "\t") {
            for (; currentPosition < input.length; currentPosition++) {
                if (input[currentPosition + 1] !== " " || input[currentPosition + 1] !== "\t") {
                    break;
                }
            }
            break;
        } else if (input[currentPosition] === "(") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, ")");
            specialCharacterFlag = true;
        } else if (input[currentPosition] === "[") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "]");
            specialCharacterFlag = true;
        } else if (input[currentPosition] === "{") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "}");
            specialCharacterFlag = true;
        } else if (input[currentPosition] === "\"") {
            // keep going till this one closes
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "\"");
            specialCharacterFlag = true;
        } else if (input[currentPosition] === "'") {
            // keep going till this one closes
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "'");
            specialCharacterFlag = true;
        } else if (input[currentPosition] === "`") {
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
        if (input[currentPosition] === closingBracket) {
            break;
        }
        else if (input[currentPosition] === "(") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, ")");
        }
        else if (input[currentPosition] === "[") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "]");
        }
        else if (input[currentPosition] === "{") {
            currentPosition = findClosingBracketIndex(input, currentPosition + 1, "}");
        }
        else if (input[currentPosition] === "\"") {
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "\"");
        }
        else if (input[currentPosition] === "'") {
            currentPosition = findClosingQuoteIndex(input, currentPosition + 1, "'");
        }
        else if (input[currentPosition] === "`") {
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
        if (input[currentPosition] === closingQuote) {
            break;
        }
        else if (input[currentPosition] === "`") {
            currentPosition++;
            if (currentPosition >= input.length) {
                break;
            }
        }
    }
    return currentPosition;
}