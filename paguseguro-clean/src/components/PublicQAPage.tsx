import React, { useState, useEffect, useRef } from 'react';
import { sbGet, sbUpsert, fmt } from '../supabase';
import { ProdutoQA } from '../types';
import { Send, BookOpen, AlertTriangle, MessageSquare, ArrowLeft, Bot, Sparkles, User, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PublicQAPageProps {
  qaId: string;
}

export default function PublicQAPage({ qaId }: PublicQAPageProps) {
  const [qaRecord, setQaRecord] = useState<ProdutoQA | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchQADetails();
  }, [qaId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaRecord?.dados.historico_qa]);

  const fetchQADetails = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const record = await sbGet<ProdutoQA>('produtos_qa', qaId);
      if (record) {
        setQaRecord(record);
      } else {
        setErrorMsg('Atendimento ou Token Q&A não encontrado.');
      }
    } catch (err) {
      setErrorMsg('Ocorreu um erro ao carregar o portal Q&A.');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !qaRecord || sending) return;

    const currentUsed = qaRecord.dados.perguntas_usadas;
    if (currentUsed >= 10) {
      setErrorMsg('Limite de 10 perguntas atingido para esta sessão de suporte.');
      return;
    }

    const question = inputText.trim();
    setInputText('');
    setSending(true);
    setErrorMsg('');

    // Prepara o novas mensagens locais para exibir instantaneamente
    const tempQuestionObj = {
      pergunta: question,
      resposta: '...',
      ts: Date.now()
    };

    const updatedQAHistory = [...(qaRecord.dados.historico_qa || []), tempQuestionObj];
    const updatedRecord: ProdutoQA = {
      ...qaRecord,
      dados: {
        ...qaRecord.dados,
        historico_qa: updatedQAHistory,
        perguntas_usadas: currentUsed + 1
      }
    };

    setQaRecord(updatedRecord); // Atualiza UI imediatamente com placeholder de carregando

    try {
      // Resposta manual — o vendedor responde pelo painel
      const respostaIA = '⏳ Sua pergunta foi registrada! O vendedor responderá em breve via WhatsApp ou pelo painel de suporte.';

      const finalQAHistory = [...(qaRecord.dados.historico_qa || []), {
        pergunta: question,
        resposta: respostaIA,
        ts: Date.now()
      }];

      const finalRecord: ProdutoQA = {
        ...qaRecord,
        dados: {
          ...qaRecord.dados,
          historico_qa: finalQAHistory,
          perguntas_usadas: currentUsed + 1
        }
      };

      // Grava no Supabase / LocalStorage
      await sbUpsert('produtos_qa', finalRecord);
      setQaRecord(finalRecord);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao obter resposta da Inteligência Artificial.');
      // Reverte ou ajusta se falhou
      const revertedRecord: ProdutoQA = {
        ...qaRecord,
        dados: {
          ...qaRecord.dados,
          perguntas_usadas: currentUsed // não conta se deu erro crasso
        }
      };
      setQaRecord(revertedRecord);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white" id="qa_spinner_container">
        <RefreshCw className="w-10 h-10 animate-spin text-red-500 mb-4" />
        <p className="text-gray-400 text-sm font-mono">Carregando portal de suporte do cliente...</p>
      </div>
    );
  }

  if (errorMsg && !qaRecord) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center text-white px-4" id="qa_error_container">
        <div className="bg-red-500/10 border border-red-500/20 max-w-md w-full p-6 rounded-2xl text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2 font-display">Conexão Interrompida</h2>
          <p className="text-gray-400 text-sm mb-6">{errorMsg}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 transition font-medium rounded-xl text-sm"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (!qaRecord) return null;

  const used = qaRecord.dados.perguntas_usadas || 0;
  const progressPercent = Math.min((used / 10) * 100, 100);

  // Define cor da barra
  let barColorClass = 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
  let textColorClass = 'text-green-400';
  if (used >= 4 && used <= 7) {
    barColorClass = 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]';
    textColorClass = 'text-yellow-400';
  } else if (used >= 8) {
    barColorClass = 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    textColorClass = 'text-red-400';
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col text-white font-sans selection:bg-red-500/30" id="qa_main_view">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 bg-[#0d0d14]/95 border-b border-gray-800/60 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/20 to-red-600/40 border border-red-500/30 flex items-center justify-center shadow-inner">
              <Bot className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight font-display text-gray-100">IA Especialista</span>
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider border border-yellow-500/30">SUPORTE</span>
              </div>
              <p className="text-xs text-gray-400 font-mono truncate max-w-xs md:max-w-md">{qaRecord.dados.produto_nome}</p>
            </div>
          </div>
          
          {/* Contador de Perguntas Utilizadas */}
          <div className="bg-[#141420] border border-gray-800/80 rounded-xl p-3 min-w-[200px] flex flex-col justify-center">
            <div className="flex justify-between items-center mb-1 text-xs">
              <span className="text-gray-400 font-medium">Franquia de Consultas</span>
              <span className={`font-mono font-bold ${textColorClass}`}>{used} / 10</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <motion.div 
                className={`h-full rounded-full ${barColorClass}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        
        {/* Card do Produto/Comprador */}
        <section className="bg-gradient-to-b from-[#11111a] to-[#0c0c14] border border-gray-800/80 rounded-2xl p-5 shadow-xl flex flex-col md:flex-row gap-5 items-start">
          <div className="text-rose-500/20 hidden md:block bg-rose-500/5 p-3 rounded-xl border border-rose-500/10 self-center">
            <BookOpen className="w-8 h-8 text-red-500/80" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-100 font-display">Área Prática do Comprador</h2>
              <span className="text-rose-400 text-xs bg-rose-500/10 px-2 py-0.5 rounded-full font-mono">
                Atendimento: {qaRecord.dados.comprador_nome}
              </span>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              Dúvidas técnicas ou dificuldades práticas? Explore o manual interativo. Faça perguntas ricas sobre a instalação, configuração ou uso ideal.
            </p>
            <div className="p-3 bg-[#0f0f18] border border-gray-800 rounded-lg text-xs font-mono text-gray-400 select-all">
              <strong className="text-gray-300">Produto:</strong> {qaRecord.dados.produto_nome} <br/>
              <strong className="text-gray-300 w-24 inline-block mt-1">Manual Base:</strong> {qaRecord.dados.produto_desc}
            </div>
          </div>
        </section>

        {/* Chat de Conversa técnica */}
        <section className="flex-grow bg-[#0c0c14] border border-gray-800/60 rounded-2xl flex flex-col min-h-[400px] max-h-[600px] overflow-hidden shadow-2xl relative">
          
          {/* Mensagens */}
          <div className="flex-grow p-4 overflow-y-auto space-y-4 font-mono text-sm leading-relaxed">
            {/* Mensagem inicial automatizada */}
            <div className="flex items-start gap-2.5 max-w-[85%] md:max-w-[75%]">
              <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center flex-shrink-0 text-red-500">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#12121a] border border-gray-800/60 rounded-2xl rounded-tl-none p-3.5 text-gray-300">
                <p className="font-sans">
                  Olá, <strong>{qaRecord.dados.comprador_nome}</strong>! Sou o especialista assistente dedicado ao suporte do produto <strong>{qaRecord.dados.produto_nome}</strong>.
                </p>
                <p className="mt-2 font-sans text-xs text-cool-400">
                  Faça qualquer pergunta técnica sobre funcionamento ou conceitos para mim! Você tem direito a um limite de 10 perguntas neste portal de suporte.
                </p>
              </div>
            </div>

            {/* Histórico Real */}
            {qaRecord.dados.historico_qa && qaRecord.dados.historico_qa.map((qaItem, index) => (
              <React.Fragment key={index}>
                {/* Pergunta do Usuário */}
                <div className="flex items-start gap-2.5 max-w-[85%] md:max-w-[75%] ml-auto justify-end">
                  <div className="bg-[#1b1b2f]/90 border border-red-500/20 rounded-2xl rounded-tr-none p-3.5 text-gray-200">
                    <p className="whitespace-pre-line font-sans">{qaItem.pergunta}</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 text-red-400">
                    <User className="w-4 h-4" />
                  </div>
                </div>

                {/* Resposta do Expert */}
                <div className="flex items-start gap-2.5 max-w-[85%] md:max-w-[75%]">
                  <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700/60 flex items-center justify-center flex-shrink-0 text-red-500">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-[#12121a] border border-gray-800/60 rounded-2xl rounded-tl-none p-3.5 text-gray-300">
                    {qaItem.resposta === '...' ? (
                      <div className="flex items-center gap-2 py-1" id="loading-bubbles">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-line font-sans text-sm">{qaItem.resposta}</p>
                    )}
                  </div>
                </div>
              </React.Fragment>
            ))}

            <div ref={chatBottomRef} />
          </div>

          {/* Banner de Limite Esgotado */}
          {used >= 10 && (
            <div className="m-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center" id="limit_exhausted_banner">
              <p className="text-yellow-400 font-semibold font-display text-sm">
                ✅ Suas 10 perguntas foram utilizadas!
              </p>
              <p className="text-gray-400 text-xs mt-1 font-sans">
                Para continuar tirando dúvidas práticas ou obter assistência personalizada, entre em contato diretamente com o vendedor.
              </p>
            </div>
          )}

          {/* Form de Mensagem */}
          {used < 10 && (
            <form onSubmit={handleSend} className="p-3 border-t border-gray-800/60 bg-[#09090f] flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={sending}
                placeholder={sending ? "Obtendo resposta..." : "Tire sua dúvida técnica aqui..."}
                maxLength={400}
                className="flex-1 bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-2 text-sm text-gray-200 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="p-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600 active:scale-95 transition text-white rounded-xl flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-4 border-t border-gray-900 text-xs text-gray-500 font-mono">
          © 2026 PaguSeguro Pro — Suporte IA Integrado ao checkout e pós-vendas.
        </footer>
      </main>
    </div>
  );
}
