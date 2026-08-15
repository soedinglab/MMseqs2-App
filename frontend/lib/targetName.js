// Reading an accession and a chain out of a target name. Extracted from Utilities.js

export const getChainName = (name) => {
  if (/_v[0-9]+$/.test(name) || /^AF-\W+-/.test(name)) {
    return "A";
  }
  
  if (name.includes(' ')) {
    name = name.split(' ')[0]
  }

  let pos = name.lastIndexOf("_");
  if (pos != -1) {
    let match = name.substring(pos + 1);
    return match.length >= 1 && isNaN(Number(match[0])) ? match[0] : "A";
  }
  // fallback
  return "A";
};

export const getAccession = (name) => {
  if (/-_-_-_/.test(name)) {
    name = name.split("-_-_-_")[0];
  }
  
  if (name.includes(' ')) {
    name = name.split(' ')[0]
  }

  if (/^AF-\w+-/.test(name)) {
    name = name.split("-")[1];
  }

  // name = name.replaceAll(/-assembly[0-9]/g, "");
  name = name.replaceAll(/\.(cif|pdb|gz)/g, "");

  if (/_v[0-9]+$/.test(name)) {
    return name;
  }

  if (/_unrelaxed_rank_/.test(name)) {
    let pos = name.indexOf("_unrelaxed_rank_");
    return pos != -1 ? name.substring(0, pos) : name;
  }

  let pos = name.lastIndexOf("_");
  return pos != -1 ? name.substring(0, pos) : name;
};
