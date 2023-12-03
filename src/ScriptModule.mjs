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
  if (script.json) {
    const arr = (typeof script.json === "string") ? [ script.json ] : script.json; 
    for (let i = 0; i < arr.length; i++) {
      const inFilename = path.resolve(binaryDir, arr[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      await writeAsset(outFilename, "application/json", content);
      console.log(`[script.json] Generate ${outFilename}`);
    }
  }
}

async function buildBundle({script, isDebug, binaryDir, distDir}) {
  if (script && script.entry) {
    for (const [ key, entry ] of Object.entries(script.entry)) {
      const filename = `${key}.bundle.js`;
      const params = {
        mode: isDebug ? 'development' : 'production',
        devtool: isDebug ? 'inline-source-map' : 'source-map',
        entry: {},
        output: {
          filename,
          path: distDir,
        }
      };

      params.entry[key] = path.resolve(binaryDir, entry);

      const compiler = webpack(params);

      const writeFileOrigin = compiler.outputFileSystem.writeFile;
      compiler.outputFileSystem.writeFile = function() {
        console.log(">>>", arguments);
        writeFileOrigin.apply(this, arguments);
      };

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
};
