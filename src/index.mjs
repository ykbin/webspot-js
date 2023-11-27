import path from "path";
import fs from "fs";
import { fileURLToPath, pathToFileURL } from 'url';

import webpack from 'webpack';

import postcss from 'postcss';
import postcssImport from 'postcss-import';
import autoPrefixer from 'autoprefixer';
import postcssMinify from '@csstools/postcss-minify';
import postcssGlobalData from '@csstools/postcss-global-data';
import postcssCustomProperties from 'postcss-custom-properties';

//import postcssNested from 'postcss-nested';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildScript({script, buildType, binaryDir}) {
  const distDir = path.join(binaryDir, "dist");

  if (fs.existsSync(distDir))
    fs.rmSync(distDir, {recursive: true});
  fs.mkdirSync(distDir);

  const isDevelopment = (buildType === "Debug");
  for (const [ key, val ] of Object.entries(script.entry)) {
    const params = {
      mode: isDevelopment ? 'development' : 'production',
      devtool: isDevelopment ? 'inline-source-map' : 'source-map',
      entry: {},
      output: {
        filename: `${key}.bundle.js`,
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
      console.log("Generate converter.bundle.js");
    });
  }
}

async function buildStyle({style, buildType, binaryDir}) {
  const stylePlugins = [
    postcssImport,
    autoPrefixer,
    postcssGlobalData({
      files: [
        style.prop,
      ],
    }),
    postcssCustomProperties({
      preserve: false
    }),
  ];

  if (buildType !== "Debug")
    stylePlugins.push(postcssMinify);

  for (const [ key, val ] of Object.entries(style.entry)) {
    const inFilepath = path.resolve(binaryDir, val);
    fs.readFile(inFilepath, "utf-8", (err, content) => {
      if (err) throw err;
      const outFilename = `${key}.bundle.css`;
      const outFullFilepath = path.resolve(binaryDir, 'dist', outFilename);
      postcss(stylePlugins).process(content).then(result => {
        fs.writeFile(outFullFilepath, result.css, () => true);
        console.log(`Generate ${outFilename} [postcss]`);
        if (result.map) {
          fs.writeFile(`${outFullFilepath}.map`, result.map);
          console.log(`Generate ${outFilename}.map  [postcss]`)
        }
      });
    });
  }
};

async function buildConstants({script, sourceDir, binaryDir}) {
  if (script.hasOwnProperty("const")) {
    const inFilename = path.resolve(sourceDir, script.const);
    const { default: constants } = await import(pathToFileURL(inFilename));

    let content = "";
  
    for (const [ key, val ] of Object.entries(constants)) {
      content += `static const char ${key}[] = "${val}";\n`;
    }
  
    const outFilename = path.resolve(binaryDir, "Constans.h");
    fs.writeFile(outFilename, content, { encoding: 'utf8', flag: 'w' }, (err) => {
      if (err) throw err;
      console.log("Generate Constans.h [webspot]");
    }); 
  }
}

function build(config) {
  function onError(err) {
    console.log(err);
    console.error(err.stack);
    process.exit(1);
  }  
  (async () => {
    await buildScript(config).catch(onError);
    await buildStyle(config).catch(onError);
    await buildConstants(config).catch(onError);
  })();
}

export default {
  build,
};
