/* ============================================================
   Flowchart model and code generation.

   A flowchart here is a tree of statements, not a free-form graph of
   boxes and arrows. That is the same choice Flowgorithm makes, and it is
   what makes generating real code possible: a nested structure has an
   unambiguous translation into any block-structured language, whereas an
   arbitrary graph of jumps does not.

   Each generator is a small set of rules rather than string
   concatenation scattered through the UI, so adding a language means
   describing its syntax once.
   ============================================================ */

let seq = 0;
export const newId = () => `n${++seq}`;

/**
 * @typedef {'start'|'declare'|'assign'|'output'|'input'|'if'|'while'|'for'|'comment'|'call'} NodeKind
 */

export const NODE_TYPES = {
  declare: { label: 'Declare', shape: 'rect', fields: ['name', 'dataType'], hint: 'Create a variable' },
  assign:  { label: 'Assign',  shape: 'rect', fields: ['name', 'expr'], hint: 'Set a variable' },
  output:  { label: 'Output',  shape: 'parallelogram', fields: ['expr'], hint: 'Print something' },
  input:   { label: 'Input',   shape: 'parallelogram', fields: ['name'], hint: 'Read from the user' },
  if:      { label: 'If',      shape: 'diamond', fields: ['cond'], hint: 'Branch on a condition' },
  while:   { label: 'While',   shape: 'diamond', fields: ['cond'], hint: 'Repeat while true' },
  for:     { label: 'For',     shape: 'diamond', fields: ['name', 'from', 'to', 'step'], hint: 'Count through a range' },
  comment: { label: 'Comment', shape: 'note', fields: ['text'], hint: 'A note for the reader' },
};

export const DATA_TYPES = ['Integer', 'Real', 'String', 'Boolean'];

export const makeNode = (kind, props = {}) => ({
  id: newId(),
  kind,
  name: props.name ?? '',
  dataType: props.dataType ?? 'Integer',
  expr: props.expr ?? '',
  cond: props.cond ?? '',
  from: props.from ?? '1',
  to: props.to ?? '10',
  step: props.step ?? '1',
  text: props.text ?? '',
  // Branch bodies. `then`/`else` for if, `body` for loops.
  then: props.then ?? (kind === 'if' ? [] : undefined),
  else: props.else ?? (kind === 'if' ? [] : undefined),
  body: props.body ?? (kind === 'while' || kind === 'for' ? [] : undefined),
});

/* ---------------- expression translation ----------------
   Flowchart expressions are written in a neutral pseudocode; each
   language then gets the operators it actually uses. Doing this in one
   place stops every generator reinventing it. */

function translateExpr(expr, lang) {
  let e = String(expr ?? '').trim();
  if (!e) return lang.emptyExpr ?? '""';

  // Logical words to symbols, where the language wants symbols.
  const ops = lang.operators ?? {};
  e = e.replace(/\bAND\b/gi, ops.and ?? '&&')
       .replace(/\bOR\b/gi, ops.or ?? '||')
       .replace(/\bNOT\s+/gi, ops.not ?? '!')
       .replace(/\bTRUE\b/gi, ops.true ?? 'true')
       .replace(/\bFALSE\b/gi, ops.false ?? 'false');

  // A single "=" inside a condition is almost always meant as equality;
  // languages that use "==" would otherwise silently assign.
  if (ops.equality) e = e.replace(/([^=!<>])=([^=])/g, `$1${ops.equality}$2`);

  // String concatenation differs enough to be worth translating.
  if (ops.concat && ops.concat !== '+') e = e.replace(/\s\+\s/g, ` ${ops.concat} `);
  return e;
}

/* ---------------- languages ---------------- */

const indent = (depth, unit) => unit.repeat(depth);

