export function flattenFilePaths(tree, acc = []) {
  if (!Array.isArray(tree)) return acc;
  for (const node of tree) {
    if (!node) continue;
    const nodePath = node.path || node.name;
    if (node.children && Array.isArray(node.children)) {
      flattenFilePaths(node.children, acc);
    } else if (nodePath) {
      acc.push(nodePath);
    }
  }
  return acc;
}
