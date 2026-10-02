const { useHooks } = require("zihooks");

module.exports.data = {
	name: "ShowRoutes",
	description: "Bot all Routes",
	version: "0.0.1",
	enable: true,
	priority: 10,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	const logger = useHooks.get("logger");
	const routes = server.routes.map(({ method, path }) => ({ path, methods: [method.toLowerCase()] }));

	logger.debug("=== All Routes ===");
	routes.forEach((route) => logger.debug(route));
};
