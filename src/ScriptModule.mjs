import path from "node:path";
import fs from "node:fs";
import webpack from 'webpack';

async function copyFileIfDifferent(filepath, {sourceDir, binaryDir}) {
  const inFilename = path.resolve(sourceDir, filepath);
  const outFilename = path.resolve(binaryDir, filepath);
  const inStats = await fs.promises.stat(inFilename);

  let outStats = null;
  try { outStats = await fs.promises.stat(outFilename); } catch (e) { }
  if (outStats === null || inStats.mtime.getTime() !== outStats.mtime.getTime()) {
    console.log(`[configure] Copy ${filepath}`);
    await fs.promises.cp(inFilename, outFilename, {recursive: true});
    await fs.promises.utimes(outFilename, inStats.atime, inStats.mtime);
  }
}

async function copyParamsIfDifferent(params, {sourceDir, binaryDir}) {
  if (params) {
    const sources = [];

    if (Array.isArray(params))
      sources.push(...params);
    else if (typeof params === "object")
      sources.push(...Object.values(params));
    else if (typeof params === "string")
      sources.push(params);
    else
      throw "Not support params type";

    for (const i in sources) {
      await copyFileIfDifferent(sources[i], {sourceDir, binaryDir});
    }
  }
}

async function configure({script, sourceDir, binaryDir}) {
  if (script) {
    for (const name of [ 'entry', 'const', 'list' ]) {
      await copyParamsIfDifferent(script[name], {sourceDir, binaryDir});
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
        console.log(`[script] Generate ${filename}`);
      });
    }
  }
}

export default {
  configure,
  generate,
};
