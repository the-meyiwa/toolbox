import test from 'node:test';
import assert from 'node:assert/strict';
import { distill, SUBJECT_RULES } from '../../js/lib/study/distill.js';
import { contextBlock, quizSystem, examinerSystem } from '../../js/lib/study/quiz.js';
import { prompt, noteBody } from '../../js/lib/study/notes.js';

const NOTE = `Babcock University 1 B.Sc Computer science. BU-CSC 325: Intro to Machine Learning.
Week 1 : Foundations of AI

Learning Objectives
By the end of this week, students will be able to:
- Define artificial intelligence
- Distinguish between narrow and general AI
- Explain the Turing test

What is AI?
Artificial intelligence is the study of systems that perceive their environment and take actions that maximise their chance of achieving goals.

Narrow vs general AI
Narrow AI is built for one task, such as recognising faces. General AI would match human ability across tasks.

The Turing test
Alan Turing proposed in 1950 that a machine is intelligent if a human judge cannot tell it from a person in conversation.

References
Russell & Norvig (2021). Artificial Intelligence: A Modern Approach.
Thank you`;

test('the school, course code, week and objectives are taken out; the subject stays', () => {
  const d = distill(NOTE);
  assert.equal(d.topic, 'Foundations of AI');
  assert.equal(d.course, 'Intro to Machine Learning');
  assert.match(d.text, /^# Foundations of AI/);
  for (const gone of [/Babcock/, /B\.Sc/, /BU-CSC/, /Week 1/, /Learning Objectives/, /By the end of this week/, /Define artificial intelligence/, /Russell/, /Thank you/]) assert.doesNotMatch(d.text, gone);
  for (const kept of [/What is AI\?/, /Narrow AI is built for one task/, /Alan Turing proposed in 1950/]) assert.match(d.text, kept);
  assert.match(d.brief, /Foundations of AI/);
});

test('objective lists without bullets, and agendas, go too', () => {
  const d = distill('Lecture 3: Memory\n\nObjectives\nUnderstand the stack\nUnderstand the heap\n\nThe stack stores local variables in frames that are pushed and popped as functions are called and return.\n\nAgenda\nStack\nHeap\n\nThe heap holds objects whose lifetime is not tied to a single function call.');
  assert.equal(d.topic, 'Memory');
  assert.doesNotMatch(d.text, /Understand the (stack|heap)/);
  assert.doesNotMatch(d.text, /^Agenda/m);
  assert.match(d.text, /stack stores local variables/);
  assert.match(d.text, /heap holds objects/);
});

test('page and slide notes lose running headers, footers and page numbers', () => {
  const pages = ['[Page 1]\nBabcock University\nDepartment of Computer Science\nBU-CSC 325 Intro to Machine Learning\nLecture 2: Supervised learning\nStudent Learning Objectives\nDefine supervised learning\nDescribe overfitting\nSupervised learning learns a mapping from inputs to labels using examples.\nBU-CSC 325 | Babcock University\n1'];
  const bodies = ['The loss function measures prediction error.', 'Gradient descent steps against the gradient to reduce loss.', 'The learning rate controls how large each step is.', 'Mini-batches trade noise for speed during training.', 'An epoch is one full pass over the training set.'];
  bodies.forEach((b, i) => pages.push(`[Page ${i + 2}]\nPart ${i + 2}\n${b}\nBU-CSC 325 | Babcock University\n${i + 2}`));
  const d = distill(pages.join('\n\n'));
  assert.equal(d.topic, 'Supervised learning');
  assert.doesNotMatch(d.text, /Babcock/);
  assert.doesNotMatch(d.text, /Define supervised learning/);
  assert.doesNotMatch(d.text, /^\d+$/m);
  for (const b of bodies) assert.ok(d.text.includes(b), b);
});

test('a note with no paperwork comes back unchanged, and nothing real is lost to a lookalike', () => {
  const plain = 'Photosynthesis converts light energy into chemical energy.\nIt happens in chloroplasts.\n\nThe light reactions make ATP and NADPH.';
  assert.equal(distill(plain).text, plain);
  assert.equal(distill('').text, '');
  const content = 'HTTP 404 means the server cannot find the requested resource.\nA 500 error means the server failed while handling the request.';
  assert.equal(distill(content).text, content, 'a status code is not a course code');
  // If almost everything would go, the note was not what this assumed: it is kept whole.
  const odd = `Objectives\n${Array.from({ length: 120 }, (_, i) => `- item ${i} of the list`).join('\n')}`;
  assert.equal(distill(odd).text, odd);
});

test('quizzes and the examiner are told what the subject is and what to ignore', () => {
  const ctx = contextBlock([{ name: 'week1.pdf', text: NOTE }]);
  assert.match(ctx, /Subject of this note: Foundations of AI/);
  assert.doesNotMatch(ctx, /Babcock University|Learning Objectives/);
  assert.match(quizSystem({ count: 8, hasFiles: true }), /Ignore the paperwork/);
  assert.match(examinerSystem({ hasFiles: true }), /learning objectives/i);
  assert.ok(SUBJECT_RULES.includes('SUBJECT MATTER'));
});

test('"Teach me" asks for core points, taught and expanded, from the cleaned note', () => {
  const p = prompt('teach', { text: NOTE, whole: true, title: 'week1.pdf' });
  assert.match(p.system, /UNDERSTAND the subject, not to describe the note/);
  assert.match(p.system, /core points/);
  assert.match(p.system, /beyond your note/);
  assert.match(p.system, /Check yourself/);
  assert.match(p.user, /Subject of this note: Foundations of AI/);
  assert.doesNotMatch(p.user, /Babcock|Learning Objectives|BU-CSC/);
  assert.match(p.user, /Turing proposed in 1950/);
  // A selected passage is taught as written.
  assert.match(prompt('teach', { text: 'Gradient descent lowers the loss.' }).user, /Gradient descent lowers the loss/);
  assert.equal(noteBody(NOTE).brief.includes('Foundations'), true);
  // Summaries of a whole note use the cleaned text too.
  assert.doesNotMatch(prompt('summarize', { text: NOTE, whole: true, title: 'n' }).user, /Babcock/);
});
