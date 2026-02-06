const { JSX, Builder, loadImage, FontFactory, Font } = require("canvacord");

module.exports = class WelcomeCard extends Builder {
	constructor() {
		super(930, 280);
		this.bootstrap({
			displayName: "",
			type: "welcome",
			avatar: "",
			message: "",
		});
		if (!FontFactory.size) Font.loadDefault();
	}

	setDisplayName(v) {
		this.options.set("displayName", v);
		return this;
	}
	setType(v) {
		this.options.set("type", v);
		return this;
	}
	setAvatar(v) {
		this.options.set("avatar", v);
		return this;
	}
	setMessage(v) {
		this.options.set("message", v);
		return this;
	}

	async render() {
		const { type, displayName, avatar, message } = this.options.getOptions();
		const image = await loadImage(avatar);
		const imane = await loadImage("./utility/welcome.png");

		return JSX.createElement(
			"img",
			{ src: imane.toDataURL() },
			JSX.createElement(
				"div",
				{ className: "px-6 w-[96%] h-[84%] rounded-lg flex items-center" },
				JSX.createElement("img", {
					src: image.toDataURL(),
					className: "flex h-[40] w-[40] rounded-full",
				}),
				JSX.createElement(
					"div",
					{ className: "flex flex-col ml-6" },
					JSX.createElement(
						"h1",
						{ className: "text-5xl text-white font-bold m-0" },
						type === "welcome" ? "Welcome, " : "Goodbye, ",
						JSX.createElement("span", { className: "text-blue-500" }, displayName, "!"),
					),
					JSX.createElement("p", { className: "text-gray-300 text-3xl m-0" }, message),
				),
			),
		);
	}
};
