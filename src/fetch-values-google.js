import $x from "xpath";
import fetch from "node-fetch";
import { DOMParser as dom } from "xmldom";

let htmlToSqlTranslation = new Map();
htmlToSqlTranslation.set("Wartość energetyczna (kcal)", "kcal");
htmlToSqlTranslation.set("Tłuszcz", "fat");
htmlToSqlTranslation.set("Sód", "salt");
htmlToSqlTranslation.set("Węglowodany", "carbohydrate");
htmlToSqlTranslation.set("Błonnik", "roughage");
htmlToSqlTranslation.set("Cukry", "sugar");
htmlToSqlTranslation.set("Białko", "protein");

/**
 * @param {[]} elements
 */
function mapElements(elements) {
    return elements
        .map((e) => {
            return {
                header: htmlToSqlTranslation.get(
                    e.previousElementSibling.innerHTML
                ),
                value: toNumber(e.innerHTML),
            };
        })
        .filter((e) => e.header);
}

/**
 * @param {String} value
 */
function toNumber(value) {
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

function isNumber(char) {
    return Boolean(Number(char));
}

function isDecimalSeparator(char) {
    return char === "," || char === ".";
}

function createQuery(name, elements) {
    if (typeof name === "undefined") name = getName();
    if (typeof elements === "undefined") elements = getValues();

    return `insert into ingredient (name, ${pluckJoin(
        elements,
        "header"
    )}) values('${name}', ${pluckJoin(elements, "value")});`;
}

function getName() {
    return $x("//h2[@data-attrid='title']/span")[0].innerHTML;
}

function getValues() {
    return mapElements(
        $x("(//div[@class='Kot7x']/div/div/div)//td/span[@class='abs']")
    );
}

function pluckJoin(elements, key) {
    return elements.map(pluck(key)).join(", ");
}

function pluck(key) {
    return (obj) => obj[key];
}

fetch("http://www.ilewazy.pl/cytryna")
    .then((res) => {
        const parsedHTML = res.text();
        const html = parsedHTML.then((e) => {
            const doc = new dom().parseFromString(e);
            const titles = $x.evaluate(
                "//table[@id='ilewazy-ingedients']//tbody//tr//td[1]",
                doc,
                null,
                $x.XPathResult.ANY_TYPE,
                null
            );

            const values = $x.evaluate(
                "//table[@id='ilewazy-ingedients']//tbody//tr//td[2]",
                doc,
                null,
                $x.XPathResult.ANY_TYPE,
                null
            );

            let title = null;
            let value = null;
            
            title = titles.iterateNext();
            value = values.iterateNext();

            while (title && value) {
                console.log(title.firstChild.data.trim());
                console.log(value.firstChild.data.trim());
        
                title = titles.iterateNext();
                value = values.iterateNext();
            }
        });

        return html;
    })
    .catch((e) => e);
