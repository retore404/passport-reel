import { describe, expect, test, vi } from "vitest";
import { canShareFile, shareVideo } from "./saveVideo";

const file = new File(["video"], "passport-reel-2016-2024.mp4", { type: "video/mp4" });

const shareMock = () => vi.fn<(data: ShareData) => Promise<void>>(async () => {});

describe("canShareFile", () => {
  test("canShare がファイルを受け付ければ共有できる", () => {
    expect(canShareFile(file, { canShare: () => true, share: shareMock() })).toBe(true);
  });

  test("canShare がファイルを受け付けなければ共有できない", () => {
    expect(canShareFile(file, { canShare: () => false, share: shareMock() })).toBe(false);
  });

  test("共有の API がなければ共有できない", () => {
    expect(canShareFile(file, {})).toBe(false);
    expect(canShareFile(file, { canShare: () => true })).toBe(false);
  });
});

describe("shareVideo", () => {
  test("動画を含めて共有シートを開く", async () => {
    const share = shareMock();
    expect(await shareVideo(file, { share })).toBe(true);
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  test("共有シートを閉じた場合は失敗にしない", async () => {
    const share = async () => {
      throw new DOMException("Share canceled", "AbortError");
    };
    expect(await shareVideo(file, { share })).toBe(false);
  });

  test("それ以外の共有の失敗はそのまま伝える", async () => {
    const share = async () => {
      throw new DOMException("Not allowed", "NotAllowedError");
    };
    await expect(shareVideo(file, { share })).rejects.toThrow("Not allowed");
  });
});
