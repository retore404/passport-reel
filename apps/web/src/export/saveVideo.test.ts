import { describe, expect, test, vi } from "vitest";
import { saveVideo } from "./saveVideo";

const file = new File(["video"], "passport-reel-2016-2024.mp4", { type: "video/mp4" });

const shareMock = () => vi.fn<(data: ShareData) => Promise<void>>(async () => {});
const fallbackMock = () => vi.fn<(file: File) => void>();

describe("saveVideo", () => {
  test("ファイルを共有できれば共有シートを開く", async () => {
    const share = shareMock();
    const fallback = fallbackMock();
    const result = await saveVideo(file, { canShare: () => true, share }, fallback);
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({ files: [file] });
    expect(fallback).not.toHaveBeenCalled();
  });

  test("ファイルを共有できなければダウンロードする", async () => {
    const share = shareMock();
    const fallback = fallbackMock();
    const result = await saveVideo(file, { canShare: () => false, share }, fallback);
    expect(result).toBe("downloaded");
    expect(share).not.toHaveBeenCalled();
    expect(fallback).toHaveBeenCalledWith(file);
  });

  test("共有の API がなければダウンロードする", async () => {
    const fallback = fallbackMock();
    expect(await saveVideo(file, {}, fallback)).toBe("downloaded");
    expect(fallback).toHaveBeenCalledWith(file);
  });

  test("共有シートを閉じた場合は失敗にしない", async () => {
    const share = async () => {
      throw new DOMException("Share canceled", "AbortError");
    };
    expect(await saveVideo(file, { canShare: () => true, share }, fallbackMock())).toBe(
      "dismissed",
    );
  });

  test("それ以外の共有の失敗はそのまま伝える", async () => {
    const share = async () => {
      throw new DOMException("Not allowed", "NotAllowedError");
    };
    await expect(saveVideo(file, { canShare: () => true, share }, fallbackMock())).rejects.toThrow(
      "Not allowed",
    );
  });
});
