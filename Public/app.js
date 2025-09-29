const api = {
  getQuizzes: () => fetch('/api/quizzes').then(r => r.json()),
  getQuiz: (id) => fetch(`/api/quizzes/${id}`).then(r => r.json()),
  createQuiz: (payload) => fetch('/api/quizzes', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload)}).then(r => r.json()),
  submitAttempt: (id, answers) => fetch(`/api/quizzes/${id}/attempts`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ answers })}).then(r => r.json()),
  getAttempts: (id) => fetch(`/api/quizzes/${id}/attempts`).then(r => r.json()),
};

const appEl = document.getElementById('app');

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => { if (k === 'onclick') e.addEventListener('click', v); else e.setAttribute(k, v); });
  children.flat().forEach(c => { e.append(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}

function showHome() {
  appEl.innerHTML = '';
  const createBtn = el('button', { onclick: () => showCreateQuiz() }, 'Create new quiz');
  const list = el('div', { class: 'quiz-list' }, 'Loading...');
  appEl.append(createBtn, list);
  api.getQuizzes().then(quizzes => {
    list.innerHTML = '';
    if (quizzes.length === 0) list.append(el('p', {}, 'No quizzes yet.'));
    for (const q of quizzes) {
      const item = el('div', { class: 'quiz-item' },
        el('h3', {}, q.title),
        el('p', {}, q.description || ''),
        el('button', { onclick: () => showTakeQuiz(q.id) }, 'Take'),
        el('button', { onclick: () => showQuizDetails(q.id) }, 'Details')
      );
      list.append(item);
    }
  }).catch(err => { list.innerHTML = 'Failed to load quizzes'; console.error(err); });
}

function showCreateQuiz() {
  appEl.innerHTML = '';
  const form = el('form', {},
    el('label', {}, 'Title'), el('input', { name: 'title' }),
    el('label', {}, 'Description'), el('input', { name: 'description' }),
    el('div', { id: 'questions' }),
    el('button', { type: 'button', onclick: addQuestion }, 'Add question'),
    el('button', { type: 'submit' }, 'Save quiz'),
    el('button', { type: 'button', onclick: showHome }, 'Cancel')
  );

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = fd.get('title');
    const desc = fd.get('description');
    const qs = [];
    const qEls = form.querySelectorAll('.question');
    qEls.forEach(qEl => {
      const text = qEl.querySelector('[name="q-text"]').value;
      const choices = Array.from(qEl.querySelectorAll('[name^="choice-"]')).map(i => i.value).filter(Boolean);
      const ai = Number(qEl.querySelector('[name="answer-index"]').value || 0);
      qs.push({ text, choices, answer_index: ai });
    });
    api.createQuiz({ title, description: desc, questions: qs }).then(res => {
      showTakeQuiz(res.id);
    }).catch(err => alert('Failed to create quiz'));
  });

  appEl.append(el('h2', {}, 'Create Quiz'), form);
  addQuestion();
}

function addQuestion() {
  const questions = document.getElementById('questions');
  const idx = (questions.children.length || 0) + 1;
  const q = el('div', { class: 'question' },
    el('h4', {}, `Question ${idx}`),
    el('label', {}, 'Question text'), el('input', { name: 'q-text' }),
    el('label', {}, 'Choices (at least 2)'),
    el('input', { name: `choice-0` }),
    el('input', { name: `choice-1` }),
    el('input', { name: `choice-2` }),
    el('input', { name: `choice-3` }),
    el('label', {}, 'Answer index (0-based)'), el('input', { name: 'answer-index', value: '0' }),
  );
  questions.append(q);
}

function showTakeQuiz(id) {
  appEl.innerHTML = 'Loading...';
  api.getQuiz(id).then(quiz => {
    appEl.innerHTML = '';
    const qForm = el('form', {}, el('h2', {}, quiz.title), el('p', {}, quiz.description || ''));
    quiz.questions.forEach((q, i) => {
      const qEl = el('div', { class: 'q' }, el('p', {}, q.text));
      q.choices.forEach((c, ci) => {
        const input = el('input', { type: 'radio', name: `q-${q.id}`, value: ci });
        const label = el('label', {}, input, ' ', c);
        qEl.append(label);
      });
      qForm.append(qEl);
    });
    qForm.append(el('button', { type: 'submit' }, 'Submit'));
    qForm.append(el('button', { type: 'button', onclick: showHome }, 'Back'));
    qForm.addEventListener('submit', e => {
      e.preventDefault();
      const answers = {};
      quiz.questions.forEach(q => {
        const sel = qForm.querySelector(`input[name="q-${q.id}"]:checked`);
        if (sel) answers[q.id] = Number(sel.value);
      });
      api.submitAttempt(id, answers).then(res => showResult(res));
    });
    appEl.append(qForm);
  }).catch(err => { appEl.innerHTML = 'Failed to load quiz'; console.error(err); });
}

function showResult(res) {
  appEl.innerHTML = '';
  appEl.append(el('h2', {}, `Score: ${res.score} / ${res.total}`));
  appEl.append(el('button', { onclick: showHome }, 'Back to home'));
}

function showQuizDetails(id) {
  appEl.innerHTML = 'Loading...';
  Promise.all([api.getQuiz(id), api.getAttempts(id)]).then(([quiz, attempts]) => {
    appEl.innerHTML = '';
    appEl.append(el('h2', {}, quiz.title), el('p', {}, quiz.description || ''));
    appEl.append(el('h3', {}, 'Questions'));
    quiz.questions.forEach((q) => {
      const qEl = el('div', {}, el('p', {}, q.text));
      q.choices.forEach((c,i) => qEl.append(el('div', {}, `${i}: ${c}`)));
      appEl.append(qEl);
    });
    appEl.append(el('h3', {}, 'Recent attempts'));
    if (!attempts || attempts.length === 0) appEl.append(el('p', {}, 'No attempts yet'));
    attempts.forEach(a => appEl.append(el('div', {}, `${a.score}/${a.total} — ${new Date(a.created_at).toLocaleString()}`)));
    appEl.append(el('button', { onclick: () => showTakeQuiz(id) }, 'Retake'));
    appEl.append(el('button', { onclick: showHome }, 'Back'));
  }).catch(err => { appEl.innerHTML = 'Failed to load details'; console.error(err); });
}

// Initial
showHome();
