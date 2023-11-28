import path from "node:path";
import fs from "node:fs";
import webpack from 'webpack';

async function copyIfDifferent(filepath, sourceDir, binaryDir) {
  const fullpath = path.resolve(sourceDir, filepath);
  const stats = await fs.promises.stat(fullpath);
  console.log(">>>", filepath, stats);
}

async function configure({script, sourceDir, binaryDir}) {
  if (script) {
    const sources = [];

    if (typeof script.entry === "object")
      sources.push(...Object.values(script.entry));

    if (typeof script.const === "string")
      sources.push(script.const);

    if (Array.isArray(script.const))
      sources.push(...script.const);

    if (typeof script.list === "string")
      sources.push(script.list);

    if (Array.isArray(script.list))
      sources.push(...script.list);

    for (const i in sources) {
      await copyIfDifferent(sources[i], sourceDir, binaryDir);
    }
  }
}

async function generate({script, buildType, binaryDir, distDir}) {
  if (script && script.entry) {
    const isDevelopment = (buildType === "Debug");
    for (const [ key, val ] of Object.entries(script.entry)) {
      const filename = `${key}.bundle.js`;
      const params = {
        mode: isDevelopment ? 'development' : 'production',
        devtool: isDevelopment ? 'inline-source-map' : 'source-map',
        entry: {},
        output: {
          filename,
          path: distDir,
        }
      };
  
      params.entry[key] = path.resolve(binaryDir, val);
  
      const compiler = webpack(params);
      compiler.run((err, res) => {
        if (err) {
          console.log(err);
          throw err;
        }
        console.log(`Generate ${filename} [webpack]`);
      });
    }
  }
}

export default {
  configure,
  generate,
};
