import { prisma } from './prisma.js';
import { defaultQuestions } from '../data/defaultQuestions.js';

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeQuestion(question) {
  const choices = Array.isArray(question.choices) ? question.choices : JSON.parse(question.choices);

  return {
    id: question.id,
    topic: question.topic,
    text: question.text,
    choices,
    answerIdx: question.answerIdx,
    difficulty: question.difficulty || 1,
  };
}

function fallbackQuestions(topic, count) {
  const pool = defaultQuestions
    .map((question, index) => ({ ...question, id: `default-${index + 1}` }))
    .filter((question) => !topic || question.topic === topic);

  return shuffle(pool).slice(0, count).map(normalizeQuestion);
}

async function getQuestionsForMatch({ topic, count }) {
  try {
    const where = topic ? { topic } : undefined;
    const questions = await prisma.question.findMany({ where });
    const normalized = shuffle(questions.map(normalizeQuestion)).slice(0, count);

    if (normalized.length >= count) return normalized;
  } catch (err) {
    console.warn('Question DB unavailable, using default in-memory questions:', err.message);
  }

  const fallback = fallbackQuestions(topic, count);
  if (fallback.length < count) {
    throw new Error(`Not enough questions for topic ${topic || 'any'}`);
  }
  return fallback;
}

async function snapshotMatchQuestions(matchId, questions) {
  const rows = questions.map((question, index) => ({
    matchId,
    questionId: question.id,
    index,
    snapshot: {
      topic: question.topic,
      text: question.text,
      choices: question.choices,
    },
  }));

  try {
    await prisma.$transaction(
      rows.map((row) => prisma.matchQuestion.create({ data: row })),
    );
  } catch (err) {
    console.warn('Could not persist match question snapshots:', err.message);
  }
}

async function seedDefaultQuestions() {
  const results = [];

  for (const question of defaultQuestions) {
    const existing = await prisma.question.findFirst({
      where: { topic: question.topic, text: question.text },
    });

    if (existing) {
      results.push(existing);
      continue;
    }

    results.push(await prisma.question.create({ data: question }));
  }

  return results;
}

export {
  getQuestionsForMatch,
  snapshotMatchQuestions,
  seedDefaultQuestions,
};
