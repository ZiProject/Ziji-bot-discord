const { useHooks } = require("zihooks");

function getRoutes(app) {
	const routes = [];

	const stack = app.router?.stack || [];

	stack.forEach((layer) => {
		if (layer.route) {
			const path = layer.route.path;
			const methods = Object.keys(layer.route.methods);

			routes.push({ path, methods });
		}

		// nested routers
		if (layer.name === "router" && layer.handle?.stack) {
			layer.handle.stack.forEach((handler) => {
				if (handler.route) {
					routes.push({
						path: handler.route.path,
						methods: Object.keys(handler.route.methods),
					});
				}
			});
		}
	});

	return routes;
}

module.exports.data = {
	name: "ShowRoutes",
	description: "Bot all Routes",
	version: "0.0.1",
	enable: true,
	priority: 10,
};

module.exports.execute = () => {
	const server = useHooks.get("server");
	const logg = useHooks.get("logger");
	routerArr = getRoutes(server);
	logg.debug("=== All Routes ===");
	routerArr.forEach((r) => {
		logg.debug(r);
	});
};
