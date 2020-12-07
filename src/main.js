const yargs = require("yargs");
const { createQueries } = require("./fetchers/fetch-values-ilewazy");

yargs
    .scriptName("ilewazy")
    .usage("$0 <cmd> [args]")
    .command(
        "$0 [ingredientName]",
        "fetch & create queries from ilewazy.pl",
        (yargs) => {
            yargs
                .positional("ingredientName", {
                    describe: "ingredient name to be queried",
                    type: "string"
                })
                .option("pages", {
                    alias: "p",
                    type: "number",
                    default: 1,
                    description: "number of pages to be fetched/queried",
                });
        },
        (argv) => {
            createQueries(argv.ingredientName, argv.pages);
        }
    )
    .help().argv;
