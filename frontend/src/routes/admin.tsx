import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, useState } from "react";
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
  errorComponent: ({ error, reset }) => <Failure message={error.message} retry={reset} />,
});

function AdminGate() {
  const [token, setToken] = useState(getAdminToken);
  const [ready, setReady] = useState(false);
  return (
    <>
      <form
        className="crawl-form"
        onSubmit={(e) => {
          e.preventDefault();
          setAdminToken(token);
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
        <Suspense fallback={<p>Loading index statistics…</p>}>
          <Dashboard />
        </Suspense>
      )}
    </>
  );
}
