import { test, expect } from "@playwright/test";
import { parseCustomArgs, filterPlaylistArgs } from "../src/utils.js";

test.describe("parseCustomArgs", () => {
	test("returns empty array for empty, null, or non-string input", () => {
		expect(parseCustomArgs("")).toEqual([]);
		expect(parseCustomArgs(null)).toEqual([]);
		expect(parseCustomArgs(undefined)).toEqual([]);
		expect(parseCustomArgs("   \n\t  ")).toEqual([]);
	});

	test("parses standard space-separated arguments", () => {
		expect(parseCustomArgs("--no-check-certificates --geo-bypass")).toEqual([
			"--no-check-certificates",
			"--geo-bypass",
		]);
	});

	test("preserves spaces inside double quotes and strips outer quotes", () => {
		expect(
			parseCustomArgs('--sponsorblock-remove "sponsor, intro" --match-title "my video"'),
		).toEqual([
			"--sponsorblock-remove",
			"sponsor, intro",
			"--match-title",
			"my video",
		]);
	});

	test("preserves spaces inside single quotes and strips outer quotes", () => {
		expect(
			parseCustomArgs("--cookies-from-browser 'chrome:Profile 1' --flag"),
		).toEqual([
			"--cookies-from-browser",
			"chrome:Profile 1",
			"--flag",
		]);
	});

	test("handles equal signs with quoted values", () => {
		expect(
			parseCustomArgs('--output="%(channel)s/%(title)s.%(ext)s"'),
		).toEqual([
			'--output=%(channel)s/%(title)s.%(ext)s',
		]);
	});

	test("handles escaped quotes properly", () => {
		expect(
			parseCustomArgs('--add-header "Authorization: Bearer \\"token\\""'),
		).toEqual([
			"--add-header",
			'Authorization: Bearer "token"',
		]);
	});

	test("preserves Windows paths without dropping backslashes", () => {
		expect(
			parseCustomArgs('--cookies C:\\Users\\me\\cookies.txt -P "D:\\Videos\\My Downloads"'),
		).toEqual([
			"--cookies",
			"C:\\Users\\me\\cookies.txt",
			"-P",
			"D:\\Videos\\My Downloads",
		]);

		expect(
			parseCustomArgs("'C:\\Program Files\\yt\\cookies.txt'"),
		).toEqual([
			"C:\\Program Files\\yt\\cookies.txt",
		]);
	});

	test("handles escaped spaces outside quotes", () => {
		expect(
			parseCustomArgs("my\\ video.mp4 --flag"),
		).toEqual([
			"my video.mp4",
			"--flag",
		]);
	});

	test("handles multi-line textarea input with whitespace and tabs", () => {
		const textareaInput = `
			--sponsorblock-remove all
			--throttled-rate 500K
			--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
		`;
		expect(parseCustomArgs(textareaInput)).toEqual([
			"--sponsorblock-remove",
			"all",
			"--throttled-rate",
			"500K",
			"--user-agent",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
		]);
	});
});

test.describe("filterPlaylistArgs", () => {
	test("filters out output template and playlist control flags", () => {
		const input = [
			"--no-check-certificates",
			"-o",
			"%(title)s.%(ext)s",
			"--sponsorblock-remove",
			"all",
			"--no-playlist",
			"-I",
			"1:5",
			"--throttled-rate",
			"100K",
		];
		expect(filterPlaylistArgs(input)).toEqual([
			"--no-check-certificates",
			"--sponsorblock-remove",
			"all",
			"--throttled-rate",
			"100K",
		]);
	});

	test("filters out flags using equal syntax", () => {
		const input = [
			"--output=%(title)s.%(ext)s",
			"--playlist-items=1:10",
			"--geo-bypass",
		];
		expect(filterPlaylistArgs(input)).toEqual([
			"--geo-bypass",
		]);
	});

	test("filters out short flags with attached values (-oTemplate, -I1:5)", () => {
		const input = [
			"-o%(title)s.%(ext)s",
			"-I1:5",
			"-i",
			"--ignore-errors",
			"--sponsorblock-remove",
			"all",
		];
		expect(filterPlaylistArgs(input)).toEqual([
			"-i",
			"--ignore-errors",
			"--sponsorblock-remove",
			"all",
		]);
	});

	test("handles null or non-array input safely", () => {
		expect(filterPlaylistArgs(null)).toEqual([]);
		expect(filterPlaylistArgs(undefined)).toEqual([]);
		expect(filterPlaylistArgs([])).toEqual([]);
	});
});
