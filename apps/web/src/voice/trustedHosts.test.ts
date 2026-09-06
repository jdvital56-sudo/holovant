import { describe, expect, it } from "vitest";
import { hostOf, isHostApproved } from "@/voice/trustedHosts";

/**
 * The guarantee that has to hold when the model has been fooled.
 *
 * The assistant reads text nobody here wrote — search descriptions, titles of
 * calendar entries somebody else sent, excerpts from notes. A sentence placed
 * in any of them can try to steer it into opening an address, and the title it
 * shows while doing so was written by the same attacker. So the check is on
 * the host, and the host is what he is shown.
 *
 * Both directions. A door that refuses the attacker and the owner equally is
 * not a door — and he asked, in as many words, not to be asked every time.
 */

describe("what a person is actually shown", () => {
  it("is the host, which the attacker cannot dress up", () => {
    expect(hostOf("https://ru.wikipedia.org/wiki/Аланья")).toBe("ru.wikipedia.org");
    expect(hostOf("http://example.com:8080/x")).toBe("example.com:8080");
  });

  it("sees through a path that is made to read like a site", () => {
    // The whole trick: the model is told to open "Википедию" and hands over an
    // address whose path says wikipedia and whose host does not.
    expect(hostOf("https://evil.example/ru.wikipedia.org/Аланья")).toBe("evil.example");
    expect(hostOf("https://evil.example/?url=https://ru.wikipedia.org")).toBe("evil.example");
  });

  it("refuses an address that is not a web address at all", () => {
    for (const url of ["javascript:alert(1)", "file:///c:/", "data:text/html,x", "not a url", ""]) {
      expect(hostOf(url), url).toBeNull();
    }
  });
});

describe("what may open without being shown", () => {
  const approved = ["ru.wikipedia.org", "youtube.com"];

  it("lets a site he has already approved open straight through", () => {
    // He asked not to be asked every time, and this is the half that honours it.
    expect(isHostApproved("ru.wikipedia.org", approved)).toBe(true);
    expect(isHostApproved("RU.WIKIPEDIA.ORG", approved)).toBe(true);
  });

  it("stops a host he has never approved", () => {
    expect(isHostApproved("evil.example", approved)).toBe(false);
  });

  it("is not fooled by a host that ends with one he trusts", () => {
    // "ru.wikipedia.org.evil.example" is a different site and reads like his.
    // Matching on endings is exactly how that is done.
    expect(isHostApproved("ru.wikipedia.org.evil.example", approved)).toBe(false);
    expect(isHostApproved("notyoutube.com", approved)).toBe(false);
  });

  it("does not spread approval to a neighbouring host", () => {
    // Approving one is approving one. A subdomain is a different machine, and
    // on plenty of services it belongs to a different person.
    expect(isHostApproved("en.wikipedia.org", approved)).toBe(false);
    expect(isHostApproved("wikipedia.org", approved)).toBe(false);
  });

  it("approves nothing when nothing has been approved", () => {
    expect(isHostApproved("ru.wikipedia.org", [])).toBe(false);
  });
});
