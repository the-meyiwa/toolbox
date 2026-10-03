/* ============================================================
   Study ↔ Assistant

   The Assistant can make a quiz inside Study and read the open
   session (files, quizzes, the question on screen). These tools are
   offered to the model only for people who can open Study, a
   private tool (js/lib/ai-provider.js filters them per turn).

   The open Study instance registers itself in `studyBridge`; with
   Study closed, a quiz goes into a new session and Study opens on it.
   ============================================================ */

import { normaliseQuiz } from './quiz.js';
import { BY_ID, canUseTool } from '../../registry/index.js';

export const studyBridge = { active: null };
export const OPEN_SESSION_KEY = 'toolbox_study_open_session';

export const STUDY_TOOL_DECLARATIONS = [
  {
    name: 'study_create_quiz',
    description: 'Make a multiple-choice quiz in Study (the person\'s private study tool) and show it to them, animated into view. Use when they ask to be quizzed or tested, or for practice questions, while studying. Write the questions yourself: from the open Study session\'s files (read them with study_session_info first), the conversation, or accurate knowledge. 4 choices each, exactly one right.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short quiz title.' },
        questions: {
          type: 'array',
          description: 'The questions, in order.',
          items: {
            type: 'object',
            properties: {
              q: { type: 'string', description: 'The question.' },
              choices: { type: 'array', items: { type: 'string' }, description: 'Four answer choices.' },
              answer: { type: 'integer', description: 'Index (0-3) of the correct choice.' },
              explanation: { type: 'string', description: 'One or two sentences on why the answer is right.' },
              topic: { type: 'string', description: '2-4 word label for the concept tested.' },
            },
            required: ['q', 'choices', 'answer'],
          },
        },
      },
      required: ['questions'],
    },
  },
  {
    name: 'study_session_info',
    description: 'Read the Study session the person has open: its title, context files (names and text), quizzes with scores and missed questions, and the question currently on screen.',
    parameters: {
      type: 'object',
      properties: { include_text: { type: 'boolean', description: 'Include the context files\' text (default true).' } },
    },
  },
];
export const STUDY_TOOL_NAMES = new Set(STUDY_TOOL_DECLARATIONS.map(d => d.name));

export async function executeStudyTool(name, args = {}) {
  // Study is private: these do nothing for anyone who cannot open it.
  if (!canUseTool(BY_ID.get('study'))) return { status: 'error', message: 'That tool is not available.' };
  if (name === 'study_session_info') {
    const s = studyBridge.active;
    if (!s) return { status: 'success', open: false, message: 'Study is not open. The person can open it from Tools → Private.' };
    return { status: 'success', open: true, ...(await s.describe({ includeText: args.include_text !== false })) };
  }
  if (name === 'study_create_quiz') {
    const quiz = normaliseQuiz({ title: args.title, questions: args.questions });
    if (!quiz) return { status: 'error', message: 'No usable questions: each needs q, at least 2 distinct choices and a valid answer index.' };
    if (studyBridge.active) {
      await studyBridge.active.addQuiz(quiz, { from: 'assistant' });
      return { status: 'success', shown: true, title: quiz.title, questions: quiz.questions.length, message: `The quiz "${quiz.title}" (${quiz.questions.length} questions) is now on screen in Study. Do not repeat the questions in your reply; say it is ready.` };
    }
    const { createStudyStore } = await import('./store.js');
    const { getCurrentUser } = await import('../supabase.js');
    const store = createStudyStore(getCurrentUser()?.id || 'local');
    const session = store.blank(quiz.title);
    const now = Date.now();
    session.quizzes.push({ id: store.uid('qz'), title: quiz.title, createdAt: now, prompt: 'Made by the Assistant', questions: quiz.questions.map((q, i) => ({ ...q, id: `q${now.toString(36)}${i}` })), answers: {}, finishedAt: null });
    await store.save(session);
    try { sessionStorage.setItem(OPEN_SESSION_KEY, session.id); } catch { /* ignore */ }
    window.location.hash = '#study';
    return { status: 'success', shown: true, title: quiz.title, questions: quiz.questions.length, message: `Opened Study with the quiz "${quiz.title}". Do not repeat the questions; say it is ready.` };
  }
  return undefined;
}
