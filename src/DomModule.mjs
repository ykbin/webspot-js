import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from 'node:url';
import jsdom from "jsdom";
import { resolve as importMetaResolve } from 'import-meta-resolve';

import { copyFileIfDifferent } from './Lib.mjs';
import styleModule from './StyleModule.mjs';
import scriptModule from './ScriptModule.mjs';

const { JSDOM } = jsdom;

function getOptions(params) {
  const defaultOptions = {
    hasMeta: true,
  };
  return Object.assign(defaultOptions, params);
}

async function makeResObject({resource, baseUrl, sourceDir, distDir, addAsset}) {
  if (typeof resource !== "string")
    return null;

  const filename = path.basename(resource);
  const href = path.posix.join(baseUrl, filename);

  const input = path.resolve(sourceDir, resource);
  const output = path.resolve(distDir, filename);

  addAsset(filename);
  if (await copyFileIfDifferent(input, output))
    console.log(`[dom.configure] Copy ${resource}`);
  
  return { input, output, href };
}

async function configure({dom, baseUrl, sourceDir, distDir, addAsset}) {
  if (!dom) return;
  for (const [ name, params ] of Object.entries(dom.targets || {})) {
    params.output = params.output || {};
    params.output.filename = params.output.filename || `${name}.html`;
    params.favicon = await makeResObject({resource: params.favicon || (dom.options && dom.options.favicon), baseUrl, sourceDir, distDir, addAsset});
    params.shortcut = {
      light: await makeResObject({
        resource: (params.shortcut && params.shortcut.light) || (dom.options && dom.options.shortcut && dom.options.shortcut.light),
        baseUrl, sourceDir, distDir, addAsset
      }),
      dark: await makeResObject({
        resource: (params.shortcut && params.shortcut.dark) || (dom.options && dom.options.shortcut && dom.options.shortcut.dark),
        baseUrl, sourceDir, distDir, addAsset
      }),
    };

    if (params.style || (dom.options && dom.options.style)) {
      const globalStyle = (dom.options && dom.options.style) ? dom.options.style : {};
      const localStyle = (typeof params.style === 'string') ? { entry: params.style } : (params.style || {});
      params.style = Object.assign({}, globalStyle, localStyle);
    }

    if (params.script || (dom.options && dom.options.script)) {
      const globalScript = (dom.options && dom.options.script) ? ((typeof dom.options.script === 'string') ? { entry: dom.options.script } : (dom.options.script || {})) : {};
      const localScript = (typeof params.script === 'string') ? { entry: params.script } : (params.script || {});
      params.script = Object.assign({}, globalScript, localScript);
    }
  }
}

function getDarkLightFileList(params)
{
  if (typeof params === 'object') {
    if (params.length == 1) {
      return [ params[0], params[0] ];
    }
    if (params.length >= 2) {
      return [ params[0], params[1] ];
    }
  }
  else if (typeof params === 'string') {
    return [ params, params ];
  }
  return [];
}

