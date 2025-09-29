const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const db = new Database(path.join(__dirname, 'data.db'));

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
function initDb() {
  db.prepare(`CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    choices TEXT NOT NULL, -- JSON array
    answer_index INTEGER NOT NULL,
    FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  // Seed a sample quiz if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM quizzes').get().c;
  if (count === 0) {
    const insertQuiz = db.prepare('INSERT INTO quizzes (title, description) VALUES (?,?)');
    const info = insertQuiz.run('Sample: JS Basics', 'A tiny quiz about JavaScript basics');
    const quizId = info.lastInsertRowid;
    const insertQ = db.prepare('INSERT INTO questions (quiz_id, text, choices, answer_index) VALUES (?,?,?,?)');
    insertQ.run(quizId, 'What is the type of null in JavaScript?', JSON.stringify(['object','null','undefined','number']), 0);
    insertQ.run(quizId, 'Which keyword declares a constant?', JSON.stringify(['let','const','var','static']), 1);
  }
}

initDb();

// API endpoints
app.get('/api/quizzes', (req, res) => {
  const rows = db.prepare('SELECT id, title, description FROM quizzes ORDER BY id DESC').all();
  res.json(rows);
});

app.get('/api/quizzes/:id', (req, res) => {
  const quizId = Number(req.params.id);
  const quiz = db.prepare('SELECT id, title, description FROM quizzes WHERE id = ?').get(quizId);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
  const questions = db.prepare('SELECT id, text, choices FROM questions WHERE quiz_id = ?').all(quizId)
    .map(q => ({ id: q.id, text: q.text, choices: JSON.parse(q.choices) }));
  res.json({ ...quiz, questions });
});

app.post('/api/quizzes', (req, res) => {
  const { title, description, questions } = req.body;
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Invalid quiz payload' });
  }
  const insertQuiz = db.prepare('INSERT INTO quizzes (title, description) VALUES (?,?)');
  const info = insertQuiz.run(title, description || '');
  const quizId = info.lastInsertRowid;
  const insertQ = db.prepare('INSERT INTO questions (quiz_id, text, choices, answer_index) VALUES (?,?,?,?)');
  const insertMany = db.transaction((qs) => {
    for (const q of qs) {
      insertQ.run(quizId, q.text, JSON.stringify(q.choices), q.answer_index);
    }
  });
  insertMany(questions);
  res.json({ id: quizId });
});

app.post('/api/quizzes/:id/attempts', (req, res) => {
  const quizId = Number(req.params.id);
  const answers = req.body.answers; // { questionId: selectedIndex }
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Invalid answers' });
  const questions = db.prepare('SELECT id, answer_index FROM questions WHERE quiz_id = ?').all(quizId);
  if (!questions || questions.length === 0) return res.status(400).json({ error: 'No questions' });
  let score = 0;
  for (const q of questions) {
    const sel = answers[q.id];
    if (typeof sel === 'number' && sel === q.answer_index) score++;
  }
  const total = questions.length;
  db.prepare('INSERT INTO attempts (quiz_id, score, total) VALUES (?,?,?)').run(quizId, score, total);
  res.json({ score, total });
});

app.get('/api/quizzes/:id/attempts', (req, res) => {
  const quizId = Number(req.params.id);
  const rows = db.prepare('SELECT id, score, total, created_at FROM attempts WHERE quiz_id = ? ORDER BY created_at DESC LIMIT 20').all(quizId);
  res.json(rows);
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
