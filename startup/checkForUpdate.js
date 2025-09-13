const simpleGit = require("simple-git");
const git = simpleGit();
const cron = require("node-cron");

const check = async (logger) => {
	await git.fetch();
	const status = await git.status();
	if (status.behind > 0) {
		logger.info(`There are ${status.behind} new commits in this repository. Pulling`);
		try {
			await git.pull();
			logger.info("Successfully pulled the latest changes.");
		} catch (error) {
			logger.error("Failed to pull the latest changes:", error);
		}
	} else {
		logger.info("You are using the lastest version.");
	}
};

function Update(logger) {
	if (process.env.NODE_ENV == "development") {
		logger.info("You are in development mode, skipping update check.");
	} else {
		check(logger);
		cron.schedule("0 0,12 * * *", () => {
			check();
		});
	}
}

module.exports = {
	Update,
};
