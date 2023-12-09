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
  const distDir = path.join(config.binaryDir, "dist");
  config.distDir = distDir;
  config.isDebug = (config.buildType === "Debug");

  const assets = {
    name: config.name,
    baseUrl: config.baseUrl,
    resources: [],
  };

  const addAssetItem = (item) => {
    for (const iter of assets.resources) {
      if (isEqualValue(iter, item))
        return false;
    }
    assets.resources.push(item);
    return true;
  }

  config.addAsset = (src) => {
    src = src.replace(/\\/g, "/");
    addAssetItem({ path: src });
  };

  config.writeAsset = async (src, content, options) => {
    const pathStr = src.replace(/\\/g, "/");
    if (options.alias) {
      for (const iter of options.alias)
      addAssetItem({ alias: iter, path: pathStr });
    }
    else {
      addAssetItem({ path: pathStr });
    }

    const filename = path.resolve(distDir, src);
    await fs.promises.writeFile(filename, content, { encoding: 'utf8', flag: 'w' });
  };

  config.flushAsset = async () => {
    const content = JSON.stringify(assets);
    await fs.promises.writeFile(path.resolve(distDir, 'WebAssetConfig.json'), content, { encoding: 'utf8', flag: 'w' });
    console.log(`[asset.json] Generate WebAssetConfig.json`);
  };

  config.setApplication = (application) => {
    assets.application = application;
  };
  
  if (fs.existsSync(distDir))
    fs.rmSync(distDir, {recursive: true});
  fs.mkdirSync(distDir);
}

async function preGenerate({distDir}) {
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

      await preGenerate(config);

      for (const module of modules) {
        await module.generate(config).catch(onError);
      }

      // make
      // install

      await config.flushAsset();
    })();
  }
};