export const LANGUAGES = {
  pseudocode: {
    name: 'Pseudocode',
    mono: 'text',
    unit: '   ',
    generate: (nodes, g) => g.walk(nodes, 0, {
      declare: (n, d) => `${indent(d, g.unit)}Declare ${n.dataType} ${n.name}`,
      assign:  (n, d) => `${indent(d, g.unit)}Set ${n.name} = ${n.expr}`,
      output:  (n, d) => `${indent(d, g.unit)}Output ${n.expr}`,
      input:   (n, d) => `${indent(d, g.unit)}Input ${n.name}`,
      comment: (n, d) => `${indent(d, g.unit)}// ${n.text}`,
      if:      (n, d, body) => [`${indent(d, g.unit)}If ${n.cond} Then`, ...body.then,
        ...(body.else.length ? [`${indent(d, g.unit)}Else`, ...body.else] : []), `${indent(d, g.unit)}End If`],
      while:   (n, d, body) => [`${indent(d, g.unit)}While ${n.cond}`, ...body.body, `${indent(d, g.unit)}End While`],
      for:     (n, d, body) => [`${indent(d, g.unit)}For ${n.name} = ${n.from} To ${n.to} Step ${n.step}`, ...body.body, `${indent(d, g.unit)}End For`],
    }),
    wrap: (lines) => ['Main', ...lines.map(l => l), 'End'].join('\n'),
  },

  javascript: {
    name: 'JavaScript',
    mono: 'js',
    unit: '  ',
    operators: { equality: '===' },
    generate: (nodes, g) => g.walk(nodes, 1, {
      declare: (n, d) => `${indent(d, g.unit)}let ${n.name}${defaultFor(n.dataType, 'js')};`,
      assign:  (n, d) => `${indent(d, g.unit)}${n.name} = ${g.expr(n.expr)};`,
      output:  (n, d) => `${indent(d, g.unit)}console.log(${g.expr(n.expr)});`,
      input:   (n, d) => `${indent(d, g.unit)}${n.name} = prompt(${JSON.stringify(`${n.name}?`)});`,
      comment: (n, d) => `${indent(d, g.unit)}// ${n.text}`,
      if:      (n, d, b) => [`${indent(d, g.unit)}if (${g.expr(n.cond)}) {`, ...b.then,
        ...(b.else.length ? [`${indent(d, g.unit)}} else {`, ...b.else] : []), `${indent(d, g.unit)}}`],
      while:   (n, d, b) => [`${indent(d, g.unit)}while (${g.expr(n.cond)}) {`, ...b.body, `${indent(d, g.unit)}}`],
      for:     (n, d, b) => [`${indent(d, g.unit)}for (let ${n.name} = ${n.from}; ${n.name} <= ${n.to}; ${n.name} += ${n.step}) {`, ...b.body, `${indent(d, g.unit)}}`],
    }),
    wrap: (lines) => ['function main() {', ...lines, '}', '', 'main();'].join('\n'),
  },

  python: {
    name: 'Python',
    mono: 'py',
    unit: '    ',
    operators: { and: 'and', or: 'or', not: 'not ', true: 'True', false: 'False', equality: '==' },
    generate: (nodes, g) => g.walk(nodes, 1, {
      declare: (n, d) => `${indent(d, g.unit)}${n.name}${defaultFor(n.dataType, 'py')}`,
      assign:  (n, d) => `${indent(d, g.unit)}${n.name} = ${g.expr(n.expr)}`,
      output:  (n, d) => `${indent(d, g.unit)}print(${g.expr(n.expr)})`,
      input:   (n, d) => `${indent(d, g.unit)}${n.name} = input(${JSON.stringify(`${n.name}? `)})`,
      comment: (n, d) => `${indent(d, g.unit)}# ${n.text}`,
      // Python has no braces, so an empty branch needs an explicit pass.
      if:      (n, d, b) => [`${indent(d, g.unit)}if ${g.expr(n.cond)}:`, ...pad(b.then, d + 1, g.unit),
        ...(b.else.length ? [`${indent(d, g.unit)}else:`, ...pad(b.else, d + 1, g.unit)] : [])],
      while:   (n, d, b) => [`${indent(d, g.unit)}while ${g.expr(n.cond)}:`, ...pad(b.body, d + 1, g.unit)],
      for:     (n, d, b) => [`${indent(d, g.unit)}for ${n.name} in range(${n.from}, ${Number(n.to) + 1 || `${n.to} + 1`}, ${n.step}):`, ...pad(b.body, d + 1, g.unit)],
    }),
    wrap: (lines) => ['def main():', ...(lines.length ? lines : ['    pass']), '', '', 'if __name__ == "__main__":', '    main()'].join('\n'),
  },

  c: {
    name: 'C',
    mono: 'c',
    unit: '    ',
    operators: { equality: '==' },
    generate: (nodes, g) => g.walk(nodes, 1, {
      declare: (n, d) => `${indent(d, g.unit)}${cType(n.dataType)} ${n.name}${cInit(n.dataType)};`,
      assign:  (n, d) => `${indent(d, g.unit)}${n.name} = ${g.expr(n.expr)};`,
      output:  (n, d) => `${indent(d, g.unit)}printf("%s\\n", ${g.expr(n.expr)});`,
      input:   (n, d) => `${indent(d, g.unit)}scanf("%d", &${n.name});`,
      comment: (n, d) => `${indent(d, g.unit)}/* ${n.text} */`,
      if:      (n, d, b) => [`${indent(d, g.unit)}if (${g.expr(n.cond)}) {`, ...b.then,
        ...(b.else.length ? [`${indent(d, g.unit)}} else {`, ...b.else] : []), `${indent(d, g.unit)}}`],
      while:   (n, d, b) => [`${indent(d, g.unit)}while (${g.expr(n.cond)}) {`, ...b.body, `${indent(d, g.unit)}}`],
      for:     (n, d, b) => [`${indent(d, g.unit)}for (int ${n.name} = ${n.from}; ${n.name} <= ${n.to}; ${n.name} += ${n.step}) {`, ...b.body, `${indent(d, g.unit)}}`],
    }),
    wrap: (lines) => ['#include <stdio.h>', '', 'int main(void) {', ...lines, '    return 0;', '}'].join('\n'),
  },

  java: {
    name: 'Java',
    mono: 'java',
    unit: '        ',
    operators: { equality: '==' },
    generate: (nodes, g) => g.walk(nodes, 0, {
      declare: (n, d) => `${indent(d + 2, '    ')}${javaType(n.dataType)} ${n.name}${javaInit(n.dataType)};`,
      assign:  (n, d) => `${indent(d + 2, '    ')}${n.name} = ${g.expr(n.expr)};`,
      output:  (n, d) => `${indent(d + 2, '    ')}System.out.println(${g.expr(n.expr)});`,
      input:   (n, d) => `${indent(d + 2, '    ')}${n.name} = scanner.nextLine();`,
      comment: (n, d) => `${indent(d + 2, '    ')}// ${n.text}`,
      if:      (n, d, b) => [`${indent(d + 2, '    ')}if (${g.expr(n.cond)}) {`, ...b.then,
        ...(b.else.length ? [`${indent(d + 2, '    ')}} else {`, ...b.else] : []), `${indent(d + 2, '    ')}}`],
      while:   (n, d, b) => [`${indent(d + 2, '    ')}while (${g.expr(n.cond)}) {`, ...b.body, `${indent(d + 2, '    ')}}`],
      for:     (n, d, b) => [`${indent(d + 2, '    ')}for (int ${n.name} = ${n.from}; ${n.name} <= ${n.to}; ${n.name} += ${n.step}) {`, ...b.body, `${indent(d + 2, '    ')}}`],
    }),
    wrap: (lines) => ['import java.util.Scanner;', '', 'public class Main {',
      '    public static void main(String[] args) {',
      '        Scanner scanner = new Scanner(System.in);', ...lines, '    }', '}'].join('\n'),
  },

  csharp: {
    name: 'C#',
    mono: 'csharp',
    unit: '        ',
    operators: { equality: '==' },
    generate: (nodes, g) => g.walk(nodes, 0, {
      declare: (n, d) => `${indent(d + 2, '    ')}${csType(n.dataType)} ${n.name}${csInit(n.dataType)};`,
      assign:  (n, d) => `${indent(d + 2, '    ')}${n.name} = ${g.expr(n.expr)};`,
      output:  (n, d) => `${indent(d + 2, '    ')}Console.WriteLine(${g.expr(n.expr)});`,
      input:   (n, d) => `${indent(d + 2, '    ')}${n.name} = Console.ReadLine();`,
      comment: (n, d) => `${indent(d + 2, '    ')}// ${n.text}`,
      if:      (n, d, b) => [`${indent(d + 2, '    ')}if (${g.expr(n.cond)}) {`, ...b.then,
        ...(b.else.length ? [`${indent(d + 2, '    ')}} else {`, ...b.else] : []), `${indent(d + 2, '    ')}}`],
      while:   (n, d, b) => [`${indent(d + 2, '    ')}while (${g.expr(n.cond)}) {`, ...b.body, `${indent(d + 2, '    ')}}`],
      for:     (n, d, b) => [`${indent(d + 2, '    ')}for (int ${n.name} = ${n.from}; ${n.name} <= ${n.to}; ${n.name} += ${n.step}) {`, ...b.body, `${indent(d + 2, '    ')}}`],
    }),
    wrap: (lines) => ['using System;', '', 'class Program {', '    static void Main() {', ...lines, '    }', '}'].join('\n'),
  },

  vb: {
    name: 'Visual Basic',
    mono: 'vb',
    unit: '    ',
    operators: { and: 'And', or: 'Or', not: 'Not ', true: 'True', false: 'False', concat: '&' },
    generate: (nodes, g) => g.walk(nodes, 1, {
      declare: (n, d) => `${indent(d, g.unit)}Dim ${n.name} As ${vbType(n.dataType)}`,
      assign:  (n, d) => `${indent(d, g.unit)}${n.name} = ${g.expr(n.expr)}`,
      output:  (n, d) => `${indent(d, g.unit)}Console.WriteLine(${g.expr(n.expr)})`,
      input:   (n, d) => `${indent(d, g.unit)}${n.name} = Console.ReadLine()`,
      comment: (n, d) => `${indent(d, g.unit)}' ${n.text}`,
      if:      (n, d, b) => [`${indent(d, g.unit)}If ${g.expr(n.cond)} Then`, ...b.then,
        ...(b.else.length ? [`${indent(d, g.unit)}Else`, ...b.else] : []), `${indent(d, g.unit)}End If`],
      while:   (n, d, b) => [`${indent(d, g.unit)}While ${g.expr(n.cond)}`, ...b.body, `${indent(d, g.unit)}End While`],
      for:     (n, d, b) => [`${indent(d, g.unit)}For ${n.name} = ${n.from} To ${n.to} Step ${n.step}`, ...b.body, `${indent(d, g.unit)}Next`],
    }),
    wrap: (lines) => ['Module Program', '    Sub Main()', ...lines, '    End Sub', 'End Module'].join('\n'),
  },
};

