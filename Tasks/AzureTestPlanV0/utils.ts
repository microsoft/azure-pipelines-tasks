export function removeParenthesesFromEnd(inputString) {
    // Check if the string ends with parentheses
    if (inputString.endsWith('()')) {
        // Remove the parentheses from the end
        return inputString.slice(0, -2);
    } else {
        // If no parentheses at the end, return the original string
        return inputString;
    }
}

export function replaceLastDotWithHash(inputString) {
    const lastDotIndex = inputString.lastIndexOf('.');

    if (lastDotIndex !== -1) {
        const stringWithHash = inputString.slice(0, lastDotIndex) + '#' + inputString.slice(lastDotIndex + 1);
        return stringWithHash;
    } else {
        // If there is no dot in the string, return the original string
        return inputString;
    }
}

