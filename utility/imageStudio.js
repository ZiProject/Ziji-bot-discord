const { AttachmentBuilder } = require("discord.js");

const IMAGE_STUDIO_URL = "https://image-studio-green.vercel.app";
const IMAGE_STUDIO_TIMEOUT = 500_000;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF_SIGNATURES = [Buffer.from("GIF87a"), Buffer.from("GIF89a")];

async function createImageStudioAttachment(payload, filename) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), IMAGE_STUDIO_TIMEOUT).unref();

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
		const isPng = image.length > PNG_SIGNATURE.length && image.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
		const isGif = GIF_SIGNATURES.some(
			(signature) => image.length > signature.length && image.subarray(0, signature.length).equals(signature),
		);
		if (!isPng && !isGif) {
			throw new Error("Image Studio returned an invalid PNG or GIF image");
		}
		return new AttachmentBuilder(image, { name: filename });
	} finally {
		clearTimeout(timeout);
	}
}

function validateImageStudioAnimation(payload) {
	if (
		!payload ||
		payload.type !== "animated" ||
		!payload.data ||
		payload.data.format !== "gif" ||
		!Array.isArray(payload.data.tracks) ||
		payload.data.tracks.length === 0
	) {
		throw new Error("Animation payload must contain type 'animated', data.format 'gif', and at least one frame");
	}
	return payload;
}

async function readImageStudioAnimation(attachment) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), IMAGE_STUDIO_TIMEOUT).unref();

	try {
		const response = await fetch(attachment.url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error(`Could not download animation payload: HTTP ${response.status}`);
		}
		return validateImageStudioAnimation(await response.json());
	} finally {
		clearTimeout(timeout);
	}
}

function prepareImageStudioAnimation(payload, variables) {
	validateImageStudioAnimation(payload);
	const replacements = { ...payload.templateVariables, ...variables };

	const replaceVariables = (value) => {
		if (typeof value === "string") {
			return value.replace(/\{([^{}]+)\}/g, (placeholder, name) =>
				Object.hasOwn(replacements, name) ? String(replacements[name]) : placeholder,
			);
		}
		if (Array.isArray(value)) return value.map(replaceVariables);
		if (value && typeof value === "object") {
			return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceVariables(item)]));
		}
		return value;
	};

	return replaceVariables({ type: payload.type, data: payload.data });
}

module.exports = {
	createImageStudioAttachment,
	prepareImageStudioAnimation,
	readImageStudioAnimation,
	validateImageStudioAnimation,
};
