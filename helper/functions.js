/**
 * Run when Called
 * await useHooks.get("functions").get(""Functions Helper"").execute(args)
 */

module.exports.data = {
	name: "Functions Helper",
	type: "any",
	//etc..:
	category: "musix", //for { player } in execute, run function
	lock: true, // only host control
	ckeckVoice: true, // check voice channel
	enable: true, // enable or disable command
};

/**
 * @param { object } args
 * @returns
 */

module.exports.execute = async (args) => {
	// Your code here...
	return;
};
