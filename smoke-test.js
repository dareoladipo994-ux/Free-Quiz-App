const http = require('http');

function request(path, method='GET', data=null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3000, path, method, headers: {} };
    if (data) { const s = JSON.stringify(data); opts.headers['Content-Type']='application/json'; opts.headers['Content-Length']=Buffer.byteLength(s); }
    const req = http.request(opts, res => {
      let b=''; res.on('data', c => b+=c); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

(async ()=>{
  try {
    console.log('Checking /api/quizzes');
    const q = await request('/api/quizzes');
    console.log('/api/quizzes', q.status);
    console.log('Done. If server is not running, start it with `npm start`');
  } catch (e) {
    console.error('Smoke test failed', e.message);
    process.exitCode = 2;
  }
})();
