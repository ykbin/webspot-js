#!/usr/bin/env node

import path from "path";
import { fileURLToPath, pathToFileURL } from 'url';
import webspot from './index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const converArgName = (key) => {
  let result = "";

  let pos = 0;
  while (pos < key.length) {
    let end = key.indexOf("-", pos);
    if (end === -1) {
      end = key.length;
    }
    result += result ? key.charAt(pos).toUpperCase() + key.substring(pos + 1, end) : key.substring(pos, end);
    pos = end + 1;
  }

  return result;
};

const makeAgrsMap = (args, defaultArgMap) => {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [ key, val ] = arg.split("=");
      const name = converArgName(key.slice(2));
      if (!defaultArgMap.hasOwnProperty(name)) {
        throw `Unknown name ${name} for argument ${arg}`;
      }
      result[name] = val;
    }
    else {
      throw `Unknown argument ${arg}`;
    }
  }
  for (const [ key, val ] of Object.entries(defaultArgMap)) {
    if (!result.hasOwnProperty(key)) {
      result[key] = val;
    }
  }
  return result;
};

const [,, ...args] = process.argv;
const argm = makeAgrsMap(args, {
  buildType: "Release",
  sourceDir: __dirname,
  binaryDir: process.cwd,
});

(async () => {
  const configUrl = pathToFileURL(path.resolve(argm.binaryDir, "project.config.mjs"));
  const { default: projectConfig } = await import(configUrl);
  const config = Object.assign(projectConfig, argm);
  webspot.build(config);
})();