const pad = (lines, depth, unit) => (lines.length ? lines : [`${indent(depth, unit)}pass`]);

function defaultFor(type, lang) {
  if (lang === 'py') return type === 'String' ? ' = ""' : type === 'Boolean' ? ' = False' : type === 'Real' ? ' = 0.0' : ' = 0';
  return type === 'String' ? " = ''" : type === 'Boolean' ? ' = false' : ' = 0';
}
const cType = (t) => ({ Integer: 'int', Real: 'double', String: 'char*', Boolean: 'int' }[t] ?? 'int');
const cInit = (t) => (t === 'String' ? ' = ""' : ' = 0');
const javaType = (t) => ({ Integer: 'int', Real: 'double', String: 'String', Boolean: 'boolean' }[t] ?? 'int');
const javaInit = (t) => ({ Integer: ' = 0', Real: ' = 0.0', String: ' = ""', Boolean: ' = false' }[t] ?? ' = 0');
const csType = (t) => ({ Integer: 'int', Real: 'double', String: 'string', Boolean: 'bool' }[t] ?? 'int');
const csInit = (t) => ({ Integer: ' = 0', Real: ' = 0.0', String: ' = ""', Boolean: ' = false' }[t] ?? ' = 0');
const vbType = (t) => ({ Integer: 'Integer', Real: 'Double', String: 'String', Boolean: 'Boolean' }[t] ?? 'Integer');

