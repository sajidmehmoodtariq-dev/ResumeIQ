export const PROVIDER_DEFS = [
  { id: 'openai',    name: 'OpenAI',         models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],                                defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic', name: 'Anthropic',       models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'], defaultModel: 'claude-sonnet-4-6' },
  { id: 'google',    name: 'Google Gemini',   models: ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-1.5-pro', 'gemini-1.5-flash'], defaultModel: 'gemini-3.5-flash' },
  { id: 'groq',      name: 'Groq',            models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'], defaultModel: 'llama-3.1-70b-versatile' },
];

export const TEMPLATE_DEFS = [
  { id: 'classic',  name: 'Classic',  ats: true,  badge: 'ATS Safe',        description: 'Single column, linear flow. ATS parsers read this perfectly top-to-bottom.' },
  { id: 'modern',   name: 'Modern',   ats: true,  badge: 'ATS Friendly',    description: 'Single column with accent header. Contemporary look, still ATS clean.' },
  { id: 'creative', name: 'Creative', ats: false, badge: 'Design Forward',  description: 'Two-column layout. Visually striking but ATS parsers may misread column order.' },
];

export function getBYOK() {
  try { return JSON.parse(localStorage.getItem('rm_byok') || '{}'); } catch { return {}; }
}
