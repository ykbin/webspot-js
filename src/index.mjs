import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

import scriptModule from './ScriptModule.mjs';
import styleModule from './StyleModule.mjs';
import imageModule from './ImageModule.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function preConfigure(config) {
  const distDir = path.join(config.binaryDir, "dist");
  config.distDir = distDir;
  
  if (fs.existsSync(distDir))
    fs.rmSync(distDir, {recursive: true});
  fs.mkdirSync(distDir);
}

async function preGenerate({distDir}) {
}

export default {
  build(config) {
    const modules = [
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
    })();
  }
};
