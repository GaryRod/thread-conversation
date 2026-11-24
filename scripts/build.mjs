import { transformAsync } from "@babel/core"
import { build } from "esbuild"
import { readFile } from "node:fs/promises"

await build({
  entryPoints: ["src/tui.tsx"],
  outfile: "dist/tui.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2023",
  // These must be the host's instances, especially the Solid reactive runtime.
  external: ["solid-js", "solid-js/*", "@opentui/*"],
  plugins: [{
    name: "opentui-solid",
    setup(builder) {
      builder.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
        const result = await transformAsync(await readFile(path, "utf8"), {
          filename: path,
          presets: [
            ["@babel/preset-typescript", { isTSX: true, allExtensions: true }],
            ["babel-preset-solid", { generate: "universal", moduleName: "@opentui/solid" }],
          ],
        })
        return { contents: result.code, loader: "js" }
      })
    },
  }],
})
console.log("Plugin generado: dist/tui.js")
