import { prisma } from '../services/prisma.js';
import { seedDefaultQuestions } from '../services/questionService.js';
import { defaultQuestions } from '../data/defaultQuestions.js';

async function listQuestions(req, res) {
  try {
    const where = req.query.topic ? { topic: req.query.topic } : undefined;
    const questions = await prisma.question.findMany({
      where,
      orderBy: [{ topic: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return res.json({ source: 'db', questions });
  } catch (err) {
    return res.json({ source: 'default', questions: defaultQuestions });
  }
}

async function seedQuestions(_req, res) {
  try {
    const questions = await seedDefaultQuestions();
    return res.status(201).json({ count: questions.length, questions });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export {
  listQuestions,
  seedQuestions,
};
