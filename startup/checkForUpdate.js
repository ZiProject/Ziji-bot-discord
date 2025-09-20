const simpleGit = require("simple-git");
const cron = require("node-cron");

class UpdateChecker {
	constructor(gitClient = simpleGit(), scheduler = cron) {
		this.git = gitClient;
		this.scheduler = scheduler;
	}

	async check(logger) {
		await this.git.fetch();
		const status = await this.git.status();

		if (status.behind > 0) {
			this.log(logger, "info", `There are ${status.behind} new commits in this repository. Pulling`);
			try {
				await this.git.pull();
				this.log(logger, "info", "Successfully pulled the latest changes.");
			} catch (error) {
				this.log(logger, "error", "Failed to pull the latest changes:", error);
			}
			return;
		}

		this.log(logger, "info", "You are using the latest version.");
	}

	start(logger) {
		if (process.env.NODE_ENV === "development") {
			this.log(logger, "info", "You are in development mode, skipping update check.");
			return;
		}

		this.check(logger).catch((error) => this.log(logger, "error", error));
		this.scheduler.schedule("0 0,12 * * *", () => {
			this.check(logger).catch((error) => this.log(logger, "error", error));
		});
	}

	log(logger, level, ...args) {
		if (logger && typeof logger[level] === "function") {
			logger[level](...args);
			return;
		}

		if (typeof console[level] === "function") {
			console[level](...args);
			return;
		}

		console.log(...args);
	}
}

module.exports = { UpdateChecker };
