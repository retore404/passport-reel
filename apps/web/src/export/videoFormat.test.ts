import { describe, expect, test } from "vitest";
import { chooseVideoFormat, type VideoFormat } from "./videoFormat";

const supporting =
  (...codecs: VideoFormat["codec"][]) =>
  async (codec: VideoFormat["codec"]) =>
    codecs.includes(codec);

describe("chooseVideoFormat", () => {
  test("H.264 を使えれば H.264 / MP4", async () => {
    expect(await chooseVideoFormat(supporting("avc", "vp9"))).toEqual({
      codec: "avc",
      label: "H.264 / MP4",
    });
  });

  test("H.264 を使えず VP9 を使えれば VP9 / MP4", async () => {
    expect((await chooseVideoFormat(supporting("vp9")))?.codec).toBe("vp9");
  });

  test("どちらも使えなければ undefined", async () => {
    expect(await chooseVideoFormat(supporting())).toBeUndefined();
  });

  test("判定が例外を投げた形式は使えないものとして扱う", async () => {
    const canEncode = async (codec: VideoFormat["codec"]) => {
      if (codec === "avc") {
        throw new Error("NotSupportedError");
      }
      return true;
    };
    expect((await chooseVideoFormat(canEncode))?.codec).toBe("vp9");
  });
});
