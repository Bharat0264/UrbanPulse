import { describe, it, expect, vi, afterEach } from "vitest";
import { parameters, fetchAPI } from "./api";
describe("API contract", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("serializes shared filters consistently", () => {
    expect(
      parameters({
        borough: "Manhattan",
        zone: "",
        hour_start: "17",
        hour_end: "20",
      }),
    ).toBe("borough=Manhattan&hour_start=17&hour_end=20");
  });
  it("preserves server errors for the dashboard error state", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({
          ok: false,
          json: async () => ({ detail: "Dataset is not ready" }),
        }),
    );
    await expect(fetchAPI("/dashboard/overview")).rejects.toThrow(
      "Dataset is not ready",
    );
  });
  it("returns measured API values without fabrication", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ trips: 17 }) }),
    );
    expect(await fetchAPI("/dashboard/overview")).toEqual({ trips: 17 });
  });
});
