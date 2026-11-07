const byName = (a, b) => a.name.localeCompare(b.name);

function build(files, match) {
  const root = { name: "", path: "", dirs: new Map(), files: [] };
  files.forEach((f, i) => {
    if (match && !match(f)) return;
    const parts = f.path.split("/"), name = parts.pop();
    let node = root;
    for (const part of parts) {
      const path = node.path ? `${node.path}/${part}` : part;
      if (!node.dirs.has(part)) node.dirs.set(part, { name: part, path, dirs: new Map(), files: [] });
      node = node.dirs.get(part);
    }
    node.files.push({ name, i });
  });
  return root;
}

// A folder holding only one folder reads as one row: a/b/c.
function squash(dir) {
  let name = dir.name;
  while (!dir.files.length && dir.dirs.size === 1) { dir = [...dir.dirs.values()][0]; name += `/${dir.name}`; }
  return { dir, name };
}

const count = (dir) => dir.files.length + [...dir.dirs.values()].reduce((n, d) => n + count(d), 0);

function walk(node, depth, visit) {
  for (const child of [...node.dirs.values()].sort(byName)) {
    const { dir, name } = squash(child);
    if (visit.dir(dir, name, depth)) walk(dir, depth + 1, visit);
  }
  for (const f of [...node.files].sort(byName)) visit.file(f, depth);
}

// The files in the order the tree shows them, folders first.
export function treeOrder(files) {
  const order = [];
  walk(build(files), 0, { dir: () => true, file: (f) => order.push(files[f.i]) });
  return order;
}

export function treeRows(files, closed, match) {
  const rows = [];
  walk(build(files, match), 0, {
    dir: (dir, name, depth) => {
      const open = !closed.has(dir.path);
      rows.push({ t: "dir", key: `d:${dir.path}`, path: dir.path, name, depth, open, count: count(dir) });
      return open;
    },
    file: (f, depth) => rows.push({ t: "file", key: `f:${files[f.i].path}`, i: f.i, name: f.name, depth }),
  });
  return rows;
}
