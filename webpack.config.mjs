import path from "node:path";
import { fileURLToPath } from "node:url";

import webpack from "webpack";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async (env, argv) => {
  const isDevelopment = (argv.mode === "development");
  const mode = isDevelopment ? "development" : "production";
  return {
    mode,
    target: "node",
    entry: "./src/index.mjs",
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: "cli.js",
      library: {
        name: "webspot-js",
        type: "commonjs2",
      },
    },
    resolve: {
      extensions: ['.ts', '.mjs', '.js'],
    },
    module: {
    },
    externals: {
      "jsdom": "commonjs jsdom",
      "webpack": "commonjs webpack",
      "webpack-cli": "commonjs webpack-cli",
      "postcss": "commonjs postcss",
      "postcss-url": "commonjs postcss-url",
      "postcss-import": "commonjs postcss-import",
      "autoprefixer": "commonjs autoprefixer",
      "@csstools/postcss-minify": "commonjs @csstools/postcss-minify",
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: "#!/usr/bin/env node",
        raw: true,
      }),
    ],
  };
};
