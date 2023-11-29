import path from "node:path";
import fs from "node:fs";
import webpack from 'webpack';

async function copyFileIfDifferent(filepath, {sourceDir, binaryDir}) {
  const inFilename = path.resolve(sourceDir, filepath);
  const outFilename = path.resolve(binaryDir, filepath);
  const inStats = await fs.promises.stat(inFilename);
  const outStats = await fs.promises.stat(outFilename);
  console.log(">>>", filepath, inStats.mtime, filepath, outStats.mtime);
  if (inStats.mtime != outStats.mtime) {
    console.log(">>> Copy", filepath);
    await fs.promises.cp(inFilename, outFilename, {force:true});
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
        console.log(`Generate ${filename} [webpack]`);
      });
    }
  }
}

export default {
  configure,
  generate,
};
