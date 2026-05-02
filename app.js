/* app.js */
  try {
    let text = "";
    if (aiProvider === 'gemini') {
      text = await callGemini(prompt);
    } else {
      text = await callHF(prompt);
    }


    loading.classList.add('hidden');
    aiResponseContainer.classList.remove('hidden');
    animateText(text, aiAnswer);


  } catch (error) {
    console.error('Generation error:', error);
    loading.classList.add('hidden');
    aiAnswer.innerHTML = `<p style="color: #ef4444; font-weight: 600;">⚠️ ${error.message}</p>
                          <p style="font-size: 0.85rem; margin-top: 10px;">Tip: Check if your API key is correct or try another provider in settings.</p>`;
    aiResponseContainer.classList.remove('hidden');
  }
}


async function callGemini(prompt) {
  const currentKey = localStorage.getItem('gemini_key') || geminiKey;
  if (!currentKey) throw new Error("Gemini API Key is missing.");
  
  // Use exact configuration from user's working curl
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`;
  
  try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': currentKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Gemini API Error (429): You exceeded your current quota. Please wait a moment before trying again.");
      }
          const msg = data.error ? data.error.message : 'Unknown API Error';
          throw new Error(`Gemini API Error (${response.status}): ${msg}`);
      }
      
      if (!data.candidates || data.candidates.length === 0) {
          throw new Error("Gemini returned no answer. Try rephrasing your question.");
      }
      
      return data.candidates[0].content.parts[0].text;
  } catch (e) {
      if (e.message.includes('Failed to fetch')) {
          throw new Error("Network error: Could not reach Google AI services.");
      }
      throw e;
  }
}


async function callHF(prompt) {
  const headers = { 'Content-Type': 'application/json' };
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;


  const response = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      inputs: prompt,
      parameters: { max_new_tokens: 500, temperature: 0.1, return_full_text: false }
    })
  });


  const data = await response.json();
  if (!response.ok) throw new Error(`HF API Error: ${data.error || 'Unknown'}`);
  return Array.isArray(data) ? data[0].generated_text : data.generated_text;
}
