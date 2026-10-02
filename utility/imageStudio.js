const { AttachmentBuilder } = require("discord.js");

const IMAGE_STUDIO_URL = "https://image-studio-green.vercel.app";
const IMAGE_STUDIO_TIMEOUT = 20_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function createImageStudioAttachment(payload, filename) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), IMAGE_STUDIO_TIMEOUT);

	try {
		const response = await fetch(IMAGE_STUDIO_URL + "/api/generate", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal,
		});

		if (!response.ok) {
			throw new Error(`Image Studio returned HTTP ${response.status}`);
		}

		const image = Buffer.from(await response.arrayBuffer());
		if (image.length <= PNG_SIGNATURE.length || !image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
			throw new Error("Image Studio returned an invalid PNG image");
		}

		return new AttachmentBuilder(image, { name: filename });
	} finally {
		clearTimeout(timeout);
	}
}

module.exports = { createImageStudioAttachment };
