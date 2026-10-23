import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SeekrMark, Failure } from "@/frontend/shell";
import { Highlight, SearchBox } from "@/frontend/search-box";
import { searchOptions, type Ranker, type SearchResponse } from "@/frontend/api";
import { PAGE_SIZE } from "@/frontend/config";
type SearchState = { q: string; page: number; ranker: Ranker; compare: boolean };
export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): SearchState => ({
    q: typeof s["q"] === "string" ? s["q"] : "",
    page: Math.max(1, Math.floor(Number(s["page"]) || 1)),
    ranker: s["ranker"] === "tfidf" ? "tfidf" : "bm25",
    compare: s["compare"] === true || s["compare"] === "true",
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    if (deps.q)
      await context.queryClient.ensureQueryData(searchOptions(deps.q, deps.page, deps.ranker));
    if (deps.q && deps.compare)
      await context.queryClient.ensureQueryData(
        searchOptions(deps.q, deps.page, deps.ranker === "bm25" ? "tfidf" : "bm25"),
      );
  },
  head: () => ({
    meta: [
      { title: "Seekr — Find your signal" },
      {
        name: "description",
        content:
          "Search an independent web index with BM25 and TF-IDF rankings. Find your signal with Seekr.",
      },
      { property: "og:title", content: "Seekr — Find your signal" },
      {
        property: "og:description",
        content: "A little more signal. A little less noise. Search the web with Seekr.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
  pendingComponent: SearchLoading,
  errorComponent: ({ error, reset }) => (
    <Failure
      message={error instanceof Error ? error.message : "This page could not be loaded."}
      retry={reset}
    />
  ),
});
function SearchPage() {
  const state = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const update = (patch: Partial<SearchState>) => {
    void navigate({ search: { ...state, ...patch } });
  };
  const search = (q: string) => update({ q, page: 1 });
  if (!state.q)
    return (
      <>
        <section className="home-content">
          <div className="eyebrow">
            <i />
            An independent search engine
          </div>
          <h1>
            <SeekrMark large />
          </h1>
          <p className="home-subtitle">
            The web is vast.
            <br />
            Find your signal.
          </p>
          <SearchBox onSearch={search} />
          <div className="search-help">
            <span>
              Looking for an exact match? Try <code>"binary tree"</code>
            </span>
            <span className="keyboard-hint">
              <span className="keyboard-key">↵</span> to search
            </span>
          </div>
          <div className="trending">
            <span className="trending-label">Explore</span>
            {["binary tree", "distributed systems", "graph algorithms"].map((q) => (
              <Button key={q} variant="outline" className="topic-button" onClick={() => search(q)}>
                {q}
                <ArrowUpRight size={11} />
              </Button>
            ))}
          </div>
          <div className="home-divider" />
          <div className="feature-line">
            <Sparkles size={14} />
            <span>Curiosity, without the clutter.</span>
          </div>
          <p className="feature-description">
            An open index. Thoughtful rankings.
            <br />
            Just you and what you’re looking for.
          </p>
          <div className="engine-strip">
            <span>
              <Zap size={12} />
              BM25 + TF-IDF
            </span>
            <span>
              <ShieldCheck size={12} />
              Independent index
            </span>
            <span>
              <Layers size={12} />
              Built to explore
            </span>
          </div>
        </section>
        <section className="home-bottom">
          <div>
            <span className="bottom-label">A SMALL INDEX. A WORLD OF IDEAS.</span>
            <p className="bottom-message">Good things are waiting to be found.</p>
          </div>
          <div className="index-snapshot">
            <div>
              <strong>24.8k</strong>
              <small>pages indexed</small>
            </div>
            <div>
              <strong>186k</strong>
              <small>unique terms</small>
            </div>
            <div>
              <strong>
                12<span className="text-muted-foreground text-xs"> ms</span>
              </strong>
              <small>average response</small>
            </div>
          </div>
        </section>
      </>
    );
  return (
    <section className="results-page">
      <div className="results-search">
        <SearchBox initial={state.q} onSearch={search} compact />
      </div>
      <Suspense fallback={<ResultSkeleton />}>
        <Results state={state} update={update} />
      </Suspense>
    </section>
  );
}
function Results({
  state,
  update,
}: {
  state: SearchState;
  update: (patch: Partial<SearchState>) => void;
}) {
  const { data } = useSuspenseQuery(searchOptions(state.q, state.page, state.ranker));
  const pages = Math.ceil(data.total / PAGE_SIZE);
  return (
    <>
      <div className="results-toolbar">
        <span className="results-count">
          About {data.total.toLocaleString()} results ({data.tookMs} ms)
        </span>
        <div className="results-controls">
          <div className="segmented" aria-label="Ranking algorithm">
            {(["bm25", "tfidf"] as const).map((r) => (
              <Button
                key={r}
                variant="ghost"
                aria-pressed={state.ranker === r}
                onClick={() => update({ ranker: r, page: 1 })}
              >
                {r === "bm25" ? "BM25" : "TF-IDF"}
              </Button>
            ))}
          </div>
          <label className="compare-toggle">
            <input
              type="checkbox"
              checked={state.compare}
              onChange={(e) => update({ compare: e.target.checked })}
            />
            Compare rankings
          </label>
        </div>
      </div>
      {data.didYouMean && (
        <p className="did-you-mean">
          Did you mean:{" "}
          <Button variant="link" onClick={() => update({ q: data.didYouMean ?? state.q, page: 1 })}>
            {data.didYouMean}
          </Button>
          ?
        </p>
      )}
      {!data.total ? (
        <div className="empty-state">
          <Search size={30} />
          <h2>No results for “{state.q}”</h2>
          <p>Try a different term or a broader query.</p>
          <Button variant="outline" onClick={() => update({ q: "binary tree", page: 1 })}>
            Explore binary tree <ArrowRight />
          </Button>
        </div>
      ) : state.compare ? (
        <div className="compare-grid">
          <div>
            <h2 className="ranking-heading">
              {state.ranker === "bm25" ? "BM25" : "TF-IDF"}
              <span>{data.tookMs} ms</span>
            </h2>
            <ResultList data={data} q={state.q} />
          </div>
          <Suspense fallback={<ResultSkeleton />}>
            <Comparison state={state} />
          </Suspense>
        </div>
      ) : (
        <ResultList data={data} q={state.q} />
      )}{" "}
      {pages > 1 && (
        <nav className="pagination" aria-label="Search pages">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={state.page === 1}
            onClick={() => update({ page: state.page - 1 })}
          >
            <ChevronLeft />
          </Button>
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - state.page) < 3 || p === 1 || p === pages)
            .map((p) => (
              <Button
                key={p}
                variant="ghost"
                size="icon"
                aria-current={p === state.page ? "page" : undefined}
                onClick={() => update({ page: p })}
              >
                {p}
              </Button>
            ))}
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={state.page >= pages}
            onClick={() => update({ page: state.page + 1 })}
          >
            <ChevronRight />
          </Button>
          <span className="pagination-caption">
            Page {state.page} of {pages}
          </span>
        </nav>
      )}
    </>
  );
}
function Comparison({ state }: { state: SearchState }) {
  const ranker = state.ranker === "bm25" ? "tfidf" : "bm25";
  const { data } = useSuspenseQuery(searchOptions(state.q, state.page, ranker));
  return (
    <div>
      <h2 className="ranking-heading">
        {ranker === "bm25" ? "BM25" : "TF-IDF"}
        <span>{data.tookMs} ms</span>
      </h2>
      <ResultList data={data} q={state.q} />
    </div>
  );
}
function ResultList({ data, q }: { data: SearchResponse; q: string }) {
  return (
    <div className="result-list">
      {data.results.map((r) => (
        <article key={r.id} className="result-item">
          <div className="result-url">
            <span className="source-icon">
              <Globe size={12} />
            </span>
            {new URL(r.url).hostname}
            <span className="text-muted-foreground"> › {new URL(r.url).pathname.slice(1)}</span>
          </div>
          <div className="result-heading">
            <Link to="/doc/$id" params={{ id: r.id }} search={{ q }} className="result-title">
              {r.title}
            </Link>
            <span className="score-badge">{r.score.toFixed(3)}</span>
          </div>
          <p className="result-snippet">
            <Highlight text={r.snippet} q={q} />…
          </p>
          <div className="result-links">
            <Link to="/doc/$id" params={{ id: r.id }} search={{ q }}>
              <FileText size={11} />
              View indexed page
            </Link>
            <a href={r.url} target="_blank" rel="noreferrer">
              Visit source <ArrowUpRight size={11} />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
function ResultSkeleton() {
  return (
    <div aria-label="Loading results" role="status">
      {[1, 2, 3].map((i) => (
        <div className="result-item" key={i}>
          <div className="skeleton-line skeleton-short" />
          <div className="skeleton-line skeleton-title" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ))}
    </div>
  );
}
function SearchLoading() {
  return (
    <section className="results-page">
      <p className="results-count">Searching the index…</p>
      <ResultSkeleton />
    </section>
  );
}
