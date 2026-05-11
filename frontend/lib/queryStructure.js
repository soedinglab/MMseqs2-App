const PROTEIN_RESNAMES = new Set([
  "ALA",
  "ARG",
  "ASN",
  "ASP",
  "CYS",
  "GLN",
  "GLU",
  "GLY",
  "HIS",
  "ILE",
  "LEU",
  "LYS",
  "MET",
  "PHE",
  "PRO",
  "SER",
  "THR",
  "TRP",
  "TYR",
  "VAL",
  "SEC",
  "PYL",
  "MSE",
]);

const WATER_RESNAMES = new Set(["HOH", "WAT", "H2O"]);

const safeNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const tokenizeCifRow = (line) => {
  const tokens = [];
  let i = 0;
  while (i < line.length) {
    while (i < line.length && /\s/.test(line[i])) i += 1;
    if (i >= line.length) break;
    const ch = line[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      i += 1;
      let token = "";
      while (i < line.length) {
        if (line[i] === quote) {
          if (i + 1 < line.length && line[i + 1] === quote) {
            token += quote;
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        token += line[i];
        i += 1;
      }
      tokens.push(token);
      continue;
    }
    const start = i;
    while (i < line.length && !/\s/.test(line[i])) i += 1;
    tokens.push(line.slice(start, i));
  }
  return tokens;
};

const parsePdbAtoms = (input) => {
  const atoms = [];
  for (const line of input.split("\n")) {
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) continue;
    const chainname = (line.length >= 22 ? line[21] : "").trim() || "_";
    const resno = Number.parseInt(line.slice(22, 26).trim(), 10);
    const resname = line.slice(17, 20).trim() || "UNK";
    const atomname = line.slice(12, 16).trim() || "X";
    const x = safeNumber(line.slice(30, 38));
    const y = safeNumber(line.slice(38, 46));
    const z = safeNumber(line.slice(46, 54));
    if (!Number.isFinite(resno) || x === null || y === null || z === null) {
      continue;
    }
    atoms.push({
      chainname,
      resno,
      resname,
      atomname,
      x,
      y,
      z,
      hetero: line.startsWith("HETATM") ? 1 : 0,
    });
  }
  return atoms;
};

const parseCifAtoms = (input) => {
  const atoms = [];
  const lines = input.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== "loop_") continue;
    let j = i + 1;
    const headers = [];
    while (j < lines.length) {
      const line = lines[j].trim();
      if (!line.startsWith("_")) break;
      headers.push(line);
      j += 1;
    }
    if (!headers.some((h) => h.startsWith("_atom_site."))) {
      i = j - 1;
      continue;
    }
    const idx = (name) => headers.indexOf(name);
    const groupIdx = idx("_atom_site.group_PDB");
    const chainIdx = [
      idx("_atom_site.auth_asym_id"),
      idx("_atom_site.label_asym_id"),
    ].find((v) => v >= 0);
    const seqIdx = [
      idx("_atom_site.auth_seq_id"),
      idx("_atom_site.label_seq_id"),
    ].find((v) => v >= 0);
    const compIdx = [
      idx("_atom_site.auth_comp_id"),
      idx("_atom_site.label_comp_id"),
    ].find((v) => v >= 0);
    const atomIdx = [
      idx("_atom_site.auth_atom_id"),
      idx("_atom_site.label_atom_id"),
    ].find((v) => v >= 0);
    const xIdx = idx("_atom_site.Cartn_x");
    const yIdx = idx("_atom_site.Cartn_y");
    const zIdx = idx("_atom_site.Cartn_z");

    while (j < lines.length) {
      const raw = lines[j];
      const line = raw.trim();
      if (!line || line === "#") {
        j += 1;
        if (line === "#") break;
        continue;
      }
      if (
        line === "loop_" ||
        line.startsWith("data_") ||
        line.startsWith("_")
      ) {
        j -= 1;
        break;
      }
      if (line.startsWith(";")) {
        j += 1;
        while (j < lines.length && lines[j].trim() !== ";") j += 1;
        j += 1;
        continue;
      }
      const cols = tokenizeCifRow(raw);
      if (!cols.length) {
        j += 1;
        continue;
      }
      const group = groupIdx >= 0 ? cols[groupIdx] : "ATOM";
      if (group !== "ATOM" && group !== "HETATM") {
        j += 1;
        continue;
      }
      const chainname = (chainIdx >= 0 ? cols[chainIdx] : "") || "_";
      const resno = Number.parseInt(seqIdx >= 0 ? cols[seqIdx] : "", 10);
      const resname = (compIdx >= 0 ? cols[compIdx] : "") || "UNK";
      const atomname = (atomIdx >= 0 ? cols[atomIdx] : "") || "X";
      const x = safeNumber(xIdx >= 0 ? cols[xIdx] : null);
      const y = safeNumber(yIdx >= 0 ? cols[yIdx] : null);
      const z = safeNumber(zIdx >= 0 ? cols[zIdx] : null);
      if (!Number.isFinite(resno) || x === null || y === null || z === null) {
        j += 1;
        continue;
      }
      atoms.push({
        chainname,
        resno,
        resname,
        atomname,
        x,
        y,
        z,
        hetero: group === "HETATM" ? 1 : 0,
      });
      j += 1;
    }
    i = j;
  }
  return atoms;
};

