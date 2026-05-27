fetch('http://localhost:3000/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{role: 'user', content: 'What is the highest mountain in the world?'}],
    mode: 'deep-research',
    modelName: 'gemini-1.5-flash',
    networkMode: 'online'
  })
}).then(res => res.json()).then(console.log).catch(console.error);
