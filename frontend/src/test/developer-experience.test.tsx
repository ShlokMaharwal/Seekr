import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SeedNotice } from "@/frontend/seed-notice";
import { AdminGate } from "@/routes/admin";
import { api } from "@/frontend/api";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("first-run and authentication recovery", () => {
  it("explains how to populate an empty local index", () => {
    render(<SeedNotice />);
    expect(screen.getByText("npm run seed")).toBeInTheDocument();
  });
  it("keeps the token input available after authentication fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(api, "stats").mockRejectedValue(new Error("Authentication failed."));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <AdminGate />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Admin token"), {
      target: { value: "incorrect-test-token" },
    });
    fireEvent.click(screen.getByText("Connect dashboard"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Update the token above");
    expect(screen.getByLabelText("Admin token")).toBeInTheDocument();
    client.clear();
  });
});
