// Stand-in for a browser-only library (BROWSER_ONLY in browser-only.mjs): any property,
// call or `new` on it returns the stand-in again, so importing an App's views
// in Node costs nothing and touches no `window`.
const target = function () {};
const inert = new Proxy(target, {
  get: (_t, k) => (k === "__esModule" ? true : k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : inert),
  apply: () => inert,
  construct: () => inert,
  // esbuild's CJS interop copies a module onto Object.create(proto);
  // pointing the prototype back here keeps every named import inert.
  getPrototypeOf: () => inert,
});
module.exports = inert;
