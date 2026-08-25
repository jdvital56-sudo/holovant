import { describe, expect, it } from "vitest";
import { readableGpuName } from "./diagnostics";

describe("naming the GPU a driver string describes", () => {
  it("pulls the chip out of Chrome's ANGLE wrapper", () => {
    expect(
      readableGpuName(
        "ANGLE (Intel, Intel(R) UHD Graphics (0x00009BC4) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      ),
    ).toBe("Intel UHD Graphics");
  });

  it("keeps the vendor, which naive bracket-stripping loses", () => {
    // Removing every bracketed run turns this into "ANGLE GeForce RTX 4070…"
    // with the vendor gone and a stray bracket left behind.
    expect(
      readableGpuName("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)"),
    ).toBe("NVIDIA GeForce RTX 4070");
  });

  it("leaves a plain renderer string alone", () => {
    expect(readableGpuName("Apple M1")).toBe("Apple M1");
  });

  it("drops trademark marks without touching the model in brackets", () => {
    expect(readableGpuName("Mesa Intel(R) Iris(R) Xe Graphics (TGL GT2)")).toBe(
      "Mesa Intel Iris Xe Graphics (TGL GT2)",
    );
  });

  it("reports nothing rather than an empty name when there is no string", () => {
    expect(readableGpuName(null)).toBeNull();
    expect(readableGpuName("   ")).toBeNull();
  });
});
