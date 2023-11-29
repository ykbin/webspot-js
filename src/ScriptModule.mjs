import path from "node:path";
import webpack from 'webpack';
import { pathToFileURL } from 'url';
import { copyParamsIfDifferent } from './Lib.mjs';

async function configure({script, sourceDir, binaryDir}) {
  if (script) {
    for (const name of [ 'entry', 'const', 'list', 'json' ]) {
      await copyParamsIfDifferent(script[name], {sourceDir, binaryDir});
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
    fs.writeFile(outFilename, content, { encoding: 'utf8', flag: 'w' }, (err) => {
      if (err) throw err;
      console.log("[const] Generate Constans.h");
    }); 
  }
}

async function buildJson({script, binaryDir, distDir}) {
  if (script.json) {
    const arr = (typeof script.json === "string") ? [ script.json ] : script.json; 
    for (let i = 0; i < arr.length; i++) {
      const inFilename = path.resolve(binaryDir, arr[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      fs.writeFile(path.resolve(distDir, outFilename), content, { encoding: 'utf8', flag: 'w' }, (err) => {
        if (err) throw err;
        console.log(`[script.json] Generate ${outFilename}`);
      });
    }
  }
}

async function buildBundle({script, buildType, binaryDir, distDir}) {
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
        console.log(`[script.bundle] Generate ${filename}`);
      });
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
