/**
 * Turn a dot-bracket secondary structure into 2D coordinates.
 */

const OPENING = { "(": ")", "[": "]", "{": "}", "<": ">" };
const CLOSING = { ")": "(", "]": "[", "}": "{", ">": "<" };

export function pairTable(structure) {
  const table = new Array(structure.length).fill(-1);
  const stacks = {};
  for (let i = 0; i < structure.length; i++) {
    const c = structure[i];
    if (c in OPENING) {
      if (!(c in stacks)) {
        stacks[c] = [];
      }
      stacks[c].push(i);
    } else if (c in CLOSING) {
      const stack = stacks[CLOSING[c]];
      if (!stack || stack.length === 0) {
        continue;
      }
      const j = stack.pop();
      table[i] = j;
      table[j] = i;
    }
  }
  return table;
}

export function basePairs(table) {
  const pairs = [];
  for (let i = 0; i < table.length; i++) {
    if (table[i] > i) {
      pairs.push([i, table[i]]);
    }
  }
  return pairs;
}

function normalizeAngle(a) {
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

function layoutLoop(a, b, table, pos, bond, dirX, dirY) {
  const vertices = [a];
  const branches = [];
  let k = a + 1;
  while (k < b) {
    vertices.push(k);
    if (table[k] === -1) {
      k += 1;
    } else {
      const l = table[k];
      vertices.push(l);
      branches.push([k, l]);
      k = l + 1;
    }
  }
  vertices.push(b);

  const m = vertices.length;
  if (m < 3) {
    return [];
  }

  const radius = bond / (2 * Math.sin(Math.PI / m));
  const apothem = bond / (2 * Math.tan(Math.PI / m));
  const center = {
    x: (pos[a].x + pos[b].x) / 2 + dirX * apothem,
    y: (pos[a].y + pos[b].y) / 2 + dirY * apothem,
  };

  const startAngle = Math.atan2(pos[a].y - center.y, pos[a].x - center.x);
  const endAngle = Math.atan2(pos[b].y - center.y, pos[b].x - center.x);
  const step = (normalizeAngle(endAngle - startAngle) > 0 ? -1 : 1) * ((2 * Math.PI) / m);

  for (let t = 1; t < m - 1; t++) {
    const angle = startAngle + t * step;
    pos[vertices[t]] = {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  }

  return branches.map(([i, j]) => {
    const mx = (pos[i].x + pos[j].x) / 2 - center.x;
    const my = (pos[i].y + pos[j].y) / 2 - center.y;
    const len = Math.hypot(mx, my) || 1;
    return [i, j, mx / len, my / len];
  });
}

export function layoutStructure(structure, options = {}) {
  const bond = options.bondLength || 1;
  const n = structure.length;
  const table = pairTable(structure);
  const pos = new Array(n);

  const pending = [];
  let x = 0;
  let i = 0;
  while (i < n) {
    if (table[i] === -1 || table[i] < i) {
      pos[i] = { x, y: 0 };
      x += bond;
      i += 1;
    } else {
      const j = table[i];
      pos[i] = { x, y: 0 };
      pos[j] = { x: x + bond, y: 0 };
      pending.push([i, j, 0, 1]);
      x += 2 * bond;
      i = j + 1;
    }
  }

  while (pending.length > 0) {
    const [i0, j0, dirX, dirY] = pending.pop();
    let a = i0;
    let b = j0;
    while (a + 1 < b - 1 && table[a + 1] === b - 1) {
      pos[a + 1] = { x: pos[a].x + dirX * bond, y: pos[a].y + dirY * bond };
      pos[b - 1] = { x: pos[b].x + dirX * bond, y: pos[b].y + dirY * bond };
      a += 1;
      b -= 1;
    }
    pending.push(...layoutLoop(a, b, table, pos, bond, dirX, dirY));
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let k = 0; k < n; k++) {
    if (!pos[k]) {
      pos[k] = k > 0 ? { x: pos[k - 1].x + bond, y: pos[k - 1].y } : { x: 0, y: 0 };
    }
    minX = Math.min(minX, pos[k].x);
    minY = Math.min(minY, pos[k].y);
    maxX = Math.max(maxX, pos[k].x);
    maxY = Math.max(maxY, pos[k].y);
  }

  if (n === 0) {
    minX = minY = maxX = maxY = 0;
  }

  return {
    points: pos,
    pairs: basePairs(table),
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}

export function commonPairs(structureA, structureB) {
  const a = pairTable(structureA);
  const b = pairTable(structureB);
  let shared = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] > i) {
      total += 1;
      if (b[i] === a[i]) {
        shared += 1;
      }
    }
  }
  return { shared, total };
}
