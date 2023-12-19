import fs from "node:fs";
import path from "node:path";
import webpack from 'webpack';
import { pathToFileURL } from 'url';
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

async function configure({script, sourceDir, binaryDir}) {
  const list = [];
  for (const name of (script ? ['entry', 'const', 'list', 'json'] : [])) {
    list.push(...getFilenamesFromParams(script[name]));
  }
  for(const iter of list) {
    const inFilename = path.resolve(sourceDir, iter);
    const outFilename = path.resolve(binaryDir, iter);
    if (await copyFileIfDifferent(inFilename, outFilename)) {
      console.log(`[script.configure] Copy ${iter}`);
    }
  }
}

async function buildConst({script, sourceDir, binaryDir}) {
  if (script && script.const) {
    const inFilename = path.resolve(sourceDir, script.const);
    const { default: constants } = await import(pathToFileURL(inFilename));

    let content = "";
  
    for (const [ key, val ] of Object.entries(constants)) {
      content += `static const char ${key}[] = "${val}";\n`;
    }
  
    const outFilename = path.resolve(binaryDir, "Constans.h");
    await fs.promises.writeFile(outFilename, content, { encoding: 'utf8', flag: 'w' });
    console.log("[script.const] Generate Constans.h");
  }
}

async function buildJson({script, binaryDir, writeAsset}) {
  if (script && script.json) {
    const arr = (typeof script.json === "string") ? [ script.json ] : script.json; 
    for (let i = 0; i < arr.length; i++) {
      const inFilename = path.resolve(binaryDir, arr[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      await writeAsset(outFilename, content, {type: "application/json"});
      console.log(`[script.json] Generate ${outFilename}`);
    }
  }
}

async function processScript({ from, to, isDebug, workDir, distDir, addAsset }) {
  const entry = from;
  const filename = to;

  const debugParams = {
    modules: [ process.cwd() ],
    mode: 'development',
    devtool: 'source-map',
    output: {
      sourceMapFilename: `${filename}.map`,
      path: distDir,
    }
  };

  const releaseParams = {
    modules: [ process.cwd() ],
    mode: 'production',
    output: {
      path: distDir,
    }
  };

  const params = isDebug ? debugParams : releaseParams;

  params.entry = {
    index: {
      import: path.join(workDir, entry),
      filename,
    },
  };

  const compiler = webpack(params);
  await new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (!err && stats.hasErrors()) {
        switch (stats.compilation.errors.length) {
        case 0: err = stats; break;
        case 1: err = stats.compilation.errors[0]; break;
        default: err = stats.compilation.errors; break;
        }
      }
      err ? reject(err) : resolve(stats);
    });
  });

  addAsset(filename);
  if (params.output.sourceMapFilename)
    addAsset(params.output.sourceMapFilename);
  if (!isDebug)
    addAsset(`${filename}.LICENSE.txt`);
  
  console.log(`[script.bundle] Generate ${filename}`);
}

async function buildBundle({script, isDebug, binaryDir, distDir, addAsset}) {
  if (script && script.entry) {
    for (const [ key, entry ] of Object.entries(script.entry)) {
      const filename = `${key}.bundle.js`;

      const debugParams = {
        mode: 'development',
        devtool: 'source-map',
        output: {
          filename,
          sourceMapFilename: `${filename}.map`,
          path: distDir,
        }
      };

      const releaseParams = {
        mode: 'production',
        output: {
          filename,
          path: distDir,
        }
      };

      const params = isDebug ? debugParams : releaseParams;

      params.entry = {};
      params.entry[key] = path.resolve(binaryDir, entry);

      const compiler = webpack(params);
      await new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
          if (!err && stats.hasErrors()) {
            switch (stats.compilation.errors.length) {
            case 0: err = stats; break;
            case 1: err = stats.compilation.errors[0]; break;
            default: err = stats.compilation.errors; break;
            }
          }
          err ? reject(err) : resolve(stats);
        });
      });

      addAsset(filename);
      if (params.output.sourceMapFilename)
        addAsset(params.output.sourceMapFilename);
      if (!isDebug)
        addAsset(`${filename}.LICENSE.txt`);
      
      console.log(`[script.bundle] Generate ${filename}`);
    }
  }
}

export default {
  configure,
  async generate(config) {
    await buildJson(config);
    await buildConst(config);
    await buildBundle(config);
  },
  process,
};
