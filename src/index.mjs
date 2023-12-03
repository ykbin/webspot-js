import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

import domModule from './DomModule.mjs';
import scriptModule from './ScriptModule.mjs';
import styleModule from './StyleModule.mjs';
import imageModule from './ImageModule.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function makeFilename(type, length) {
  const map  = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  let result = '';
  for (let i = 0; i < length; i++) {
    result += map.charAt(Math.floor(Math.random() * map.length));
  }

  switch (type) {
  case "text/html":
    return result + ".html";
  case "text/css":
    return result + ".css";
  case "application/json":
    return result + ".json";
  }

  return result;
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

  config.writeAsset = async (src, type, content) => {
    const item = src.startsWith("/") ? { alias: src, path: makeFilename(type, 8) } : { path: src };
    assets.resources.push(item);
    const filename = path.resolve(distDir, item.path);
    await fs.promises.writeFile(filename, content, { encoding: 'utf8', flag: 'w' });
  };

  config.flushAsset = async () => {
    const content = JSON.stringify(assets);
    await fs.promises.writeFile(path.resolve(distDir, 'WebModuleConfig.json'), content, { encoding: 'utf8', flag: 'w' });
    console.log(`[asset.json] Generate WebModuleConfig.json`);
  }
  
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
