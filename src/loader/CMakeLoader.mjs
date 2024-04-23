export default function(source) {
  const callback = this.async();
	(async () => {    
    const _projectPattern = /project *\( *([^ ]+) *([^)]*)\)/;
    const _versionPattern = /VERSION +([^ ]+)/;
    let content = source;
    let match = content.match(_projectPattern);
    const name = match[1];
    content = match[2];
    match = content.match(_versionPattern);
    const version = match[1];

    const result = {
      name,
      version,
    };

		return `export default ${JSON.stringify(result)}`;
	})().then((res) => callback(undefined, res), (err) => callback(err));
}
