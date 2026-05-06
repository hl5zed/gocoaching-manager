# Security

## Debug and Development Routes

Debug, dev, test, playground, sandbox, and similar routes must not be publicly
accessible in production.

- Local-only debug routes should call `notFound()` in production before any data
  fetching or rendering.
- Production support routes, if they must exist, should require `super_admin`
  and hide their existence with `notFound()` when access is not allowed.
- Secrets, tokens, raw database rows, and personally identifiable information
  must never be rendered in these routes.

Run the route safety check before production builds:

```bash
npm run check:debug-routes
```