const createQueryStructure = (parsedAtoms) => {
  const atoms = [];
  const residues = [];
  const residueByKey = new Map();

  for (const atom of parsedAtoms) {
    const key = `${atom.chainname}:${atom.resno}:${atom.resname}:${atom.hetero}`;
    let residue = residueByKey.get(key);
    if (!residue) {
      residue = {
        chainname: atom.chainname,
        resno: atom.resno,
        resname: atom.resname,
        hetero: atom.hetero,
        sstruc: "",
        atomIndices: [],
        isProtein() {
          return PROTEIN_RESNAMES.has(this.resname);
        },
        isWater() {
          return WATER_RESNAMES.has(this.resname);
        },
        isPolymer() {
          return this.isProtein() && !this.isWater();
        },
        eachAtom(fn) {
          this.atomIndices.forEach((idx) => fn(atoms[idx]));
        },
      };
      residueByKey.set(key, residue);
      residues.push(residue);
    }

    const index = atoms.length;
    const atomRecord = {
      index,
      x: atom.x,
      y: atom.y,
      z: atom.z,
      atomname: atom.atomname,
      chainname: atom.chainname,
      resno: atom.resno,
      resname: atom.resname,
      residue,
    };
    atoms.push(atomRecord);
    residue.atomIndices.push(index);
  }

  return {
    extraData: {},
    eachResidue(fn) {
      residues.forEach(fn);
    },
    getAtomSetWithinSelection(selection, cutoff) {
      const selected =
        selection instanceof Set
          ? selection
          : new Set(Array.isArray(selection) ? selection : []);
      if (selected.size === 0) {
        return new Set();
      }
      const cutoffSq = cutoff * cutoff;
      const selectedAtoms = Array.from(selected)
        .map((idx) => atoms[idx])
        .filter(Boolean);
      const near = new Set();
      for (const atom of atoms) {
        for (const center of selectedAtoms) {
          const dx = atom.x - center.x;
          const dy = atom.y - center.y;
          const dz = atom.z - center.z;
          if (dx * dx + dy * dy + dz * dz <= cutoffSq) {
            near.add(atom.index);
            break;
          }
        }
      }
      return near;
    },
    getAtomSetWithinGroup(atomSet) {
      const expanded = new Set();
      atomSet.forEach((atomIdx) => {
        const atom = atoms[atomIdx];
        if (!atom || !atom.residue) return;
        atom.residue.atomIndices.forEach((idx) => expanded.add(idx));
      });
      return expanded;
    },
    getAtomProxy(atomIndex) {
      return atoms[atomIndex] || null;
    },
  };
};

export function parseQueryStructure(input) {
  if (!input || typeof input !== "string") {
    return null;
  }
  const trimmed = input.trimStart();
  if (!trimmed) {
    return null;
  }
  const parsedAtoms =
    trimmed[0] === "#" || trimmed.startsWith("data_")
      ? parseCifAtoms(input)
      : parsePdbAtoms(input);
  if (parsedAtoms.length === 0) {
    return null;
  }
  return createQueryStructure(parsedAtoms);
}
