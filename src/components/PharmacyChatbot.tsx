import React, { useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { MedicineMaster } from '../types';

interface PharmacyChatbotProps {
  role: string;
  medicines: MedicineMaster[];
  patientMode?: boolean;
}

interface ChatMessage {
  id: number;
  sender: 'user' | 'assistant';
  text: string;
}

const getLocalReply = (question: string, role: string, medicines: MedicineMaster[], patientMode: boolean) => {
  const normalizedQuestion = question.toLowerCase();
  const matchedMedicine = medicines.find((medicine) => normalizedQuestion.includes(medicine.name.toLowerCase()));

  if (matchedMedicine) {
    return `${matchedMedicine.name} is a ${matchedMedicine.category.toLowerCase()} medicine. Strength: ${matchedMedicine.strength}. Storage: ${matchedMedicine.storageCondition}. Please follow a qualified clinician's advice for use.`;
  }
  if (normalizedQuestion.includes('expiry') || normalizedQuestion.includes('expire')) {
    return patientMode ? 'I can explain medicine information, but expiry decisions are handled by the pharmacy team.' : 'Review the Profit & expiry module for batches approaching or past their expiry date.';
  }
  if (normalizedQuestion.includes('prescription')) {
    return patientMode ? 'Open My prescriptions & billing to submit a prescription or check its current status.' : 'Open Prescription Desk to review, dispense, and track prescriptions.';
  }
  if (normalizedQuestion.includes('stock') || normalizedQuestion.includes('inventory')) {
    return patientMode ? 'Stock quantities are not shown in the patient assistant. Ask the pharmacy team about availability.' : 'Open Smart Inventory to inspect batches, quantities, expiry dates, and reorder levels.';
  }
  return `I am the ${role} pharmacy assistant. I can answer medicine reference questions and guide you to features available for your role. This local response engine is ready to be connected to your trained model.`;
};

export default function PharmacyChatbot({ role, medicines, patientMode = false }: PharmacyChatbotProps) {
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 1, sender: 'assistant', text: `Hello. I am your ${role} pharmacy assistant. How can I help?` }
  ]);

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;

    const userMessage = { id: Date.now(), sender: 'user' as const, text: trimmedQuestion };
    setMessages((current) => [...current, userMessage]);
    setQuestion('');
    setIsSending(true);

    try {
      const endpoint = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_AI_CHAT_ENDPOINT;
      if (endpoint) {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmedQuestion, role, patientMode })
        });
        if (!response.ok) throw new Error('AI endpoint unavailable');
        const result = await response.json();
        setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: result.answer || 'The AI model returned no answer.' }]);
      } else {
        setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: getLocalReply(trimmedQuestion, role, medicines, patientMode) }]);
      }
    } catch {
      setMessages((current) => [...current, { id: Date.now() + 1, sender: 'assistant', text: getLocalReply(trimmedQuestion, role, medicines, patientMode) }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center"><Bot className="h-5 w-5 text-teal-400" /></div>
          <div>
            <h2 className="font-display font-bold text-sm">Pharma AI Chatbot</h2>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Training-ready · {role} context</p>
          </div>
        </div>
        <Sparkles className="h-4 w-4 text-teal-400" />
      </div>

      <div className="h-56 overflow-y-auto space-y-3 pr-1 mb-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.sender === 'assistant' && <Bot className="h-4 w-4 text-teal-400 mt-1 shrink-0" />}
            <p className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${message.sender === 'user' ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{message.text}</p>
            {message.sender === 'user' && <User className="h-4 w-4 text-slate-400 mt-1 shrink-0" />}
          </div>
        ))}
        {isSending && <p className="text-[10px] text-teal-400 font-mono">AI is thinking...</p>}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2">
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask the pharmacy AI..." className="min-w-0 flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-500" />
        <button type="submit" disabled={isSending || !question.trim()} title="Send message" className="px-3 rounded-xl bg-teal-500 text-slate-950 disabled:opacity-40 hover:bg-teal-400"><Send className="h-4 w-4" /></button>
      </form>
    </section>
  );
}
