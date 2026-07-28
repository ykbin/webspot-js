import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

import domModule from './DomModule.mjs';
import scriptModule from './ScriptModule.mjs';
import styleModule from './StyleModule.mjs';
import imageModule from './ImageModule.mjs';
import resourceModule from './ResourceModule.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isEqualValue(a, b) {
  if (typeof a !== 'object')
    return Object.is(a, b);
  else if (typeof b !== 'object')
    return false;
  else if (a === b)
    return true;
  else if (!a || !b)
    return false;

  const k1 = Object.keys(a);
  const k2 = Object.keys(b);

  if (k1.length !== k2.length)
    return false;

  for (const key of k1) {
    if (!isEqualValue(a[key], b[key]))
      return false;
  }

  return true;
}

async function preConfigure(config) {
  config.isDebug = (config.buildType === "Debug");

  const assets = {
    name: config.name,
    base: config.baseUrl,
    files: [],
  };

  const entries = [];
  const addFile = (item) => {
    for (const iter of assets.files) {
      if (isEqualValue(iter, item))
        return false;
    }
    assets.files.push(item);
    return true;
  }

  const re = /\\/g;
  config.addAsset = (file, alias) => {
    file = file.replace(re, path.posix.sep);
    for (let iter of alias ?? [ file ]) {
      addFile({ url: path.posix.resolve(assets.base, iter), file, entry: entries.includes(file) });
    }
  };

  config.writeAsset = async (src, content, options) => {
    const file = src.replace(re, path.posix.sep);
    for (let iter of options.alias ?? [ file ]) {
      iter = iter.replace(re, path.posix.sep);
      addFile({ url: path.posix.resolve(assets.base, iter), file, entry: entries.includes(file) });
    }
    const filename = path.resolve(config.binaryDir, src);
    await fs.promises.writeFile(filename, content, { encoding: 'utf8', flag: 'w' });
  };

  config.setApplication = (application) => {
    assets.application = application;
    if (application.title) {
      assets.title = application.title;
      delete assets.application.title;
    }
    if (application.description) {
      assets.description = application.description;
      delete assets.application.description;
    }
    if (application.main) {
      const file = application.main.replace(re, path.posix.sep);
      entries.push(file);
      for (const iter of assets.files) {
        if (iter.file === file) {
          iter.entry = true;
          break;
        }
      }
      delete assets.application.main;
    }
  };

  config.flushAsset = async () => {
    const files = assets.files;
    delete assets.files;
    assets.files = files;

    const content = JSON.stringify(assets);
    const basename = "manifest.json";
    await fs.promises.writeFile(path.resolve(config.binaryDir, basename), content, { encoding: 'utf8', flag: 'w' });
    console.log(`[asset.json] Generate ${basename}`);
  };
  
  if (fs.existsSync(config.binaryDir))
    fs.rmSync(config.binaryDir, {recursive: true});
  fs.mkdirSync(config.binaryDir);
}

export default {
  build(config) {
    const modules = [
      domModule,
      styleModule,
      scriptModule,
      imageModule,
      resourceModule,
    ];
    function onError(err) {
      console.log(err);
      console.error(err.stack);
      process.exit(1);
    }  
    (async () => {
      await preConfigure(config);

      for (const module of modules) {
        await module.configure(config).catch(onError);
      }

      for (const module of modules) {
        await module.generate(config).catch(onError);
      }

      await config.flushAsset();
    })();
  }
};
