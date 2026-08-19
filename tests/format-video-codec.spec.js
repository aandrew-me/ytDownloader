import { test, expect } from "@playwright/test";
import { formatVideoCodec } from "../src/utils.js";

test.describe("formatVideoCodec", () => {
	test("maps AVC/H.264 codecs properly", () => {
		expect(formatVideoCodec("avc1.640028")).toBe("H.264");
		expect(formatVideoCodec("avc1.4d401f")).toBe("H.264");
		expect(formatVideoCodec("avc3.640028")).toBe("H.264");
		expect(formatVideoCodec("h264")).toBe("H.264");
	});

	test("maps AV1 codecs properly", () => {
		expect(formatVideoCodec("av01.0.08M.08")).toBe("AV1");
		expect(formatVideoCodec("av1")).toBe("AV1");
	});

	test("maps VP9 and VP8 codecs properly", () => {
		expect(formatVideoCodec("vp9")).toBe("VP9");
		expect(formatVideoCodec("vp09.00.51.08.01.01.01.01.00")).toBe("VP9");
		expect(formatVideoCodec("vp8")).toBe("VP8");
		expect(formatVideoCodec("vp08")).toBe("VP8");
	});

	test("maps HEVC/H.265 codecs properly", () => {
		expect(formatVideoCodec("hev1.1.6.L93.B0")).toBe("H.265");
		expect(formatVideoCodec("hvc1.1.6.L93.B0")).toBe("H.265");
		expect(formatVideoCodec("hevc")).toBe("H.265");
		expect(formatVideoCodec("h265")).toBe("H.265");
	});

	test("maps MPEG-4, ProRes, Theora and other codecs properly", () => {
		expect(formatVideoCodec("mp4v.20.3")).toBe("MPEG-4");
		expect(formatVideoCodec("prores")).toBe("ProRes");
		expect(formatVideoCodec("theora")).toBe("Theora");
	});

	test("handles edge cases (null, empty, none, unknown)", () => {
		expect(formatVideoCodec(null)).toBe("");
		expect(formatVideoCodec(undefined)).toBe("");
		expect(formatVideoCodec("")).toBe("");
		expect(formatVideoCodec("none")).toBe("");
		expect(formatVideoCodec("custom_codec.123")).toBe("custom_codec");
	});
});
