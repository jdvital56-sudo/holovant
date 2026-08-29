import { describe, expect, it } from "vitest";
import { MODULE_CATALOG } from "./catalog";
import { moduleRegistry } from "./registry";

/**
 * The catalog exists so an API route can check a module name without importing
 * every provider — some of which now read the live player and the user's saved
 * collections, which have no business in a server bundle. Two lists of the same
 * thing drift, so this holds them together.
 */
describe("the catalog matches the registry", () => {
  it("lists the same modules, in the same order", () => {
    expect(MODULE_CATALOG.map((m) => m.id)).toEqual(moduleRegistry.map((m) => m.id));
  });

  it("gives each the same label", () => {
    expect(MODULE_CATALOG.map((m) => m.label)).toEqual(moduleRegistry.map((m) => m.label));
  });
});
