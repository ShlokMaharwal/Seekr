import { describe, expect, it, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Highlight } from "@/frontend/search-box";
import { getAdminToken, setAdminToken } from "@/frontend/api";
afterEach(() => vi.restoreAllMocks());
describe("untrusted content", () => {
  it("renders HTML and query punctuation as escaped text", () => {
    const html = renderToStaticMarkup(
      <Highlight text={'<script>alert("x")</script> binary'} q={"binary [.*"} />,
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("<strong>binary</strong>");
  });
  it("keeps admin authentication usable when localStorage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setAdminToken("temporary-test-token");
    expect(getAdminToken()).toBe("temporary-test-token");
    setAdminToken("");
  });
});
