// Converts the csv translation file to json and puts in translations folder

// Language of output file
const language = "ru"

const { readFileSync, writeFileSync } = require("fs");

let csvFile = readFileSync("input.csv", { encoding: "utf-8" });
let result = "";

let count = 0;
let size = csvFile.length;
let index = 0

result += "{";
for (let letter of csvFile) {
	if (letter === `"`) {
		count++;
		if (count < 4) {
			result += letter;
            index ++;
		} else {
            index ++;
            if (index == size-1){
                result += `${letter}`;
            }
            else{
                result += `${letter},`;
            }
			
			count = 0;
		}
	} else {
		result += letter;
		index++;
	}
}
result += "}";

writeFileSync(`translations/${language}.json`, result)

console.log(`Converted and saved to translations/${language}.json`)