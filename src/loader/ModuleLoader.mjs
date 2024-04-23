import { pathToFileURL } from 'node:url';

export default function(source) {
  const resourceUrl = pathToFileURL(this.resourcePath);
  const callback = this.async();
	(async () => {
    let result = "";
    const module = await import(resourceUrl);
    for (const key in module) {
      result += 'export ';
      result += (key == 'default') ? `default ` : `const ${key} = `;
      result += JSON.stringify(module[key]);
      result += '\n';
    }
		return result;
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
