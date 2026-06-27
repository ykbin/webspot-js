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
      "webpack": "commonjs webpack",
      "webpack-cli": "commonjs webpack-cli",
    },
    plugins: [
      new webpack.BannerPlugin({
        banner: "#!/usr/bin/env node",
        raw: true,
      }),
    ],
  };
};
