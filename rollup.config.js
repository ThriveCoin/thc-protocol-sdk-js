import typescript from "rollup-plugin-typescript2"
import { terser } from "rollup-plugin-terser"
import resolve from "@rollup/plugin-node-resolve"
import commonjs from "@rollup/plugin-commonjs"

export default {
  input: "src/index.ts", // Entry point for the library
  output: [
    {
      file: "dist/browser/thrive-protocol-sdk.umd.js", // UMD build for browsers
      format: "umd", // Universal Module Definition
      name: "ThriveProtocolSDK", // Global variable name for browsers
      sourcemap: true, // Generate sourcemaps
    },
    {
      file: "dist/browser/thrive-protocol-sdk.esm.js", // ES Module build for browsers
      format: "esm", // ES Module format
      sourcemap: true,
    },
    {
      file: "dist/browser/thrive-protocol-sdk.iife.js", // IIFE build for direct inclusion
      format: "iife", // Immediately Invoked Function Expression
      name: "ThriveProtocolSDK", // Global variable name for browsers
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(), // Resolves Node.js-style imports
    commonjs(), // Converts CommonJS modules to ES Modules
    typescript({ tsconfig: "./tsconfig.json" }), // Use TypeScript
    terser(), // Minify the output
  ],
}
