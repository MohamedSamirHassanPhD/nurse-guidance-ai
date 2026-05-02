/* app.js */

let fuse;
let knowledgeData = [];
const DEFAULT_GEMINI_KEY = 'AIzaSyCuVpv7k7252owZylpqKXWkTX3HKaBZ144';
let aiProvider = localStorage.getItem('ai_provider') || 'gemini';
let hfToken = localStorage.getItem('hf_token') || '';
let geminiKey = localStorage.getItem('gemini_key') || DEFAULT_GEMINI_KEY;

// Initialize data and search index
async function init() {
  try {
    const response = await fetch('data.json');
    knowledgeData = await response.json();
    
    const options = {
      keys: ['content'],
      threshold: 0.6,
      includeScore: true,
      minMatchCharLength: 2
    };
    
    fuse = new Fuse(knowledgeData, options);
    console.log('Knowledge base loaded:', knowledgeData.length, 'chunks');
    
    document.getElementById('ai-provider').value = aiProvider;
    document.getElementById('hf-token').value = hfToken;
    document.getElementById('gemini-key').value = geminiKey;
    updateProviderFields();
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

// UI Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const loading = document.getElementById('loading');
const aiResponseContainer = document.getElementById('ai-response-container');
const aiAnswer = document.getElementById('ai-answer');
const resultsList = document.getElementById('results');
const toggleSourcesBtn = document.getElementById('toggle-sources');
const themeToggle = document.getElementById('theme-toggle');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const providerSelect = document.getElementById('ai-provider');

function updateProviderFields() {
  const isGemini = providerSelect.value === 'gemini';
  document.getElementById('gemini-field').classList.toggle('hidden', !isGemini);
  document.getElementById('hf-field').classList.toggle('hidden', isGemini);
}

providerSelect.addEventListener('change', updateProviderFields);

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
});

settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
saveSettingsBtn.addEventListener('click', () => {
  aiProvider = providerSelect.value;
  hfToken = document.getElementById('hf-token').value.trim();
  geminiKey = document.getElementById('gemini-key').value.trim() || DEFAULT_GEMINI_KEY;
  
  localStorage.setItem('ai_provider', aiProvider);
  localStorage.setItem('hf_token', hfToken);
  localStorage.setItem('gemini_key', geminiKey);
  
  settingsModal.classList.add('hidden');
  window.location.reload();
});

async function handleSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  aiResponseContainer.classList.add('hidden');
  resultsList.classList.add('hidden');
  loading.classList.remove('hidden');
  resultsList.innerHTML = '';
  aiAnswer.innerHTML = '';

  let searchResults = fuse.search(query).slice(0, 6); 
  
  if (searchResults.length === 0) {
      const words = query.split(' ').filter(w => w.length > 3);
      if (words.length > 0) {
          searchResults = fuse.search(words[0]).slice(0, 6);
      }
  }

  if (searchResults.length === 0) {
    loading.classList.add('hidden');
    alert('No relevant information found in the guidelines. Try using keywords like "PPH" or "Management".');
    return;
  }

  searchResults.forEach(({ item }) => {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <span class="source-tag">${item.source}</span>
      <p>${item.content}</p>
    `;
    resultsList.appendChild(card);
  });

  const context = searchResults.map(r => r.item.content).join('\n\n');
  const prompt = `Use the clinical guidelines below to answer the question for a nurse. If unsure, say so.
  
  Guidelines:
  ${context}
  
  Question: ${query}`;

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

function animateText(text, element) {
  let i = 0;
  element.innerHTML = '';
  const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  element.innerHTML = formattedText;
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSearch();
});

toggleSourcesBtn.addEventListener('click', () => {
  resultsList.classList.toggle('hidden');
  toggleSourcesBtn.textContent = resultsList.classList.contains('hidden') ? 'View Source Excerpts' : 'Hide Source Excerpts';
});

document.querySelectorAll('.suggestion-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    searchInput.value = chip.textContent;
    handleSearch();
  });
});

init();
