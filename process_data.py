import json
import os

def chunk_text(text, source_name):
    # Split by double newlines to get paragraphs
    paragraphs = text.split('\n\n')
    chunks = []
    for i, p in enumerate(paragraphs):
        p = p.strip()
        if len(p) > 50: # Ignore very short snippets
            chunks.append({
                "id": f"{source_name}_{i}",
                "content": p,
                "source": source_name
            })
    return chunks

data = []
if os.path.exists('nurse_rag_site/data/pph.txt'):
    with open('nurse_rag_site/data/pph.txt', 'r') as f:
        data.extend(chunk_text(f.read(), "Prevention and Management of PPH"))

if os.path.exists('nurse_rag_site/data/ethical.txt'):
    with open('nurse_rag_site/data/ethical.txt', 'r') as f:
        data.extend(chunk_text(f.read(), "Ethical Protocol and RAG Impact Study"))

with open('nurse_rag_site/data.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Processed {len(data)} chunks.")
