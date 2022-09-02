// Converts translate.json file to translate.csv file 

const fs = require("fs")
let inputFile = JSON.parse(fs.readFileSync('translations/translate.json', 'utf8'))

fs.writeFileSync("translate.csv", "")
for (const [key, value] of Object.entries(inputFile)){
    fs.appendFileSync("translate.csv", `"${key}"` + "\n")
}

console.log("Saved to translate.csv");