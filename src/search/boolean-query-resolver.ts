type Operator = 'AND' | 'OR' | 'NOT';
const operators = ['AND', 'OR', 'NOT'] satisfies string[];

export type Expression = {
  operator: Operator;
  operands: Array<string | Expression>;
};

export const BOOLEAN_LEXEME_REGEX = /\s*(\(|\)|[\p{L}\p{N}_]+)\s*/gu;

function isOperator (value?: string): value is Operator {
  return value !== undefined && operators.includes(value);
}

function precedence (operator: Operator): number {
  const precedences = {
    NOT: 3,
    AND: 2,
    OR: 1,
  } satisfies Record<Operator, number>;

  return precedences[operator];
}

function isRightAssociative (op: Operator): boolean {
  return op === 'NOT';
}

function toPostfix (lexemes: string[]): string[] {
  const output: string[] = [];
  const operators: string[] = [];

  let expectOperand = true;

  for (const part of lexemes) {
    if (part === '(') {
      operators.push(part);
      expectOperand = true;
      continue;
    }

    if (part === ')') {
      if (!operators.length) {
        throw new Error('Mismatched parentheses: missing \'(\'');
      }

      if (expectOperand) {
        throw new Error('Expression ends unexpectedly (missing operand)');
      }

      while (operators.length > 0 && operators.at(-1) !== '(') {
        output.push(operators.pop()!);
      }

      if (!operators.length) {
        throw new Error('Mismatched parentheses: missing \'(\'');
      }

      operators.pop();
      expectOperand = false;
      continue;
    }

    if (isOperator(part)) {
      if (part === 'NOT') {
        if (!expectOperand) {
          throw new Error('NOT must appear where an operand is expected');
        }
      } else {
        if (expectOperand) {
          throw new Error(`${part} cannot appear here (missing left operand)`);
        }
        expectOperand = true;
      }


      let top;

      while (isOperator(top = operators.at(-1))) {
        const pTop = precedence(top);
        const pCur = precedence(part);

        const shouldPop =
          pTop > pCur || (pTop === pCur && !isRightAssociative(part));

        if (!shouldPop) {
          break;
        }
        output.push(operators.pop()!);
      }

      operators.push(part);
      continue;
    }

    output.push(part);
    expectOperand = false;
  }

  if (expectOperand) {
    throw new Error('Expression ends unexpectedly (missing operand)');
  }

  while (operators.length) {
    const top = operators.pop()!;
    if (top === '(') {
      throw new Error('Mismatched parentheses: missing \')\'');
    }
    output.push(top);
  }

  return output;
}

function isExpression (x: string | Expression): x is Expression {
  return typeof x !== 'string';
}

function flattenInto (operator: Operator, child: string | Expression, acc: Array<string | Expression>) {
  if (isExpression(child) && child.operator === operator && operator !== 'NOT') {
    acc.push(...child.operands);
  } else {
    acc.push(child);
  }
}

function buildExpressionFromPostfix (postfix: string[]): Expression {
  const stack: Array<string | Expression> = [];

  for (const part of postfix) {
    if (!isOperator(part)) {
      stack.push(part);
      continue;
    }

    if (part === 'NOT') {
      const operand = stack.pop();
      if (!operand) {
        throw new Error('NOT missing operand');
      }

      stack.push({ operator: 'NOT', operands: [operand] });
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();
    if (!left || !right) {
      throw new Error(`${part} missing operand(s)`);
    }

    const operands: Array<string | Expression> = [];
    flattenInto(part, left, operands);
    flattenInto(part, right, operands);

    stack.push({ operator: part, operands });
  }

  if (stack.length !== 1) {
    throw new Error('Invalid expression (did not reduce to one root)');
  }

  const root = stack[0];

  if (typeof root === 'string') {
    return { operator: 'AND', operands: [root] };
  }

  return root;
}

export function resolveBooleanQuery (tokens: string[]): Expression {
  const postfix = toPostfix(tokens);
  return buildExpressionFromPostfix(postfix);
}
