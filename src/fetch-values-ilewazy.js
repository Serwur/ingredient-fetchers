const {
    toDOM,
    find,
    flatten,
    toNumber,
    isNumber,
    pluckJoin,
} = require("./common");

const fetch = module.require("node-fetch");

const PAGE_URL = "http://www.ilewazy.pl";
const BAD_NAMES = [
    "szklanka",
    "lyzka",
    "porcja",
    "plasterek",
    "plaster",
    "garsc",
    "lyzeczka",
    "kawalek",
];

const htmlToSqlTranslation = new Map();
htmlToSqlTranslation.set("Energia", "kcal");
htmlToSqlTranslation.set("Tłuszcz", "fat");
htmlToSqlTranslation.set("Sól", "salt");
htmlToSqlTranslation.set("Węglowodany", "carbohydrate");
htmlToSqlTranslation.set("Błonnik", "roughage");
htmlToSqlTranslation.set("Białko", "protein");

class Entry {
    constructor(columnName, value) {
        this.columnName = columnName.trim();
        this.value = toNumber(value.trim());
    }
}

function findNames(doc) {
    return find("//table[@id='ilewazy-ingedients']//tbody//tr//td[1]", doc);
}

function findValues(doc) {
    return find("//table[@id='ilewazy-ingedients']//tbody//tr//td[2]", doc);
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
    const request = `${PAGE_URL}/${name}`;
    console.log("Sending request: ", request);
    return fetch(encodeURI(request))
        .then((res) => res.text())
        .then((parsedHTML) => {
            const nodes = findElements(parsedHTML);
            const entries = createEntries(nodes);
            return entries;
        })
        .catch(console.error);
}

function createQuery(entry) {
    return `insert into ingredient (name, ${pluckJoin(
        entry.values,
        "columnName"
    )}) values('${entry.name}', ${pluckJoin(entry.values, "value")});`;
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
    return async () => {
        const request = `${PAGE_URL}/produkty/page/${pageNo}/q/${name}`;

        console.log("Sending request: ", request);

        return fetch(encodeURI(request))
            .then((res) => res.text())
            .then((parsedHTML) => {
                const results = getResults(parsedHTML);
                const links = getIngredientLinks(results);
                return links;
            })
            .catch(console.error);
    };
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

String.prototype.firstUpperRestLower = function () {
    if (this.length === 0) return "";
    if (this.length === 1) return this.toUpperCase();
    return this[0].toUpperCase() + this.substr(1);
};

/**
 * @param {String} name
 */
function convertName(name) {
    return BAD_NAMES.reduce(
        (currentName, badName) => currentName.replace(badName, ""),
        name
    )
        .replace(/-/g, " ")
        .trim()
        .firstUpperRestLower();
}

/**
 *
 * @param {[]} entries
 */
function convertEntriesNames(entries) {
    return entries.map((entry) => {
        return {
            name: convertName(entry.name),
            values: entry.values,
        };
    });
}

function filterUnique(entriesToFilter) {
    const uniqueEntries = new Set();
    const entries = [];

    entriesToFilter.forEach((entry) => {
        if (!uniqueEntries.has(entry.name)) {
            uniqueEntries.add(entry.name);
            entries.push(entry);
        }
    });

    return entries;
}

/**
 * @param {[]} entries
 */
function createQueriesFromEntries(entries) {
    return entries.map((entry) => createQuery(entry));
}

/**
 * @param {[]} array
 */
function printEach(array) {
    for (let i = 0; i < array.length; i++) console.log(array[i]);
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
    .then(convertEntriesNames)
    .then(filterUnique)
    .then(createQueriesFromEntries)
    .then(printEach);
