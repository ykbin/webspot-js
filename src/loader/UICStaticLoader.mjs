import { pathToFileURL } from 'node:url';

async function makeStaticRegisterScript(module)
{
  const {PKG, CTLS} = module;

  let scriptContent = `import { ControlManager } from 'webnetq-js';\n\n`;
  for (const key in CTLS) {
    scriptContent += `import { default as ${key} } from '${PKG}/control/${key}';\n`;
  };
  scriptContent += `\n`;

  scriptContent += `const manager = ControlManager.getInstance();\n\n`;

  for (const key in CTLS) {
    const ctlModule = await import(`${PKG}/template/${key}`);
    for (const iter of ['NAME', 'ROOT_HTML', 'CSS', 'ROOT_CLASS']) {
      if (typeof ctlModule[iter] !== 'string') {
        throw `Can't find ${iter} for '${key}' control`;
      }
    }
    const ctlParams = {
      name: ctlModule.NAME,
      rootHTML: ctlModule.ROOT_HTML,
      rootCSS: ctlModule.CSS,
      rootClass: ctlModule.ROOT_CLASS,
    };
    if (typeof ctlModule.PORT_CLASS === 'string') {
      ctlParams.portClass = ctlModule.PORT_CLASS;
    }
    else if (typeof ctlModule.PORT_CLASS !== 'undefined') {
      throw `Wrong type of 'PORT_CLASS' for '${key}' control`;
    }
    scriptContent += `manager.register(${key}, ${JSON.stringify(ctlParams)});\n`;
  };
  scriptContent += `\n`;

  scriptContent += `export const PKG = '${PKG}';\n`;
  scriptContent += `export const CTLS = {\n`;
  for (const key in CTLS) {
    scriptContent += `  ${key},\n`;
  };
  scriptContent += `};\n`;

  return scriptContent;
}

export default function(source) {
  const resourceUrl = pathToFileURL(this.resourcePath);
  const callback = this.async();
	(async () => {
    const module = await import(resourceUrl);
		return await makeStaticRegisterScript(module);
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
