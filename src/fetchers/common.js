const dom = module.require("xmldom").DOMParser;
const $x = module.require("xpath");

/**
 * @param {String} value
 * @returns {Number}
 */
function toNumber(value) {
    const _value = value.trim();
    let number = "";

    for (var i = 0; i < _value.length; i++) {
        const char = convertToNumberable(_value[i]);
        if (char === null) break;
        number += char;
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

function convertToNumberable(char) {
    if (isNumber(char)) return char;
    if (isDecimalSeparator(char)) return ".";
    return null;
}

/**
 * @param {String} char
 * @returns {Boolean}
 */
function isNumber(char) {
    return !isNaN(Number(char));
}

/**
 * @param {String} char
 * @returns {Boolean}
 */
function isDecimalSeparator(char) {
    return char === "," || char === ".";
}

function toDOM(html) {
    return new dom({ errorHandler: function () {} }).parseFromString(html);
}

/**
 * @param {[]} elements
 * @param {String} key
 * @returns {String}
 */
function pluckJoin(elements, key) {
    return elements.map(pluck(key)).join(", ");
}

/**
 * @param {String} key
 */
function pluck(key) {
    return (obj) => obj[key];
}

function find(xquery, doc) {
    return $x.evaluate(xquery, doc, null, $x.XPathResult.ANY_TYPE, null);
}

function flatten(array) {
    var flattend = [];
    !(function flat(array) {
        array.forEach(function (el) {
            if (Array.isArray(el)) flat(el);
            else flattend.push(el);
        });
    })(array);
    return flattend;
}

module.exports.toNumber = toNumber;
module.exports.convertToNumberable = convertToNumberable;
module.exports.isNumber = isNumber;
module.exports.isDecimalSeparator = isDecimalSeparator;
module.exports.toDOM = toDOM;
module.exports.pluckJoin = pluckJoin;
module.exports.pluck = pluck;
module.exports.find = find;
module.exports.flatten = flatten;
