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
	const logg = useHooks.get("logger");

	server.use(
		/**
		 * @param {import("express").Request} req
		 * @param {import("express").Response} res
		 * @param {import("express").NextFunction} next
		 */
		(req, res, next) => {
			logg.debug(`${req.originalUrl}: ${req.method} Path: ${req.path}`);
			next();
		},
	);
};
