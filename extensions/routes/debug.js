const { useHooks } = require("zihooks");

module.exports.data = {
	name: "DebugRoutes",
	description: "Bot all Routes",
	version: "0.0.1",
	enable: true,
	priority: 3,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	const logger = useHooks.get("logger");

	server.use("*", async (context, next) => {
		const url = new URL(context.req.url);
		logger.debug(`${url.pathname}${url.search}: ${context.req.method} Path: ${url.pathname}`);
		await next();
	});
};
