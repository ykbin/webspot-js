import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from 'url';

import scriptModule from './ScriptModule.mjs';
import styleModule from './StyleModule.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function preBuild(config) {
  const distDir = path.join(config.binaryDir, "dist");
  
  if (fs.existsSync(distDir))
    fs.rmSync(distDir, {recursive: true});
  fs.mkdirSync(distDir);

  config.distDir = distDir;
}

async function buildConstants({script, sourceDir, binaryDir}) {
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

async function buildJSON({json, sourceDir, binaryDir, distDir}) {
  if (json && json.list) {
    for (let i = 0; i < json.list.length; i++) {
      const inFilename = path.resolve(sourceDir, json.list[i]);
      const outFilename = path.basename(inFilename, '.mjs') + ".json";
      const { default: module } = await import(pathToFileURL(inFilename));
      const content = JSON.stringify(module);
      fs.writeFile(path.resolve(distDir, outFilename), content, { encoding: 'utf8', flag: 'w' }, (err) => {
        if (err) throw err;
        console.log(`[json] Generate ${outFilename}`);
      });
    }
  }
}

export default {
  build(config) {
    function onError(err) {
      console.log(err);
      console.error(err.stack);
      process.exit(1);
    }  
    (async () => {
      await scriptModule.configure(config).catch(onError);
      await styleModule.configure(config).catch(onError);

      await preBuild(config);
      await scriptModule.generate(config).catch(onError);
      await styleModule.generate(config).catch(onError);
      
      await buildConstants(config).catch(onError);
      await buildJSON(config).catch(onError);
    })();
  }
};
