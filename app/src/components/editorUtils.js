export const EDITOR_URL_BUILDERS = {
  vscode: (path, line) => `vscode://file/${path}:${line}`,
  cursor: (path, line) => `cursor://file/${path}:${line}`,
  webstorm: (path, line) => `webstorm://open?file=${path}&line=${line}`,
  rubymine: (path, line) => `rubymine://open?file=${path}&line=${line}`,
  sublime: (path, line) => `subl://open?url=file://${path}&line=${line}`,
  mvim: (path, line) => `mvim://open?url=file://${path}&line=${line}`,
};

export function editorUrl(editor, projectRoot, relativePath, line) {
  const fullPath = `${projectRoot}/${relativePath}`;
  const builder = EDITOR_URL_BUILDERS[editor] || EDITOR_URL_BUILDERS.vscode;
  return builder(fullPath, line || 1);
}
