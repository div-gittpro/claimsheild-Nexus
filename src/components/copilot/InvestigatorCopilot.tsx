import React, { useState, useEffect } from 'react';
import { useNexus } from '../../store/useNexusStore';
import { llmService } from '../../services/llm/GroqLLMService';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

export const InvestigatorCopilot: React.FC = () => {
  const {
    currentCase,
    currentProvider,
    currentNetwork,
    copilotOpen,
    setCopilotOpen,
  } = useNexus();

  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; citedEvidence?: string[] }[]
  >([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Re-initialize greeting when case changes
  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        text: `Hello Investigator. I am your Nexus Copilot, grounded in verified backend evidence for ${currentCase.id} (${currentProvider.name}, Risk ${currentCase.riskScore}/100, Exposure $${currentCase.estimatedExposure.toLocaleString()}). What would you like to investigate?`,
        citedEvidence: currentCase.evidenceBreakdown.slice(0, 3).map((e) => e.id),
      },
    ]);
  }, [currentCase.id, currentCase.riskScore, currentCase.estimatedExposure, currentProvider.name, currentCase.evidenceBreakdown]);

  const QUICK_QUESTIONS = [
    'Why was this case prioritized?',
    'What changed recently?',
    'Show strongest evidence.',
    'Explain the network.',
    'What should I review first?',
    'What evidence is missing?',
    'Explain the forecast.',
    'Summarize this investigation.',
  ];

  const handleSend = async (question: string) => {
    if (!question.trim()) return;

    const userMessage = { role: 'user' as const, text: question.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await llmService.answerInvestigatorQuestion(
        {
          caseId: currentCase.id,
          providerId: currentProvider.id,
          networkId: currentNetwork?.id || '',
          currentRisk: currentCase.riskScore,
        },
        question
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: response.answer,
          citedEvidence: response.citedEvidenceIds,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Based on evidence for ${currentCase.id}, the current case has ${currentCase.evidenceBreakdown.length} computed evidence signals${currentNetwork ? ` in network ${currentNetwork.id}` : ''}.`,
          citedEvidence: currentCase.evidenceBreakdown.slice(0, 2).map((e) => e.id),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      {!copilotOpen && (
        <button
          onClick={() => setCopilotOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2.5 text-xs font-semibold transition-all hover:scale-105 border border-blue-500"
          title="Open Nexus Investigator Copilot"
        >
          <Bot className="w-4 h-4" />
          <span className="font-sans">Nexus Copilot</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      )}

      {/* Slide-in Drawer */}
      {copilotOpen && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 font-sans tracking-tight">
                  NEXUS COPILOT
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  Context: {currentCase.id} • {currentProvider.id} (Risk {currentCase.riskScore})
                </span>
              </div>
            </div>

            <button
              onClick={() => setCopilotOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1.5 tracking-wider">
              Suggested Inquiries
            </span>
            <div className="flex flex-wrap gap-1">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isTyping}
                  className="px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-700 text-[11px] transition-colors text-left shadow-2xs leading-tight"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs bg-slate-50/30">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[92%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none shadow-xs'
                      : 'bg-white text-slate-800 rounded-bl-none border border-slate-200 shadow-2xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {/* Cited Evidence Tags */}
                  {m.citedEvidence && m.citedEvidence.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-slate-400 font-medium">Evidence Grounding:</span>
                      {m.citedEvidence.map((evId) => (
                        <span
                          key={evId}
                          className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200/80 font-mono text-[10px] font-semibold"
                        >
                          {evId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-slate-500 text-xs italic bg-white p-2.5 rounded-xl border border-slate-200 w-fit shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                <span>Reasoning over verified case evidence...</span>
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-slate-200 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Groq intelligence about this case..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTyping}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={isTyping || !inputText.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-0.5">
              <span>Evidence-constrained reasoning</span>
              <span>Groq LLM Layer</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
