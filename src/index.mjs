import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from 'url';

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

export default {
  build(config) {
    function onError(err) {
      console.log(err);
      console.error(err.stack);
      process.exit(1);
    }  
    (async () => {
      await styleModule.configure(config).catch(onError);
      await scriptModule.configure(config).catch(onError);

      await preBuild(config);

      await styleModule.generate(config).catch(onError);
      await scriptModule.generate(config).catch(onError);
    })();
  }
};
