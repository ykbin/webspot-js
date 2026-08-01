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

  const getUrl = (filename) => {
    const item = assets.files.find(i => i.file === filename);
    if (!item)
      throw new Error(`No URL for ${filename}`);
    return item.url;
  }

  const addFile = (item) => {
    for (const iter of assets.files) {
      if (isEqualValue(iter, item))
        return false;
    }
    assets.files.push(item);
    return true;
  }

  const re = /\\/g;
  config.addAsset = (file, options) => {
    file = file.replace(re, path.posix.sep);
    for (let iter of options.alias ?? [ file ]) {
      const item = { url: path.posix.resolve(assets.base, iter), file };
      if (options.type)
        item.type = options.type;
      if (options.headers)
        item.headers = options.headers;
      addFile(item);
    }
  };

  config.writeAsset = async (src, content, options) => {
    const file = src.replace(re, path.posix.sep);
    for (let iter of options.alias ?? [ file ]) {
      iter = iter.replace(re, path.posix.sep);
      const item = { url: path.posix.resolve(assets.base, iter), file };
      if (options.type)
        item.type = options.type;
      if (options.headers)
        item.headers = options.headers;
      addFile(item);
    }
    const filename = path.resolve(config.binaryDir, src);
    await fs.promises.writeFile(filename, content, { encoding: 'utf8', flag: 'w' });
  };

  config.setApplication = (application) => {
    if (!application.main)
      throw new Error("No main entry");

    const entry = {
      title: application.title ?? "",
      description: application.description ?? "",
      main: getUrl(application.main),
      icons: [],
      screenshots: [],
    };

    if (application.icon) {
      for (let i = 0; i < application.icon.length; i++) {
        entry.icons.push({
          url: getUrl(application.icon[i]),
          colorScheme: (i % 2) ? "dark" : "light",
        });
      }
    }

    if (application.logo) {
      for (let i = 0; i < application.logo.length; i++) {
        entry.screenshots.push({
          url: getUrl(application.logo[i]),
          colorScheme: (i % 2) ? "dark" : "light",
        });
      }
    }

    if (assets.entries)
      assets.entries.push(entry);
    else
      assets.entries = [ entry ];
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
