import path from "node:path";
import webpack from 'webpack';
import { copyParamsIfDifferent } from './Lib.mjs';

async function configure({script, sourceDir, binaryDir}) {
  if (script) {
    for (const name of [ 'entry', 'const', 'list' ]) {
      await copyParamsIfDifferent(script[name], {sourceDir, binaryDir});
    }
  }
}

async function generate({script, buildType, binaryDir, distDir}) {
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
        console.log(`[script] Generate ${filename}`);
      });
    }
  }
}

export default {
  configure,
  generate,
};
