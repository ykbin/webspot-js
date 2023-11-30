import fs from "node:fs";
import path from "node:path";

export async function copyFileIfDifferent(filename, inDirname, outDirname) {
  const inFilename = path.resolve(inDirname, filename);
  const outFilename = path.resolve(outDirname, filename);

  const inStats = await fs.promises.stat(inFilename);

  let outStats = null;
  try { outStats = await fs.promises.stat(outFilename); } catch (e) { }
  if (outStats === null || inStats.mtime.getTime() !== outStats.mtime.getTime()) {
    console.log(`[configure] Copy ${filename}`);
    await fs.promises.cp(inFilename, outFilename, {recursive: true});
    await fs.promises.utimes(outFilename, inStats.atime, inStats.mtime);
  }
}

export function getFilenamesFromParams(params) {
  const result = [];

  if (!params)
    /* nope */;
  else if (Array.isArray(params))
    result.push(...params);
  else if (typeof params === "object")
    result.push(...Object.values(params));
  else if (typeof params === "string")
    result.push(params);
  else
    throw "Not support params type";

  return result;
}
