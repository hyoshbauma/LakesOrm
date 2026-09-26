import { plugin } from "bun";

const polyfillPlugin = {
  name: "util-polyfill",
  setup(build) {
    build.onResolve({ filter: /^util\/types$/ }, () => {
      // Redirects util/types to the safe node-modules utility package
      return { path: require.resolve("util/").replace("support/isBuffer.js", "support/types.js") }; 
    });
  },
};

await Bun.build({
  entrypoints: ['./index.ts'],
  outdir: './dist',
  target: 'browser',
  plugins: [polyfillPlugin],
});