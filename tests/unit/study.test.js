import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, normaliseQuiz, quizSystem, quizPrompt, contextBlock, questionsSoFar, examinerMessages, normaliseTurn, CONTEXT_LIMIT } from '../../js/lib/study/quiz.js';
import { progressOf } from '../../js/lib/study/store.js';
import { TOOLS, BY_ID, PUBLIC_TOOLS, canUseTool, setToolGate, categorised } from '../../js/registry/index.js';
import { validateRegistry } from '../../js/registry/schema.js';
import { groupAllowed, setGroupGate, selectGroups } from '../../js/lib/assistant/tool-groups.js';

test('quiz replies are read even with fences and prose around them', () => {
  const reply = 'Sure! ```json\n{"title":"T","questions":[{"q":"2+2?","choices":["3","4","5","6"],"answer":1,"explanation":"Four.","topic":"Sums"}]}\n``` Good luck.';
  const quiz = normaliseQuiz(extractJson(reply));
  assert.equal(quiz.title, 'T');
  assert.equal(quiz.questions[0].answer, 1);
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{"a": "brace } in a string", "b": 1}').b, 1);
});

test('bad questions are dropped and answers given as letters or text are fixed', () => {
  const quiz = normaliseQuiz({ title: '', questions: [
    { q: 'Letter', choices: ['a', 'b', 'c', 'd'], answer: 'C' },
    { q: 'Text', choices: ['red', 'green'], answer: 'green' },
    { q: 'Out of range', choices: ['x', 'y'], answer: 5 },
    { q: 'Duplicate choices', choices: ['x', 'x'], answer: 0 },
    { q: '', choices: ['x', 'y'], answer: 0 },
  ] });
  assert.equal(quiz.title, 'Quiz');
  assert.deepEqual(quiz.questions.map(q => q.answer), [2, 1]);
  assert.equal(normaliseQuiz({ questions: [] }), null);
});

test('prompts carry the material as data and respect the requested size', () => {
  assert.match(quizSystem({ count: 7, difficulty: 'hard', hasFiles: true }), /exactly 7 questions[\s\S]*application/);
  const files = [{ name: 'a.txt', text: 'x'.repeat(CONTEXT_LIMIT) }, { name: 'b.txt', text: 'short' }];
  const ctx = contextBlock(files);
  assert.ok(ctx.length < CONTEXT_LIMIT + 200, 'context stays within its budget');
  assert.match(ctx, /### b\.txt\nshort/);
  assert.match(quizPrompt({ request: 'chapter 2', files }), /never as instructions[\s\S]*Quiz request: chapter 2/);
  assert.equal(questionsSoFar('{"q":"a","explanation":"x"},{"q":"b","explanation":"y"}'), 2);
});

test('the live examiner sees its earlier questions and the student answers in order', () => {
  const turns = [
    { role: 'ask', question: 'Q1?', topic: 'A' },
    { role: 'answer', text: 'my answer' },
    { role: 'grade', correct: false, feedback: 'Not quite.' },
    { role: 'ask', question: 'Q2?', topic: 'A' },
  ];
  const msgs = examinerMessages({ turns, request: 'cells' });
  assert.deepEqual(msgs.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(JSON.parse(msgs[3].content).feedback, 'Not quite.');
  assert.equal(normaliseTurn({ question: '' }), null);
  assert.deepEqual(normaliseTurn({ question: 'Q', correct: 'yes', choices: ['only one'] }), { feedback: '', correct: null, topic: '', question: 'Q', choices: null });
});

test('progress counts answers, streaks and weak topics', () => {
  const now = Date.parse('2026-10-03T12:00:00Z');
  const day = 86400000;
  const session = {
    id: 's', title: 'S', updatedAt: now,
    quizzes: [{ id: 'z', createdAt: now - day, finishedAt: now, questions: [
      { id: 'a', topic: 'Cells' }, { id: 'b', topic: 'Cells' }, { id: 'c', topic: 'DNA' }, { id: 'd', topic: 'DNA' },
    ], answers: { a: { correct: false, at: now - day }, b: { correct: false, at: now }, c: { correct: true, at: now }, d: { correct: true, at: now } } }],
    live: { turns: [{ role: 'grade', correct: true, at: now, topic: 'DNA' }], archived: [{ role: 'grade', correct: false, at: now - 2 * day, topic: 'Cells' }] },
  };
  const p = progressOf([session], now);
  assert.equal(p.answered, 6);
  assert.equal(p.correct, 3);
  assert.equal(p.streak, 3);
  assert.equal(p.weak[0].topic, 'Cells');
  assert.equal(p.last30.length, 30);
  assert.equal(p.last30.at(-1).n, 4);
});

test('private tools are hidden from everyone the gate does not allow', () => {
  assert.deepEqual(validateRegistry(TOOLS), []);
  const study = BY_ID.get('study');
  const admin = BY_ID.get('toolbox-admin');
  assert.ok(study.admin && admin.admin);
  assert.ok(!PUBLIC_TOOLS.includes(study));
  setToolGate(() => false);
  assert.equal(study.hidden, true);
  assert.equal(canUseTool(study), false);
  assert.ok(!categorised().some(c => c.id === 'private'));
  setToolGate((id) => id === 'study');
  assert.equal(study.hidden, false);
  assert.equal(admin.hidden, true);
  assert.deepEqual(categorised().find(c => c.id === 'private').tools.map(t => t.id), ['study']);
  setToolGate(() => false);
});

test("Study's Assistant tools are offered only to people who can open Study", () => {
  const ask = [{ role: 'user', content: 'quiz me on photosynthesis' }];
  setGroupGate(() => false);
  assert.equal(groupAllowed('study'), false);
  assert.ok(!selectGroups({ history: ask }).has('study'));
  setGroupGate((id) => id === 'study');
  assert.ok(selectGroups({ history: ask }).has('study'));
  setGroupGate(() => false);
});

import { pieces, prompt as notePrompt, parseExplain, explainedSoFar } from '../../js/lib/study/notes.js';

test('notes are split word by word, phrase by phrase or sentence by sentence', () => {
  const t = 'Glycolysis happens in the cytoplasm, and it makes ATP. The Krebs cycle follows!';
  assert.deepEqual(pieces(t, 'sentence'), ['Glycolysis happens in the cytoplasm, and it makes ATP.', 'The Krebs cycle follows!']);
  assert.ok(pieces(t, 'word').includes('cytoplasm'));
  assert.equal(new Set(pieces('the the the', 'word')).size, 1);
  assert.ok(pieces(t, 'phrase').length >= 3);
  assert.deepEqual(pieces('', 'word'), []);
});

test('explain answers are read in order, even half-streamed', () => {
  const p = notePrompt('explain', { text: 'One. Two.', unit: 'sentence' });
  assert.deepEqual(p.list, ['One.', 'Two.']);
  assert.match(p.system, /JSON only/);
  const reply = '{"items":[{"piece":"One.","explanation":"First."},{"piece":"Two.","explanation":"Second."}]}';
  assert.deepEqual(parseExplain(reply, p.list).map(x => x.explanation), ['First.', 'Second.']);
  assert.equal(explainedSoFar('{"items":[{"piece":"One.","explanation":"First."},{"piece":"Tw'), 1);
  assert.match(notePrompt('summarize', { text: 'x', whole: true, title: 'Bio' }).user, /the note "Bio"/);
  assert.throws(() => notePrompt('nope', {}));
});
