import { expect, test } from "vitest";
import { UNRECOGNIZED_STATES } from "../records/unrecognizedStates";
import { REGION_BOUNDARIES } from "./regionBoundaries";

test("親国を分けて作る地域にはすべて境界線があり、境界線は親国を分ける地域の分だけある", () => {
  const splitCodes = UNRECOGNIZED_STATES.filter(({ mapShape }) => mapShape.kind === "split").map(
    ({ code }) => code,
  );
  expect(Object.keys(REGION_BOUNDARIES).toSorted()).toEqual(splitCodes.toSorted());
  for (const code of splitCodes) {
    // 両端と、親国の内側を通る頂点が 1 つ以上
    expect(REGION_BOUNDARIES[code]?.length).toBeGreaterThanOrEqual(3);
  }
});
