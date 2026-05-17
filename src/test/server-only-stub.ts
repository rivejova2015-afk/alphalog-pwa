// No-op stub for `server-only` in vitest. The real package throws at import
// time when bundled for the client; in Node test env there's no need for the
// guard, so this empty module satisfies the resolver.
export {};
