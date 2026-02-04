import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const MEDICAL_SUMMARY_SYSTEM = `You are a medical scribe. Given a doctor-patient conversation (which may be in progress or complete), produce a concise clinical summary. Highlight medically important points:
- Symptoms mentioned
- Diagnoses or impressions
- Medications prescribed or discussed
- Follow-up actions or recommendations
Also include chief complaint / reason for visit when evident. Use clear headings and bullet points. Be concise.`;

const CONVERSATION_NAME_SYSTEM = `You are a helpful assistant. Given a doctor-patient conversation, generate a short, descriptive name/title for this conversation (max 6 words). Focus on the main topic, symptom, or reason for the visit. Examples: "Headache and Dizziness Consultation", "Follow-up on Blood Pressure", "Chest Pain Evaluation". Return ONLY the title, no quotes, no explanation.`;

function isGroqKeySet() {
  const key = process.env.GROQ_API_KEY || '';
  return key.length > 0 && !key.includes('your_groq') && key !== 'your_groq_api_key_here';
}

export async function generateMedicalSummary(messages) {
  if (!isGroqKeySet()) {
    throw new Error(
      'GROQ_API_KEY is not set. Add your free API key from console.groq.com to server/.env to use "Generate AI summary".'
    );
  }
  const transcript = messages
    .map((m) => `[${m.role}]: ${m.content || m.translatedContent || '(audio)'}`)
    .join('\n');
  if (!transcript.trim()) return 'No conversation content to summarize.';
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: MEDICAL_SUMMARY_SYSTEM },
        { role: 'user', content: transcript },
      ],
      max_tokens: 800,
    });
    return completion.choices[0]?.message?.content?.trim() || 'Summary could not be generated.';
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Summary error:', err?.message ?? err);
    }
    return 'Summary could not be generated. Please try again.';
  }
}

export async function generateConversationName(messages) {
  if (!isGroqKeySet()) {
    return ''; // Return empty string if no API key, name generation is optional
  }
  const transcript = messages
    .map((m) => `[${m.role}]: ${m.content || m.translatedContent || '(audio)'}`)
    .join('\n');
  if (!transcript.trim()) return '';
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: CONVERSATION_NAME_SYSTEM },
        { role: 'user', content: transcript },
      ],
      max_tokens: 30,
    });
    const name = completion.choices[0]?.message?.content?.trim() || '';
    // Remove quotes if present
    return name.replace(/^["']|["']$/g, '');
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Name generation error:', err?.message ?? err);
    }
    return '';
  }
}