/**
 * Turn a flowchart into source.
 * @param {Array} nodes
 * @param {string} langId
 */
export function generateCode(nodes, langId) {
  const lang = LANGUAGES[langId];
  if (!lang) throw new Error(`Unknown language: ${langId}`);

  const ctx = {
    unit: lang.unit,
    expr: (e) => translateExpr(e, lang),
    walk(list, depth, rules) {
      const out = [];
      for (const node of list ?? []) {
        const rule = rules[node.kind];
        if (!rule) continue;
        if (node.kind === 'if') {
          out.push(...rule(node, depth, {
            then: this.walk(node.then, depth + 1, rules),
            else: this.walk(node.else, depth + 1, rules),
          }));
        } else if (node.kind === 'while' || node.kind === 'for') {
          out.push(...rule(node, depth, { body: this.walk(node.body, depth + 1, rules) }));
        } else {
          out.push(rule(node, depth));
        }
      }
      return out;
    },
  };

  return lang.wrap(lang.generate(nodes, ctx));
}

/* ---------------- worked examples ---------------- */

export const EXAMPLES = {
  fizzbuzz: {
    name: 'FizzBuzz',
    about: 'Counting with two nested conditions — the shape most beginner exercises take.',
    build: () => [
      makeNode('declare', { name: 'i', dataType: 'Integer' }),
      makeNode('for', {
        name: 'i', from: '1', to: '20', step: '1',
        body: [
          makeNode('if', {
            cond: 'i % 15 = 0',
            then: [makeNode('output', { expr: '"FizzBuzz"' })],
            else: [
              makeNode('if', {
                cond: 'i % 3 = 0',
                then: [makeNode('output', { expr: '"Fizz"' })],
                else: [
                  makeNode('if', {
                    cond: 'i % 5 = 0',
                    then: [makeNode('output', { expr: '"Buzz"' })],
                    else: [makeNode('output', { expr: 'i' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  },

  average: {
    name: 'Average of numbers',
    about: 'Input, accumulation and a guard against dividing by zero.',
    build: () => [
      makeNode('declare', { name: 'count', dataType: 'Integer' }),
      makeNode('declare', { name: 'total', dataType: 'Real' }),
      makeNode('declare', { name: 'value', dataType: 'Real' }),
      makeNode('output', { expr: '"How many numbers?"' }),
      makeNode('input', { name: 'count' }),
      makeNode('assign', { name: 'total', expr: '0' }),
      makeNode('for', {
        name: 'i', from: '1', to: 'count', step: '1',
        body: [
          makeNode('input', { name: 'value' }),
          makeNode('assign', { name: 'total', expr: 'total + value' }),
        ],
      }),
      makeNode('if', {
        cond: 'count > 0',
        then: [makeNode('output', { expr: 'total / count' })],
        else: [makeNode('output', { expr: '"No numbers were entered."' })],
      }),
    ],
  },

  countdown: {
    name: 'Countdown',
    about: 'A while loop with a condition that eventually stops being true.',
    build: () => [
      makeNode('declare', { name: 'n', dataType: 'Integer' }),
      makeNode('assign', { name: 'n', expr: '10' }),
      makeNode('while', {
        cond: 'n > 0',
        body: [
          makeNode('output', { expr: 'n' }),
          makeNode('assign', { name: 'n', expr: 'n - 1' }),
        ],
      }),
      makeNode('output', { expr: '"Liftoff"' }),
    ],
  },

  blank: { name: 'Empty', about: 'Start from nothing.', build: () => [] },
};
