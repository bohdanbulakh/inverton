import { DocumentInfoService } from '../document-info/document-info.interface';
import { Expression, resolveBooleanQuery } from '../boolean-query-resolver';

type DocId = string;
type Node = string | Expression;

function isExpression (x: Node): x is Expression {
  return typeof x !== 'string';
}

async function getTermDocs (
  term: string,
  docInfoService: DocumentInfoService,
  cache: Map<string, Set<DocId>>,
): Promise<Set<DocId>> {
  const cached = cache.get(term);
  if (cached) return cached;

  const ids = await docInfoService.getDocIdsForTerm(term);
  const set = new Set<DocId>(ids);
  cache.set(term, set);
  return set;
}

function collectTerms (expr: Expression): { positiveTerms: Set<string>; allTerms: Set<string> } {
  const positiveTerms = new Set<string>();
  const allTerms = new Set<string>();

  const stack: Array<{ node: Node; underNot: boolean }> = [{ node: expr, underNot: false }];

  while (stack.length) {
    const { node, underNot } = stack.pop()!;

    if (!isExpression(node)) {
      allTerms.add(node);
      if (!underNot) {
        positiveTerms.add(node);
      }
      continue;
    }

    const nextUnderNot = underNot || node.operator === 'NOT';

    for (let i = node.operands.length - 1; i >= 0; i--) {
      stack.push({ node: node.operands[i], underNot: nextUnderNot });
    }
  }

  return { positiveTerms, allTerms };
}

async function computeUniverse (
  expr: Expression,
  docInfoService: DocumentInfoService,
  termCache: Map<string, Set<DocId>>,
): Promise<Set<DocId>> {
  const { positiveTerms, allTerms } = collectTerms(expr);
  const seedTerms = positiveTerms.size > 0 ? positiveTerms : allTerms;

  let universe = new Set<DocId>();
  for (const term of seedTerms) {
    const ids = await getTermDocs(term, docInfoService, termCache);
    universe = universe.union(ids);
  }

  return universe;
}

async function evalExpression (
  root: Expression,
  docInfoService: DocumentInfoService,
  termCache: Map<string, Set<DocId>>,
  universe: Set<DocId>,
): Promise<Set<DocId>> {
  const exprResult = new Map<Expression, Set<DocId>>();
  const stack: Array<{ node: Node; visited: boolean }> = [{ node: root, visited: false }];

  while (stack.length) {
    const { node, visited } = stack.pop()!;

    if (!visited) {
      stack.push({ node, visited: true });

      if (isExpression(node)) {
        for (let i = node.operands.length - 1; i >= 0; i--) {
          stack.push({ node: node.operands[i], visited: false });
        }
      }
      continue;
    }

    if (!isExpression(node)) {
      await getTermDocs(node, docInfoService, termCache);
      continue;
    }

    const op = node.operator;

    if (op === 'NOT') {
      const child = node.operands[0];

      const childSet =
        typeof child === 'string'
          ? await getTermDocs(child, docInfoService, termCache)
          : exprResult.get(child);

      exprResult.set(node, childSet ? universe.difference(childSet) : new Set<DocId>());
      continue;
    }

    if (op === 'AND') {
      if (node.operands.length === 0) {
        exprResult.set(node, new Set<DocId>());
        continue;
      }

      const first = node.operands[0];
      let acc =
        typeof first === 'string'
          ? await getTermDocs(first, docInfoService, termCache)
          : exprResult.get(first);

      if (!acc) {
        exprResult.set(node, new Set<DocId>());
        continue;
      }

      for (let i = 1; i < node.operands.length; i++) {
        const child = node.operands[i];
        const next =
          typeof child === 'string'
            ? await getTermDocs(child, docInfoService, termCache)
            : exprResult.get(child);

        if (!next) {
          acc = new Set<DocId>();
          break;
        }

        acc = acc.intersection(next);
        if (acc.size === 0) break;
      }

      exprResult.set(node, acc);
      continue;
    }

    let out = new Set<DocId>();
    for (const child of node.operands) {
      const s =
        typeof child === 'string'
          ? await getTermDocs(child, docInfoService, termCache)
          : exprResult.get(child);

      if (s) out = out.union(s);
    }
    exprResult.set(node, out);
  }

  return exprResult.get(root) ?? new Set<DocId>();
}

export const searchBoolean = async (
  terms: string[],
  docInfoService: DocumentInfoService,
): Promise<Map<string, number>> => {
  const docScores = new Map<string, number>();
  if (terms.length === 0) return docScores;

  const expression = resolveBooleanQuery(terms);

  const termCache = new Map<string, Set<DocId>>();
  const universe = await computeUniverse(expression, docInfoService, termCache);

  const matching = await evalExpression(expression, docInfoService, termCache, universe);

  for (const id of matching) docScores.set(id, 1.0);
  return docScores;
};
