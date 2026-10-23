import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Component, Suspense, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dashboard } from "@/frontend/dashboard";
import { Failure } from "@/frontend/shell";
import { getAdminToken, setAdminToken } from "@/frontend/api";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Index dashboard — Seekr" }] }),
  component: () => (
    <ClientOnly fallback={<p>Loading dashboard…</p>}>
      <AdminGate />
    </ClientOnly>
  ),
  errorComponent: ({ error, reset }) => (
    <Failure
      message={error instanceof Error ? error.message : "Dashboard unavailable."}
      retry={reset}
    />
  ),
});

export function AdminGate() {
  const client = useQueryClient();
  const [token, setToken] = useState(getAdminToken);
  const [ready, setReady] = useState(false);
  return (
    <>
      <form
        className="crawl-form"
        onSubmit={(e) => {
          e.preventDefault();
          setAdminToken(token);
          for (const key of ["stats", "feed", "metrics"]) client.removeQueries({ queryKey: [key] });
          setReady(true);
        }}
      >
        <label htmlFor="connect-admin-token">Admin token</label>
        <input
          id="connect-admin-token"
          type="password"
          className="field"
          autoComplete="off"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            setReady(false);
          }}
        />
        <button type="submit">Connect dashboard</button>
        <p>
          Use ADMIN_TOKEN from your local backend configuration. Leave blank only for unprotected
          development mode.
        </p>
      </form>
      {ready && (
        <DashboardBoundary>
          <Suspense fallback={<p>Loading index statistics…</p>}>
            <Dashboard />
          </Suspense>
        </DashboardBoundary>
      )}
    </>
  );
}

class DashboardBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? (
      <p role="alert" className="crawl-error">
        {this.state.error.message} Update the token above and connect again.
      </p>
    ) : (
      this.props.children
    );
  }
}
