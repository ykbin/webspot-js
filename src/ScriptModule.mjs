import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from 'node:url';
import webpack from 'webpack';
import { copyFileIfDifferent, getFilenamesFromParams } from './Lib.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function configure({script, sourceDir, binaryDir}) {
  const list = [];
  for (const name of (script ? ['entry', 'list'] : [])) {
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

async function buildJson({script, sourceDir, writeAsset}) {
  if (script && script.json) {
    const arr = (typeof script.json === "string") ? [ script.json ] : script.json; 
    for (let i = 0; i < arr.length; i++) {
      const inFilename = path.resolve(sourceDir, arr[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      await writeAsset(outFilename, content, {type: "application/json"});
      console.log(`[script.json] Generate ${outFilename}`);
    }
  }
}

async function processScript({ from, to, isDebug, workDir, distDir, addAsset, type, staticControlFile }) {
  const filename = to;

  const defaultParams = {
    module: {
      rules: [],
    },
    resolve: {
      modules: [
        path.join(process.cwd(), 'node_modules')
      ],
    },
    resolveLoader: {
      alias: {
        'cmake-loader': path.resolve(__dirname, 'loader/CMakeLoader.mjs'),
        'module-loader': path.resolve(__dirname, 'loader/ModuleLoader.mjs'),
        'uictmplt-loader': path.resolve(__dirname, 'loader/UICTemplateLoader.mjs'),
        'uic-static-loader': path.resolve(__dirname, 'loader/UICStaticLoader.mjs'),
      },
    },
  };

  const index = [];
  if (staticControlFile) {
    defaultParams.module.rules.push({
      test: staticControlFile,
      loader: 'uic-static-loader',
    });
    index.push(staticControlFile);
  }
  index.push(path.join(workDir, from));

  const debugParams = {
    ...defaultParams,
    mode: 'development',
    devtool: 'source-map',
    output: {
      sourceMapFilename: `${filename}.map`,
      path: distDir,
      filename,
    },
  };

  const releaseParams = {
    ...defaultParams,
    mode: 'production',
    output: {
      path: distDir,
      filename,
    },
  };

  const params = isDebug ? debugParams : releaseParams;
  if (type) {
    params.output.library = {type};
    if (type === 'module') {
      params.experiments = {outputModule: true};
    }
  }

  params.entry = {
    index
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

  if (addAsset) {
    addAsset(filename);
    if (params.output.sourceMapFilename)
      addAsset(params.output.sourceMapFilename);
    if (!isDebug)
      addAsset(`${filename}.LICENSE.txt`);
  }

  console.log(`[script.bundle] Generate ${filename}`);
}

async function buildBundle({ script, isDebug, sourceDir, distDir, addAsset }) {
  if (script) {
    for (const [ entry, from ] of Object.entries(script.entry || {})) {
      const to = `${entry}.bundle.js`;
      await processScript({
        from,
        to,
        isDebug,
        workDir: sourceDir,
        distDir,
        addAsset
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
  processScript,
};
