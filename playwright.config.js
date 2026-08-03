const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
	testDir: "./tests",
	timeout: 30000,
	expect: {
		timeout: 5000,
	},
	fullyParallel: false,
	workers: process.env.CI ? 2 : 4,
	reporter: [["list"]],
	use: {
		trace: "on-first-retry",
	},
});
