import React, { useState, useEffect } from 'react';
import { sbGet } from '../supabase';
import { Acesso, Produto } from '../types';
import { ShieldCheck, ExternalLink, Loader2, Lock, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { fmt } from '../supabase';

interface Props {
  saleHash: string;
}

export default function PublicPrivatePage({ saleHash }: Props) {
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  // Código de acesso
  const [codigoInput, setCodigoInput] = useState('');
  const [showCodigo, setShowCodigo] = useState(false);
  const [codigoErro, setCodigoErro] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);

  useEffect(() => { carregar(); }, [saleHash]);

  const carregar = async () => {
    setLoading(true);
    try {
      const rec = await sbGet<Acesso>('acessos', saleHash);
      if (!rec) { setErro(true); return; }
      setAcesso(rec);
      const prod = await sbGet<Produto>('produtos', rec.dados.produto_id);
      if (prod) setProduto(prod);
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = () => {
    const codigoSalvo = (acesso?.dados as any)?.codigo_acesso;
    if (!codigoSalvo) {
      // Se não tem código, libera direto (produto sem código gerado)
      setDesbloqueado(true);
      return;
    }
    if (codigoInput.trim().toUpperCase() === codigoSalvo.toUpperCase()) {
      setDesbloqueado(true);
      setCodigoErro('');
    } else {
      setCodigoErro('Código incorreto. Verifique e tente novamente.');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-green-400" />
    </div>
  );

  if (erro || !acesso) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center max-w-sm w-full">
        <Lock className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h2 className="text-white font-bold text-base mb-1">Link inválido ou expirado</h2>
        <p className="text-gray-400 text-xs">Este link de acesso não foi encontrado. Verifique o link ou entre em contato com o vendedor.</p>
      </div>
    </div>
  );

  // Tela de inserção do código
  if (!desbloqueado) return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <div className="max-w-sm w-full space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center mx-auto">
            <Key className="w-7 h-7 text-yellow-400" />
          </div>
          <h1 className="text-white font-bold text-lg">Área Restrita</h1>
          <p className="text-gray-400 text-xs leading-relaxed">
            Digite o código que você recebeu após a confirmação do pagamento para acessar seu produto.
          </p>
        </div>

        {/* Produto info */}
        <div className="bg-[#0e0e16] border border-gray-800 rounded-2xl p-4 text-center">
          <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Produto</p>
          <p className="text-white font-bold text-sm">{acesso.dados.produto_nome}</p>
          <p className="text-green-400 text-xs font-mono mt-1">{fmt(acesso.dados.valor)}</p>
        </div>

        {/* Input código */}
        <div className="bg-[#0e0e16] border border-gray-800 rounded-2xl p-5 space-y-4">
          <label className="block text-[10px] text-gray-400 font-mono uppercase tracking-wider font-bold">Código de acesso</label>
          <div className="relative">
            <input
              type={showCodigo ? 'text' : 'password'}
              value={codigoInput}
              onChange={e => { setCodigoInput(e.target.value.toUpperCase()); setCodigoErro(''); }}
              onKeyDown={e => e.key === 'Enter' && verificarCodigo()}
              placeholder="Ex: PAG-7X3K"
              className="w-full bg-[#12121e] border border-gray-700 focus:border-yellow-500 focus:outline-none rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 font-mono tracking-widest pr-10"
            />
            <button type="button" onClick={() => setShowCodigo(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
              {showCodigo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {codigoErro && <p className="text-red-400 text-xs font-mono">{codigoErro}</p>}
          <button
            onClick={verificarCodigo}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-sm rounded-xl transition"
          >
            🔓 Acessar Produto
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-600 font-mono">
          Comprador: {acesso.dados.comprador_nome}
        </p>
      </div>
    </div>
  );

  // Conteúdo desbloqueado
  const temConteudo = produto?.dados.conteudo_interno;
  const temLinkExterno = produto?.dados.link_original && !produto?.dados.tem_conteudo_proprio;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 font-sans pb-16 select-none"
      onContextMenu={e => e.preventDefault()}
    >
      {/* Header */}
      <header className="bg-[#0d0d14]/90 border-b border-gray-800/60 backdrop-blur px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-green-400" />
          </div>
          <span className="font-bold text-sm text-white">Sua Área de Acesso</span>
          <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded font-mono font-bold">PAGO</span>
        </div>
        <span className="text-[10px] text-gray-500 font-mono">PaguSeguro Pro</span>
      </header>

      <main className="max-w-xl mx-auto px-4 mt-8 space-y-5">

        {/* Confirmação */}
        <div className="bg-[#0e0e16] border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span className="text-xs text-green-400 font-bold font-mono">PAGAMENTO CONFIRMADO VIA PIX</span>
          </div>
          <h2 className="text-xl font-bold text-white">{acesso.dados.produto_nome}</h2>
          <div className="flex items-center gap-4 text-xs text-gray-400 font-mono">
            <span>Comprador: <span className="text-gray-200">{acesso.dados.comprador_nome}</span></span>
            <span>Valor: <span className="text-green-400 font-bold">{fmt(acesso.dados.valor)}</span></span>
          </div>
        </div>

        {/* Conteúdo do produto */}
        <div className="bg-[#0e0e16] border border-gray-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white">Seu produto</h3>

          {/* Conteúdo interno — sem print, sem selecionar */}
          {temConteudo && (
            <div className="p-4 bg-[#080810] border border-gray-800/60 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-gray-400 font-mono uppercase">Conteúdo Digital</p>
              <div
                className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto scrollbar-thin pr-1 pointer-events-none"
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {produto?.dados.conteudo_interno}
              </div>
            </div>
          )}

          {/* Link externo */}
          {temLinkExterno && (
            <div className="p-4 bg-[#080810] border border-gray-800/60 rounded-xl space-y-2">
              <p className="text-[10px] font-bold text-gray-400 font-mono uppercase">Link de Acesso</p>
              <a
                href={produto?.dados.link_original}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-green-400 hover:text-green-300 font-bold break-all"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                {produto?.dados.link_original}
              </a>
            </div>
          )}

          {!temConteudo && !temLinkExterno && (
            <p className="text-xs text-gray-500 text-center py-4">O vendedor entregará o conteúdo em breve. Guarde este link.</p>
          )}
        </div>

        {/* Aviso permanente */}
        <div className="flex items-start gap-2.5 p-4 bg-[#0d1a0d] border border-green-900/30 rounded-xl">
          <Lock className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-green-400">Link permanente e exclusivo seu</p>
            <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">Guarde o link desta página. Você pode voltar aqui a qualquer momento para acessar seu produto novamente.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
