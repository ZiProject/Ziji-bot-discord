const fs = require("fs");
const zlib = require("zlib");

const words = [];

for (const line of fs.readFileSync("words.txt", "utf8").split("\n")) {
	const trimmed = line.trim();
	if (!trimmed) continue;

	try {
		const obj = JSON.parse(trimmed);

		if (obj.text) {
			words.push(obj.text.trim().toLowerCase());
		}
	} catch {}
}

words.sort();

const json = JSON.stringify(words);

const compressed = zlib.brotliCompressSync(Buffer.from(json), {
	params: {
		[zlib.constants.BROTLI_PARAM_QUALITY]: 11,
	},
});

fs.writeFileSync("dictionary.br", compressed);
