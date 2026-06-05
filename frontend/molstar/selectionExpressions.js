import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';

export function chainExpression(chain) {
    const test = chainTest(chain);
    return test ? MS.struct.generator.atomGroups({ 'chain-test': test }) : null;
}

export function residueExpression(chain, residue) {
    const tests = {
        'residue-test': residueEqTest(residue),
    };
    const chainExpr = chainTest(chain);
    if (chainExpr) tests['chain-test'] = chainExpr;
    return MS.struct.generator.atomGroups(tests);
}

export function residueRangeExpression(chain, start, end) {
    const tests = {};
    const chainExpr = chainTest(chain);
    if (chainExpr) tests['chain-test'] = chainExpr;
    if (Number.isFinite(start) || Number.isFinite(end)) {
        const { or } = MS.core.logic;
        const { macromolecular } = MS.struct.atomProperty;
        tests['residue-test'] = or([
            residueRangeTest(macromolecular.auth_seq_id(), start, end),
            residueRangeTest(macromolecular.label_seq_id(), start, end),
        ]);
    }
    return MS.struct.generator.atomGroups(tests);
}

export function mergeExpressions(expressions) {
    const valid = expressions.filter(Boolean);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return MS.struct.combinator.merge(valid.map(expression => MS.struct.modifier.union([expression])));
}

export function residueRangeTest(property, start, end) {
    const { and } = MS.core.logic;
    const { gre, lte } = MS.core.rel;
    const tests = [];
    if (Number.isFinite(start)) tests.push(gre([property, start]));
    if (Number.isFinite(end)) tests.push(lte([property, end]));
    return tests.length === 1 ? tests[0] : and(tests);
}

function chainTest(chain) {
    if (!chain) return null;
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return or([
        eq([macromolecular.auth_asym_id(), chain]),
        eq([macromolecular.label_asym_id(), chain]),
    ]);
}

function residueEqTest(residue) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return or([
        eq([macromolecular.auth_seq_id(), residue]),
        eq([macromolecular.label_seq_id(), residue]),
    ]);
}
