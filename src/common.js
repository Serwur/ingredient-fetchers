/**
 * @param {String} value
 * @returns {Number}
 */
export function toNumber(value) {
    const _value = value.trim();
    let number = "";

    for (var i = 0; i < _value.length; i++) {
        const char = _value[i];

        if (isNumber(char)) {
            number += char;
        } else if (isDecimalSeparator(char)) {
            number += ".";
        } else {
            break;
        }
    }

    number = Number(number);

    let unit = _value.substr(i).trim();

    switch (unit) {
        case "g":
            return number;
        case "mg":
            return number / 1000;
        default:
            return number;
    }
}

/**
 * @param {String} char
 * @returns {Boolean}
 */
export function isNumber(char) {
    return Boolean(Number(char));
}

/**
 * @param {String} char
 * @returns {Boolean}
 */
export function isDecimalSeparator(char) {
    return char === "," || char === ".";
}

/**
 * @param {[]} elements
 * @param {String} key
 * @returns {String}
 */
export function pluckJoin(elements, key) {
    return elements.map(pluck(key)).join(", ");
}

/**
 * @param {String} key
 */
export function pluck(key) {
    return (obj) => obj[key];
}