async function generate({dom, baseUrl, isDebug, sourceDir, binaryDir, distDir, writeAsset, addAsset, setApplication}) {
  if (!dom) return;

  const docModules = {};
  const ctlModules = {};
  const docsDir = path.join(binaryDir, 'webspot', 'documents');
  const ctlsDir = path.join(binaryDir, 'webspot', 'controls');

  for (const [ name, params ] of Object.entries(dom.targets || {})) {
    const { entry, alias, title, description, hasMeta, output, style, script } = getOptions(params);
    const inFilename = path.resolve(sourceDir, entry);

    const cssFilename = `${name}.bundle.css`;
    const cssOptionList = [];

    const jsFilename = `${name}.bundle.js`;

    let fileContent = fs.readFileSync(inFilename, 'utf8').toString();
    fileContent = fileContent.replace(/^\uFEFF/, '');

    let dom = new JSDOM(fileContent);

    let pkgDefault = null;

    {
      const templateElm = dom.window.document.createElement('template');
      templateElm.innerHTML = fileContent;
      if (templateElm.content.childElementCount == 1) {
        const rootElm = templateElm.content.firstElementChild;
        if (rootElm.tagName.toLowerCase() === 'webdocument') {
          const pkg = rootElm.getAttribute("pkg");
          const name = rootElm.getAttribute("name");
          const pkgMainUrl = importMetaResolve(pkg, import.meta.url);
          const pkgMainDir = path.dirname(pkgMainUrl);
          const docUrl = path.join(pkgMainDir, 'document', name, 'index.mjs');
          const workDir = path.dirname(fileURLToPath(docUrl));

          docModules[pkg] = docModules[pkg] || {};
          let docBundleModule = docModules[pkg][name];
          if (!docBundleModule) {
            console.log(`Started processing document ${pkg}/${name}`);
            await scriptModule.processScript({
              from: 'index.mjs',
              to: `${name}.bundle.js`,
              isDebug,
              workDir,
              distDir: docsDir,
              addAsset: null,
              type: 'module',
            });
            docBundleModule = await import(pathToFileURL(path.join(docsDir, `${name}.bundle.js`)));
            docModules[pkg][name] = docBundleModule;
          }

          const HTML = docBundleModule.template.HTML;
          if (typeof HTML !== 'string') {
            console.log('doc module:', docBundleModule);
            console.log('doc module.default:', docBundleModule.default);
            throw `Not exists HTML for ${name}`;
          }

          const innerHTML = rootElm.innerHTML;
          dom = new JSDOM(HTML);

          const portClass = docBundleModule.template.CLASS.PORT;
          if (portClass) {
            const documentElement = dom.window.document.documentElement;
            const portElm = documentElement.classList.contains(portClass) ? documentElement : documentElement.querySelector(`.${portClass}`);
            if (!portElm) {
              throw `Cannot find port documentElement with ${portClass} classname of ${name}`
            }
            portElm.innerHTML = innerHTML;
          }

          cssOptionList.push({
            from: 'index.css',
            to: cssFilename,
            prop: null,
            isDebug,
            workDir,
            isInlineSvg: true,
            content: docBundleModule.template.CSS,
          });

          pkgDefault = pkg;
        }
      }
    }

    const document = dom.window.document;
    // head
    const headFrg = document.createDocumentFragment();
    {

      if (isDebug) {
        const comment = document.createComment(`Genrated from '${entry}'`);
        headFrg.appendChild(comment);
      }

      if (hasMeta) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("http-equiv", "Content-Type");
        metaElm.setAttribute("content", "text/html; charset=utf-8");
        headFrg.appendChild(metaElm);  
      }

      if (description) {
        const metaElm = document.createElement('meta');
        metaElm.setAttribute("name", "description");
        metaElm.setAttribute("content", description);
        headFrg.appendChild(metaElm);  
      }

      if (!document.head.querySelector("title")) {
        const titleStr = (title || path.parse(entry).name) + (isDebug ? " (Debug)" : "");
        const titleElm = document.createElement('title');
        titleElm.setAttribute("class", "notranslate");
        titleElm.setAttribute("translate", "no");
        titleElm.textContent = titleStr;
        headFrg.appendChild(titleElm);
      }

      if (params.favicon) {
        const linkElm = document.createElement('link');
        linkElm.setAttribute("rel", "icon");
        linkElm.setAttribute("href", params.favicon.href);
        linkElm.setAttribute("sizes", "any");
        headFrg.appendChild(linkElm);
      }

      const addShortcutLink = (obj, scheme) => {
        if (obj) {
          const linkElm = document.createElement('link');
          linkElm.setAttribute("rel", "shortcut icon");
          linkElm.setAttribute("href", obj.href);
          linkElm.setAttribute("type", "image/x-icon");
          linkElm.setAttribute("media", `(prefers-color-scheme: ${scheme})`);
          headFrg.appendChild(linkElm);
        }
      };

      addShortcutLink(params.shortcut.light, 'light');
      addShortcutLink(params.shortcut.dark, 'dark');

      if (style) {
        cssOptionList.push({
          from: style.entry,
          to: cssFilename,
          prop: style.prop,
          isDebug,
          workDir: sourceDir,
          isInlineSvg: false,
        });
      }

      if (script) {
        const scriptElm = document.createElement('script');
        scriptElm.setAttribute("defer", "defer");
        scriptElm.setAttribute("src", path.posix.join(baseUrl, jsFilename));
        headFrg.appendChild(scriptElm);
      }
    }

    // controls
    {
      const cssMap = {};
      const templateElm = document.createElement('template');

      const replaceWebctl = async (element) => {
        for await (const iter of Array.from(element.children)) {
          await replaceWebctl(iter);
        }

        if (element.tagName.toLowerCase() === 'webctl') {
          const pkg = element.getAttribute("pkg") || pkgDefault;
          const name = element.getAttribute("ctl");
          const htmlEnable = element.getAttribute("html") !== 'disable';

          const pkgMainUrl = importMetaResolve(pkg, import.meta.url);
          const pkgMainDir = path.dirname(pkgMainUrl);
          const ctlUrl = path.join(pkgMainDir, name, 'index.mjs');
          const workDir = path.dirname(fileURLToPath(ctlUrl));
          
          let ctlBundleModule = ctlModules[name];
          if (!ctlBundleModule) {
            console.log(`Started processing control ${pkg}/${name}`);
            await scriptModule.processScript({
              from: 'index.mjs',
              to: `${name}.bundle.js`,
              isDebug,
              workDir,
              distDir: ctlsDir,
              addAsset: null,
              type: 'module',
            });
            ctlBundleModule = await import(pathToFileURL(path.join(ctlsDir, `${name}.bundle.js`)));
            ctlModules[name] = ctlBundleModule;
          }

          if (htmlEnable) {
            const HTML = ctlBundleModule.template.HTML;
            if (typeof HTML !== 'string') {
              console.log('module:', ctlBundleModule);
              console.log('module.default:', ctlBundleModule.default);
              throw `Not exists HTML for ${name}`;
            }
    
            templateElm.innerHTML = HTML;
            const controlElm = templateElm.content.firstElementChild;
            element.id && (controlElm.id = element.id);
    
            const portClass = ctlBundleModule.template.CLASS.PORT;
            if (portClass) {
              const portElm = controlElm.classList.contains(portClass) ? controlElm : controlElm.querySelector(`.${portClass}`);
              if (!portElm) {
                throw `Cannot find port element with ${portClass} classname of ${name}`
              }
              while (element.firstChild) {
                const child = element.removeChild(element.firstChild);
                portElm.appendChild(child);
              }
            }

            element.replaceWith(controlElm);
          }
          else {
            element.remove();
          }

          cssMap[pkg] = cssMap[pkg] || {};
          if (!cssMap[pkg][name]) {
            cssOptionList.push({
              from: 'index.css',
              to: cssFilename,
              prop: null,
              isDebug,
              workDir,
              isInlineSvg: true,
              content: ctlBundleModule.template.CSS,
            });
            cssMap[pkg][name] = true;
          }
        }
      }

      await replaceWebctl(document.documentElement);
    }

    const cssResult = [];
    for (const options of cssOptionList) {
      const cssText = await styleModule.process(options);
      cssResult.push(cssText);
    }

    if (cssResult.length) {
      await writeAsset(cssFilename, cssResult.join(""), {type: "text/css"});
      console.log(`[style.bundle] Generate ${cssFilename}`);
    }

    if (script) {
      await scriptModule.processScript({
        from: script.entry,
        to: jsFilename,
        isDebug,
        workDir: sourceDir,
        distDir,
        addAsset,
      });
    }

    if (cssResult.length) {
      const linkElm = document.createElement('link');
      linkElm.setAttribute("rel", "stylesheet");
      linkElm.setAttribute("type", "text/css");
      linkElm.setAttribute("href", path.posix.join(baseUrl, cssFilename));
      headFrg.appendChild(linkElm);
    }

    document.head.insertBefore(headFrg, document.head.firstChild);

    let options = {
      type: "text/html",
    };

    const toUrlString = (pathStr) => {
      return pathStr.startsWith("/") ? pathStr : path.posix.join(baseUrl, pathStr);
    }

    if (typeof alias === "string")
      options.alias = [ toUrlString(alias) ];
    else if (alias) {
      options.alias = [];
      for (const iter of alias) {
        options.alias.push(toUrlString(iter));
      }
    }

    if (params.application) {
      const application = {
        title,
        main: output.filename, // DELME: options.alias ? options.alias[0] : output.filename,
        description,
      };

      const addAppImage = async (pathStr) => {
        const filename = path.basename(pathStr);

        const inFilename = path.resolve(sourceDir, pathStr);
        const outFilename = path.resolve(distDir, filename);
  
        addAsset(filename);
        if (await copyFileIfDifferent(inFilename, outFilename))
          console.log(`[dom.configure] Copy ${filename}`);

        return filename;
      }

      if (params.application.icon) {
        application.icon = [];
        for (const iter of getDarkLightFileList(params.application.icon)) {
          application.icon.push(await addAppImage(iter));
        }
      }

      if (params.application.logo) {
        application.logo = [];
        for (const iter of getDarkLightFileList(params.application.logo)) {
          application.logo.push(await addAppImage(iter));
        }
      }

      setApplication(application);
    }

    const html = dom.serialize();
    await writeAsset(output.filename, html, options);
    console.log(`[dom.bundle] Generate ${output.filename}`);
  }
};

export default {
  configure,
  generate,
};
