# Routes

TanStack Start generates `../routeTree.gen.ts` from these route modules:

| File          | URL         | Purpose                                                   |
| ------------- | ----------- | --------------------------------------------------------- |
| `__root.tsx`  | Root layout | Query provider, shared shell, error boundary, and outlet  |
| `index.tsx`   | `/`         | Search parameters, loading/results, and ranker comparison |
| `doc.$id.tsx` | `/doc/:id`  | Indexed document text and metadata                        |
| `admin.tsx`   | `/admin`    | Client-side token gate and dashboard                      |

Preserve the root outlet and let route generation update its own generated file.
