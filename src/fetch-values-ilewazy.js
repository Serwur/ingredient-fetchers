const $x = module.require("xpath");
const fetch = module.require("node-fetch");
const dom = module.require("xmldom").DOMParser;

const PAGE_URL = "http://www.ilewazy.pl";

const htmlToSqlTranslation = new Map();
htmlToSqlTranslation.set("Energia", "kcal");
htmlToSqlTranslation.set("Tłuszcz", "fat");
htmlToSqlTranslation.set("Sól", "salt");
htmlToSqlTranslation.set("Węglowodany", "carbohydrate");
htmlToSqlTranslation.set("Błonnik", "roughage");
htmlToSqlTranslation.set("Białko", "protein");

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

function findNames(doc) {
    return find("//table[@id='ilewazy-ingedients']//tbody//tr//td[1]", doc);
}

function findValues(doc) {
    return find("//table[@id='ilewazy-ingedients']//tbody//tr//td[2]", doc);
}

function find(xquery, doc) {
    return $x.evaluate(xquery, doc, null, $x.XPathResult.ANY_TYPE, null);
}

function createEntry(columnName, value) {
    return {
        columnName,
        value,
    };
}

function findElements(parsedHTML) {
    const document = toDOM(parsedHTML);
    const names = findNames(document);
    const values = findValues(document);

    return { names, values };
}

function createEntries(nodes) {
    const entries = [];
    const { names, values } = nodes;

    let name = null;
    let value = null;

    name = names.iterateNext();
    value = values.iterateNext();

    while (name && value) {
        entries.push(
            createEntry(
                name.firstChild.data.trim(),
                toNumber(value.firstChild.data.trim())
            )
        );

        name = names.iterateNext();
        value = values.iterateNext();
    }

    return entries;
}

/**
 * @param {String} name
 */
async function getNutritionalValues(name) {
    return fetch(`${PAGE_URL}/${name}`)
        .then((res) => res.text())
        .then((parsedHTML) => {
            const nodes = findElements(parsedHTML);
            const entries = createEntries(nodes);
            return entries;
        })
        .catch(console.error);
}

function pluckJoin(elements, key) {
    return elements.map(pluck(key)).join(", ");
}

function pluck(key) {
    return (obj) => obj[key];
}

function createQuery(name, elements) {
    return `insert into ingredient (name, ${pluckJoin(
        elements,
        "columnName"
    )}) values('${name}', ${pluckJoin(elements, "value")});`;
}

async function findIngredients(name, pages) {
    const promises = [];
    pages = pages ? pages : 3;
    for (let i = 1; i <= pages; i++) {
        promises.push(findIngredientsPage(name, i));
    }

    return Promise.all(promises.map((p) => p())).then(flatten);
}

function findIngredientsPage(name, pageNo) {
    return async () =>
        fetch(`${PAGE_URL}/produkty/page/${pageNo}/q/${name}`)
            .then((res) => res.text())
            .then((parsedHTML) => {
                const results = getResults(parsedHTML);
                const links = getIngredientLinks(results);
                return links;
            })
            .catch(console.error);
}

function getResults(parsedHTML) {
    return find("//ul[@id='thumbnails']/li/a", toDOM(parsedHTML));
}

/**
 * Fetches href attribute from 'a' element
 * @param {XPathResult} results
 */
function getIngredientLinks(results) {
    const links = [];
    let result = results.iterateNext();

    while (result) {
        links.push(result.attributes[0].value.substr(1));
        result = results.iterateNext();
    }

    return links;
}

/**
 * @param {XPathResult} nodes
 */
function printNodes(nodes) {
    let node = nodes.iterateNext();
    while (node) {
        console.log(node.attributes[0].value);
        node = nodes.iterateNext();
    }
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

function filterEntries(entries) {
    return entries
        .filter((e) => htmlToSqlTranslation.has(e.columnName))
        .map((e) => {
            return {
                columnName: htmlToSqlTranslation.get(e.columnName),
                value: e.value,
            };
        });
}

async function createEntriesFromQueryingName(name, pages) {
    let names = [];
    let ntrValuesPromises = [];

    console.time("Page fetching duration");
    await findIngredients(name, pages).then((ingredientNames) => {
        console.timeEnd("Page fetching duration");
        names = ingredientNames;
        ntrValuesPromises = ingredientNames.map(getNutritionalValues);
    });

    console.time("Fetching nutritional values duration");
    return Promise.all(ntrValuesPromises).then((values) => {
        console.timeEnd("Fetching nutritional values duration");
        const ingredients = [];
        for (let i = 0; i < values.length; i++) {
            ingredients.push({
                name: names[i],
                values: filterEntries(values[i]),
            });
        }
        return ingredients;
    });
}

if (process.argv < 4)
    throw new Error(
        "This file require two parameters. First - name of queried ingredient, Second - number of pages"
    );

const ingredientName = process.argv[2];
const numberOfPages = process.argv[3];

if (!isNumber(numberOfPages))
    throw new Error("Second argument must be a number");
if (numberOfPages <= 0)
    throw new Error("Second argument cannot be less or equal to 0");

createEntriesFromQueryingName(ingredientName, numberOfPages)
    .then((ingredients) => {
        console.time("Creating queries duration");
        const queries = ingredients.map((ingr) =>
            createQuery(ingr.name, ingr.values)
        );
        console.timeEnd("Creating queries duration");
        return queries;
    })
    .then((ingredients) => {
        for (let i = 0; i < ingredients.length; i++) {
            console.log(ingredients[i]);
        }
    });
