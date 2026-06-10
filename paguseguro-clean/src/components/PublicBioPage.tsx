import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sbGetWhere, sbUpsert, sbGetAll, uid, fmt, sbGet, sendTelegram, ADMIN_CHAT_ID, TAXA_VENDA_PERCENTUAL } from '../supabase';
import { Vendedor, Produto, Agente } from '../types';
import { Instagram, Twitter, Music2, Globe, Send, ShoppingBag, X, Clipboard, Shield, Zap, Lock, CheckCircle2, Calendar } from 'lucide-react';

interface PublicBioPageProps { sellerSlug: string; }

interface VendedorExtended extends Vendedor {
  dados: Vendedor['dados'] & {
    bio?: string; nicho?: string; foto_capa_base64?: string; foto_url?: string;
    instagram?: string; twitter?: string; tiktok?: string; site?: string;
    total_conteudo?: number; total_midias?: number; total_curtidas?: number;
    nome_agente_publico?: string;
  };
}

interface Msg {
  remetente: 'comprador' | 'ia';
  texto: string; ts: number; opcoes?: string[];
}

type CtxFluxo = {
  nomeLoja: string;
  nomeProd: string;
  produtos: Produto[];
  preco: number;
  corPrimaria: string;
  etapaIdx: number;
  respostas: string[];
  nomeComprador?: string;
  produtoEscolhido?: Produto;
};

type EtapaFluxo = {
  texto: string | ((ctx: CtxFluxo) => string);
  opcoes: string[] | ((ctx: CtxFluxo) => string[]);
  proxima?: (resposta: string, ctx: CtxFluxo) => string;
};

function montarOpcoesInvestimento(prods: Produto[]): string[] {
  const sorted = [...prods].sort((a, b) => a.dados.preco - b.dados.preco);
  if (sorted.length === 0) return ['💳 Ver produtos disponíveis'];
  if (sorted.length === 1) return [`💰 ${fmt(sorted[0].dados.preco)} — ${sorted[0].dados.nome}`, '🤔 Ainda preciso pensar'];
  const opcoes: string[] = [];
  opcoes.push(`💚 A partir de ${fmt(sorted[0].dados.preco)} — entrada acessível`);
  if (sorted.length >= 3) opcoes.push(`⚡ ${fmt(sorted[Math.floor(sorted.length / 2)].dados.preco)} — opção intermediária`);
  opcoes.push(`🏆 ${fmt(sorted[sorted.length - 1].dados.preco)} — melhor resultado`);
  opcoes.push('🤔 Ainda preciso pensar');
  return opcoes;
}

function recomendarProduto(respostas: string[], prods: Produto[], ctx?: CtxFluxo): Produto {
  if (ctx?.produtoEscolhido) return ctx.produtoEscolhido;
  const sorted = [...prods].sort((a, b) => a.dados.preco - b.dados.preco);
  const textoRespostas = respostas.join(' ').toLowerCase();
  const porNome = prods.find(p => textoRespostas.includes(p.dados.nome.toLowerCase().slice(0, 10)));
  if (porNome) return porNome;
  const porPreco = prods.find(p => textoRespostas.includes(String(Math.round(p.dados.preco))));
  if (porPreco) return porPreco;
  if (textoRespostas.includes('melhor') || textoRespostas.includes('resultado') || textoRespostas.includes('alto')) return sorted[sorted.length - 1];
  if (textoRespostas.includes('acessível') || textoRespostas.includes('começando') || textoRespostas.includes('entrada')) return sorted[0];
  return sorted[Math.floor(sorted.length / 2)] || sorted[0];
}

// FIX 2 & 3: Fluxo corrigido — agente verifica nomeComprador antes de perguntar
const FLUXO: Record<string, EtapaFluxo> = {
  abertura: {
    texto: (ctx) => {
      // FIX 3: se já tem nome salvo, pula direto para saudação + humor
      if (ctx.nomeComprador) {
        return `Oi, ${ctx.nomeComprador}! 👋 Que bom ter você de volta na ${ctx.nomeLoja}!\n\nComo você tá chegando hoje?`;
      }
      return `Oi! 👋 Que bom ter você aqui na ${ctx.nomeLoja}!\n\nAntes de mais nada... como posso te chamar? 😊`;
    },
    opcoes: (ctx) => ctx.nomeComprador
      ? ['😅 Corrido, cheio de coisa', '😌 Só dando uma olhada', '😤 Estressado, precisando de solução', '🔥 Animado, em busca de novidade']
      : [],
    proxima: (resp, ctx) => {
      if (ctx.nomeComprador) return 'objetivo';
      const nome = resp.trim().split(' ')[0].replace(/[^a-zA-ZÀ-ú]/g, '') || 'você';
      (ctx as any).nomeComprador = nome;
      return 'humor';
    },
  },
  humor: {
    texto: (ctx) => `Prazer, ${(ctx as any).nomeComprador || 'você'}! 😊\n\nComo você tá chegando hoje?`,
    opcoes: ['😅 Corrido, cheio de coisa', '😌 Só dando uma olhada', '😤 Estressado, precisando de solução', '🔥 Animado, em busca de novidade'],
    proxima: () => 'objetivo',
  },
  objetivo: {
    texto: () => 'Que bom! 😊\n\nMas me conta — o que te trouxe até aqui hoje?',
    opcoes: ['💡 Quero aprender algo novo', '💰 Busco uma renda extra', '🚀 Quero escalar meu negócio', '🎯 Tenho um problema específico pra resolver'],
    proxima: () => 'catalogo',
  },
  catalogo: {
    texto: (ctx) => {
      if (!ctx.produtos.length) return 'Opa! Parece que ainda não há produtos disponíveis aqui.\n\nVolte em breve! 😊';
      return `Perfeito! Então deixa eu te mostrar o que a gente tem aqui — são opções certeiras pra quem quer resultado de verdade:\n\nQual desses tá mais na sua linha agora?`;
    },
    opcoes: (ctx) => {
      const sorted = [...ctx.produtos].sort((a, b) => a.dados.preco - b.dados.preco);
      const ops = sorted.slice(0, 4).map(p => `👉 ${p.dados.nome} — ${fmt(p.dados.preco)}`);
      ops.push('🤔 Nenhum, quero entender melhor');
      return ops;
    },
    proxima: (resp, ctx) => {
      ctx.respostas.push(resp);
      if (resp.includes('entender') || resp.includes('Nenhum')) return 'investimento';
      // FIX 4: identificar produto pelo nome exato no botão clicado
      const sorted = [...ctx.produtos].sort((a, b) => a.dados.preco - b.dados.preco);
      const escolhido = sorted.find(p => resp.includes(p.dados.nome));
      if (escolhido) ctx.produtoEscolhido = escolhido;
      return 'detalhe_produto';
    },
  },
  investimento: {
    texto: () => `Sem problema! Vou te ajudar a encontrar o que faz mais sentido pra você.\n\nMe diz — quanto você consegue investir agora, confortavelmente?`,
    opcoes: (ctx) => montarOpcoesInvestimento(ctx.produtos),
    proxima: (resp, ctx) => { ctx.respostas.push(resp); return 'detalhe_produto'; },
  },
  detalhe_produto: {
    texto: (ctx) => {
      const prod = recomendarProduto(ctx.respostas, ctx.produtos, ctx);
      const beneficios = prod.dados.descricao || 'Conteúdo exclusivo e completo';
      return `Olha, com base no que você me contou, esse aqui é exatamente o que você precisa 🎯\n\n🏆 "${prod.dados.nome}"\n\n✅ ${beneficios}\n\n💎 Acesso imediato após pagamento\n🔒 Suporte direto com o vendedor\n\n💰 Investimento: ${fmt(prod.dados.preco)}\n\nSó uma pergunta — o que te impede de garantir agora?`;
    },
    opcoes: ['💳 Nada! Quero garantir agora', '❓ Tenho uma dúvida rápida', '📋 Quero ver todos os produtos', '🤔 Ainda preciso pensar'],
    proxima: (resp) => {
      if (resp.includes('garantir') || resp.includes('agora')) return 'fechar';
      if (resp.includes('dúvida') || resp.includes('duvida')) return 'duvida';
      if (resp.includes('todos') || resp.includes('ver')) return 'catalogo';
      return 'fechar_suave';
    },
  },
  duvida: {
    texto: () => 'Claro, pode perguntar! Aqui não tem pergunta boba não. 😊\n\nSobre o que é a dúvida?',
    opcoes: ['📦 Como funciona a entrega/acesso?', '💰 Tem algum desconto disponível?', '🔄 E se eu não gostar?', '📱 Funciona no celular?'],
    proxima: (resp) => {
      if (resp.includes('entrega') || resp.includes('acesso')) return 'resp_entrega';
      if (resp.includes('desconto')) return 'resp_desconto';
      if (resp.includes('gostar')) return 'resp_garantia';
      return 'resp_celular';
    },
  },
  resp_entrega: {
    texto: () => 'Assim que o pagamento cai, o acesso é liberado na hora! ⚡\n\nNão precisa esperar nada — você já começa a usar em minutos. Simples assim.\n\nEssa dúvida tá resolvida?',
    opcoes: ['💳 Sim! Quero garantir agora', '❓ Tenho outra dúvida', '👍 Entendi, obrigado!'],
    proxima: (resp) => resp.includes('garantir') ? 'fechar' : 'fechar_suave',
  },
  resp_desconto: {
    texto: (ctx) => {
      const p = ctx.produtos.find(pr => pr.dados.pre_lancamento) || ctx.produtos[0];
      if (p?.dados.pre_lancamento) return `Boa notícia! 🎉 "${p.dados.nome}" tá em PRÉ-LANÇAMENTO.\n\nQuem agenda agora garante 10% de desconto — oportunidade rara!\n\nDe ${fmt(p.dados.preco / 0.9)} por apenas ${fmt(p.dados.preco)} 🔥\n\nQuer aproveitar antes que acabe?`;
      return `Olha, o preço atual já foi pensado pra ser acessível. 💎\n\nE tem mais: é acesso vitalício — você paga uma vez e usa pra sempre.\n\nO retorno que isso traz é muito maior que o valor. Vale demais!\n\nVamos fechar?`;
    },
    opcoes: ['💳 Sim! Quero aproveitar agora', '📅 Quero agendar com desconto', '🤔 Preciso pensar mais'],
    proxima: (resp) => resp.includes('agendar') || resp.includes('aproveitar') || resp.includes('sim') ? 'fechar' : 'fechar_suave',
  },
  resp_garantia: {
    texto: () => 'Entendo! É natural querer ter certeza antes de decidir. 😊\n\nO vendedor garante sua satisfação. Qualquer problema, o suporte resolve rápido — sem burocracia nenhuma.\n\nVai dar esse passo?',
    opcoes: ['💳 Sim, vou aproveitar!', '👍 Ok, entendi'],
    proxima: () => 'fechar',
  },
  resp_celular: {
    texto: () => 'Sim! Funciona em tudo — celular, tablet, computador 📱💻\n\nAcessa de onde quiser, quando quiser. Sem limitação nenhuma.\n\nIsso tá resolvido então! Podemos fechar?',
    opcoes: ['💳 Sim! Quero garantir', '😊 Ótimo, obrigado!'],
    proxima: () => 'fechar',
  },
  fechar: {
    texto: (ctx) => {
      const prod = recomendarProduto(ctx.respostas, ctx.produtos, ctx);
      return `Ótima escolha! 🎉 Sério, você vai adorar.\n\nClica no botão abaixo pra garantir "${prod.dados.nome}" agora e ter acesso imediato! 👇\n\nNão deixa pra depois — você já demorou tempo demais pra chegar aqui! 😄`;
    },
    opcoes: ['💳 Quero garantir agora!'],
  },
  fechar_suave: {
    texto: () => 'Tudo bem, sem pressão! 😊\n\nSe mudar de ideia ou tiver mais alguma dúvida, é só me chamar — tô aqui!\n\nMas antes de ir... quer dar só mais uma olhadinha nos produtos?',
    opcoes: ['💳 Na verdade, quero garantir!', '👋 Obrigado, até logo'],
  },
};

const AGENT_DELAY_MS = 10000;

function getRespostaAgente(etapaAtual: string, respostaCliente: string, ctx: CtxFluxo): string {
  const etapa = FLUXO[etapaAtual];
  if (!etapa?.proxima) return 'fechar';
  return etapa.proxima(respostaCliente.toLowerCase(), ctx);
}

export default function PublicBioPage({ sellerSlug }: PublicBioPageProps) {
  const [seller, setSeller] = useState<VendedorExtended | null>(null);
  const [products, setProducts] = useState<Produto[]>([]);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [agent, setAgent] = useState<Agente | null>(null);
  const [activeProduct, setActiveProduct] = useState<Produto | null>(null);

  const [showAgentChat, setShowAgentChat] = useState(false);
  const [conversa, setConversa] = useState<Msg[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [agentTriggered, setAgentTriggered] = useState(false);
  const [etapaAtual, setEtapaAtual] = useState('abertura');
  const reengajTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [leadId] = useState(() => 'lead_' + uid());
  const agentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const produtoEscolhidoRef = useRef<Produto | null>(null);
  // FIX 2: ref para nome do comprador persistir entre renders
  const nomeCompradorRef = useRef<string>('');
  // FIX BUG SELEÇÃO: ref para acumular respostas entre etapas (não zera a cada buildCtx)
  const respostasRef = useRef<string[]>([]);

  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutProd, setCheckoutProd] = useState<Produto | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'form' | 'pix' | 'aguardando' | 'done'>('form');
  const [checkoutMode, setCheckoutMode] = useState<'compra' | 'agendamento' | 'local_pagar' | 'local_chegada'>('compra');
  const [compradorNome, setCompradorNome] = useState('');
  const [compradorWhatsapp, setCompradorWhatsapp] = useState('');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [solicitacaoId, setSolicitacaoId] = useState('');
  const [pixStatus, setPixStatus] = useState('');
  const [pixCode, setPixCode] = useState('');
  const [pixTimeLeft, setPixTimeLeft] = useState(600);
  const [copied, setCopied] = useState(false);
  const [linkAcessoProduto, setLinkAcessoProduto] = useState('');
  const [codigoAcesso, setCodigoAcesso] = useState('');
  const [codigoCopied, setCodigoCopied] = useState(false);
  // FIX 8: estado para botão "confirmei o envio"
  const [pixEnvioConfirmado, setPixEnvioConfirmado] = useState(false);

  type CompraHistorico = { id: string; produto: string; valor: number; codigo: string; link: string; data: string; ts: number; };
  const [historicoCompras, setHistoricoCompras] = useState<CompraHistorico[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);

  const VISITANTE_KEY = (slug: string) => 'pps_visitante_' + slug;
  const [showBoasVindas, setShowBoasVindas] = useState(false);
  const [boasVindasNome, setBoasVindasNome] = useState('');
  const [termosAceitos, setTermosAceitos] = useState(false);
  const [boasVindasErro, setBoasVindasErro] = useState('');

  const corPrimaria = agent?.dados?.cor_vitrine || '#f97316';

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [conversa]);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (pixStatus === 'pix_enviado' && pixTimeLeft > 0) iv = setInterval(() => setPixTimeLeft(p => p - 1), 1000);
    return () => { if (iv) clearInterval(iv); };
  }, [pixStatus, pixTimeLeft]);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    if (solicitacaoId && (pixStatus === 'aguardando_pix' || pixStatus === 'pix_enviado')) {
      iv = setInterval(async () => {
        try {
          const sol = await sbGet<any>('pix_solicitacoes', solicitacaoId);
          if (sol?.dados) {
            if (sol.dados.pix_codigo && pixStatus === 'aguardando_pix') {
              setPixTimeLeft(600);
              setPixCode(sol.dados.pix_codigo);
              setPixStatus('pix_enviado');
              setCheckoutStep('pix');
            }
            if (sol.dados.pix_confirmado || sol.dados.status === 'confirmado') {
              const linkFinal = sol.dados.link_produto || checkoutProd?.dados?.link_original || '';
              if (linkFinal) setLinkAcessoProduto(linkFinal);
              const codFinal = sol.dados.codigo_acesso || gerarCodigo();
              setCodigoAcesso(codFinal);
              const acessoId = sol.dados.acesso_id || solicitacaoId;
              sbUpsert('acessos', {
                id: acessoId, ts: Date.now(),
                dados: {
                  produto_id: sol.dados.produto_id || checkoutProd?.id || '',
                  produto_nome: sol.dados.produto_nome || checkoutProd?.dados?.nome || '',
                  valor: sol.dados.valor_produto || checkoutProd?.dados?.preco || 0,
                  comprador_nome: sol.dados.comprador_nome || compradorNome || '',
                  comprador_whatsapp: sol.dados.comprador_whatsapp || compradorWhatsapp || '',
                  vendedor_id: sol.dados.vendedor_id || '',
                  codigo_acesso: codFinal,
                  link_produto: linkFinal,
                  pix_id: solicitacaoId,
                  status: 'ativo',
                }
              }).catch(() => {});
              if (sellerSlug && compradorNome) saveNome(sellerSlug, compradorNome);
              if (sellerSlug && checkoutProd) {
                addToHistorico(sellerSlug, {
                  id: acessoId,
                  produto: checkoutProd.dados.nome,
                  valor: checkoutProd.dados.preco,
                  codigo: codFinal,
                  link: `${window.location.origin}${window.location.pathname}?p=${acessoId}`,
                  data: new Date().toLocaleDateString('pt-BR'),
                  ts: Date.now()
                });
              }
              setPixStatus('confirmado');
              setCheckoutStep('done');
              if (iv) clearInterval(iv);
            }
          }
        } catch {}
      }, 5000);
    }
    return () => { if (iv) clearInterval(iv); };
  }, [solicitacaoId, pixStatus]);

  useEffect(() => {
    if (!sellerSlug) return;
    const savedId = sessionStorage.getItem('pps_sol_' + sellerSlug);
    if (savedId) {
      sbGet<any>('pix_solicitacoes', savedId).then(sol => {
        if (sol?.dados && sol.dados.status !== 'cancelado') {
          setSolicitacaoId(savedId);
          setPixStatus(sol.dados.status);
          if (sol.dados.pix_codigo) setPixCode(sol.dados.pix_codigo);
          if (sol.dados.link_produto) setLinkAcessoProduto(sol.dados.link_produto);
          setCheckoutStep(sol.dados.status === 'confirmado' ? 'done' : sol.dados.pix_codigo ? 'pix' : 'aguardando');
          setShowCheckout(true);
        }
      });
    }
  }, [sellerSlug]);

  useEffect(() => { fetchData(); }, [sellerSlug]);

  useEffect(() => {
    if (!sellerSlug) return;
    const hist = loadHistorico(sellerSlug);
    setHistoricoCompras(hist);
    const nomeSalvo = loadNomeSalvo(sellerSlug);
    if (nomeSalvo) {
      setCompradorNome(nomeSalvo);
      setBoasVindasNome(nomeSalvo);
      nomeCompradorRef.current = nomeSalvo; // FIX 2: sincronizar ref
    } else {
      setTimeout(() => setShowBoasVindas(true), 1200);
    }
  }, [sellerSlug]);

  // FIX 1: termos obrigatórios — removido "Pular por agora"
  const confirmarBoasVindas = () => {
    if (!boasVindasNome.trim()) { setBoasVindasErro('Digite seu nome para continuar'); return; }
    if (!termosAceitos) { setBoasVindasErro('Você precisa aceitar os termos para continuar'); return; }
    const nome = boasVindasNome.trim();
    if (sellerSlug) saveNome(sellerSlug, nome);
    setCompradorNome(nome);
    nomeCompradorRef.current = nome; // FIX 2
    setShowBoasVindas(false);
  };

  useEffect(() => {
    if (!seller || agentTriggered) return;
    if (!agent || agent.dados.ativo === false) return;
    agentTimerRef.current = setTimeout(() => triggerAgent(), AGENT_DELAY_MS);
    return () => { if (agentTimerRef.current) clearTimeout(agentTimerRef.current); };
  }, [seller, agent, agentTriggered]);

  const fetchData = async () => {
    try {
      const sellers = await sbGetAll<VendedorExtended>('vendedores');
      const found = sellers?.find(s => s.dados?.slug?.toLowerCase() === sellerSlug?.toLowerCase());
      if (!found) { setSeller(null as any); setLoadError(true); return; }
      setSeller(found);
      const prods = await sbGetWhere<Produto>('produtos', 'vendedor_id', found.id);
      const ativos = prods.filter(p => p.dados.ativo && !p.dados._excluido);
      let catProds: Produto[] = [];
      try {
        const catalogo = await sbGetAll<any>('catalogo_paguseguro');
        const desativados: string[] = found.dados?.catalogo_desativado || [];
        catProds = (catalogo || [])
          .filter((c: any) => c.dados?.ativo && !desativados.includes(c.id))
          .map((c: any) => ({
            id: c.id, ts: c.ts,
            dados: {
              vendedor_id: found.id,
              nome: c.dados.nome,
              descricao: c.dados.descricao,
              preco: c.dados.preco,
              foto_base64: c.dados.foto_base64 || c.dados.foto_url || '',
              link_original: c.dados.link_original || '',
              ativo: true,
              is_catalogo_paguseguro: true,
              taxa_plataforma_override: c.dados.taxa_plataforma || 0.55,
            }
          }));
      } catch { catProds = []; }
      const todosProds = [...ativos, ...catProds];
      setProducts(todosProds);
      if (todosProds.length > 0) setActiveProduct(todosProds[0]);
      const agents = await sbGetWhere<Agente>('agentes', 'vendedor_id', found.id);
      const firstAgent = agents[0] || null;
      if (firstAgent) setAgent(firstAgent);
      await sbUpsert('leads', { id: leadId, ts: Date.now(), dados: { vendedor_id: found.id, vendedor_slug: found.dados.slug, status: 'visitante', origem: 'visita', ts_entrada: Date.now() } });
    } catch (err) { console.error('fetchData:', err); setLoadError(true); }
  };

  // FIX 2: buildCtx sempre injeta nomeComprador do ref
  const buildCtx = useCallback((prods: Produto[]): CtxFluxo => ({
    nomeLoja: seller?.dados.nome || 'nossa loja',
    nomeProd: produtoEscolhidoRef.current?.dados.nome || prods[0]?.dados.nome || activeProduct?.dados.nome || 'nosso produto',
    produtos: prods.length > 0 ? prods : (activeProduct ? [activeProduct] : []),
    preco: produtoEscolhidoRef.current?.dados.preco || prods[0]?.dados.preco || activeProduct?.dados.preco || 0,
    corPrimaria,
    etapaIdx: 0,
    respostas: [...respostasRef.current], // FIX BUG SELEÇÃO: preservar respostas acumuladas
    nomeComprador: nomeCompradorRef.current || undefined, // FIX 2
    produtoEscolhido: produtoEscolhidoRef.current || undefined,
  }), [seller, activeProduct, corPrimaria]);

  const triggerAgent = useCallback(async () => {
    if (agentTriggered) return;
    setAgentTriggered(true);
    if (agentTimerRef.current) clearTimeout(agentTimerRef.current);
    const prods = products.length > 0 ? products : (activeProduct ? [activeProduct] : []);
    const ctx = buildCtx(prods);
    const etapa = FLUXO['abertura'];
    const textoIa = typeof etapa.texto === 'function' ? etapa.texto(ctx) : etapa.texto;
    const opcoesResolvidas = typeof etapa.opcoes === 'function' ? etapa.opcoes(ctx) : etapa.opcoes;
    // FIX 3: se já tem nome, pula abertura e vai para humor diretamente
    const etapaInicial = ctx.nomeComprador ? 'abertura' : 'abertura';
    setEtapaAtual(etapaInicial);
    setConversa([{ remetente: 'ia', ts: Date.now(), texto: textoIa, opcoes: opcoesResolvidas }]);
    setShowAgentChat(true);
    if (seller) {
      await sbUpsert('leads', { id: leadId, ts: Date.now(), dados: { vendedor_id: seller.id, vendedor_slug: seller.dados.slug, status: 'interessado', origem: 'agente_idle', ts_entrada: Date.now() } });
    }
  }, [agentTriggered, products, activeProduct, seller, leadId, buildCtx]);
  const chamarGroq = useCallback(async (mensagemCliente: string, _historicoAtual: Msg[], ctx: CtxFluxo): Promise<string> => {
    const msg = mensagemCliente.toLowerCase();
    const prods = ctx.produtos;
    const nome = nomeCompradorRef.current || ctx.nomeComprador || '';
    const cumprimento = nome ? nome + ', ' : '';

    // Produto fixado — NUNCA troca o produto escolhido
    const prodFixado = produtoEscolhidoRef.current;
    const prodMencionado = prodFixado || prods.find((p: Produto) =>
      msg.includes(p.dados.nome.toLowerCase().slice(0, 8))
    ) || prods[0];

    const querComprar = ['comprar','adquirir','garantir','quero','pagar','valor','preco','quanto'].some(k => msg.includes(k));
    const temDuvida = ['como','funciona','serve','acesso','entrega','celular','tablet','funciona'].some(k => msg.includes(k));
    const querDesconto = ['desconto','barato','promocao','cupom','menos','caro'].some(k => msg.includes(k));
    const querLista = ['produtos','opcoes','catalogo','lista','outros','mais'].some(k => msg.includes(k));

    if (querLista) {
      const lista = prods.map((p: Produto) => '• ' + p.dados.nome + ' — ' + fmt(p.dados.preco)).join('
');
      return cumprimento + 'aqui estão todos os produtos disponíveis:

' + lista + '

Qual te interessa? 😊';
    }

    if (querDesconto) {
      const temPreLanc = prods.find((p: Produto) => p.dados.pre_lancamento);
      if (temPreLanc) return cumprimento + 'temos "' + temPreLanc.dados.nome + '" em pré-lançamento com 10% off! 🎉
Quer garantir agora?';
      return cumprimento + 'o preço já está no melhor valor! Acesso vitalício por apenas ' + (prodMencionado ? fmt(prodMencionado.dados.preco) : 'um investimento acessível') + '. 💎';
    }

    if (temDuvida && prodMencionado) {
      return cumprimento + 'sobre "' + prodMencionado.dados.nome + '":

' +
        (prodMencionado.dados.descricao || 'Conteúdo exclusivo e completo.') +
        '

⚡ Acesso imediato após pagamento
📱 Funciona em qualquer dispositivo
🔒 Suporte direto com o vendedor

Garantir agora por ' + fmt(prodMencionado.dados.preco) + '?';
    }

    if (querComprar && prodMencionado) {
      return 'Ótima escolha! 🎉 "' + prodMencionado.dados.nome + '" por ' + fmt(prodMencionado.dados.preco) + '.

Clica em **Adquirir agora** abaixo! 👇';
    }

    if (prodMencionado) {
      return cumprimento + '"' + prodMencionado.dados.nome + '" é exatamente o que você precisa! ✅

' +
        (prodMencionado.dados.descricao ? prodMencionado.dados.descricao + '

' : '') +
        '💰 ' + fmt(prodMencionado.dados.preco) + ' — acesso imediato.

O que te impede de garantir agora? 😊';
    }

    return cumprimento + 'posso te ajudar a escolher o produto certo! O que você busca — renda extra, aprender algo novo, ou resolver um problema específico? 🎯';
  }, [products, activeProduct]);

  const responderAgente = useCallback(async (respostaCliente: string, historicoAtual: Msg[], usarGroq = false) => {
    setChatLoading(true);
    const prods = products.length > 0 ? products : (activeProduct ? [activeProduct] : []);
    const ctx = buildCtx(prods);

    // Groq só entra em etapas livres (dúvida, texto livre) — nunca no catálogo ou fluxo estruturado
    const etapasEstruturadas = ['abertura', 'humor', 'objetivo', 'catalogo', 'investimento', 'fechar', 'fechar_suave'];
    const podeGroq = usarGroq && prods.length > 0 && !etapasEstruturadas.includes(etapaAtual);

    if (podeGroq) {
      try {
        const respostaIA = await chamarGroq(respostaCliente, historicoAtual, ctx);
        if (respostaIA) {
          setConversa([...historicoAtual, { remetente: 'ia', ts: Date.now(), texto: respostaIA, opcoes: ['💳 Quero adquirir agora!', '❓ Tenho outra dúvida', '👍 Entendi, obrigado!'] }]);
          setChatLoading(false);
          return;
        }
      } catch (err) { console.error('Groq error:', err); }
    }

    setTimeout(() => {
      const proximaEtapaKey = getRespostaAgente(etapaAtual, respostaCliente, ctx);
      if (ctx.produtoEscolhido) produtoEscolhidoRef.current = ctx.produtoEscolhido;
      // FIX BUG SELEÇÃO: salvar respostas acumuladas no ref
      respostasRef.current = ctx.respostas;
      // FIX 2: salvar nome capturado pelo fluxo
      if ((ctx as any).nomeComprador && !(nomeCompradorRef.current)) {
        nomeCompradorRef.current = (ctx as any).nomeComprador;
        setCompradorNome((ctx as any).nomeComprador);
        if (sellerSlug) saveNome(sellerSlug, (ctx as any).nomeComprador);
      }
      const proximaEtapa = FLUXO[proximaEtapaKey] || FLUXO['fechar'];
      const textoIa = typeof proximaEtapa.texto === 'function' ? proximaEtapa.texto(ctx) : proximaEtapa.texto;
      const opcoesResolvidas = typeof proximaEtapa.opcoes === 'function' ? proximaEtapa.opcoes(ctx) : proximaEtapa.opcoes;
      setEtapaAtual(proximaEtapaKey);
      const novaConversaFinal = [...historicoAtual, { remetente: 'ia' as const, ts: Date.now(), texto: textoIa, opcoes: opcoesResolvidas }];
      setConversa(novaConversaFinal);
      setChatLoading(false);

      if (reengajTimerRef.current) clearTimeout(reengajTimerRef.current);
      if (proximaEtapaKey !== 'fechar' && proximaEtapaKey !== 'fechar_suave') {
        reengajTimerRef.current = setTimeout(() => {
          const prods2 = products.length > 0 ? products : (activeProduct ? [activeProduct] : []);
          const ctx2 = buildCtx(prods2);
          const prod = recomendarProduto([], prods2, ctx2);
          const msgReeng: Msg = {
            remetente: 'ia', ts: Date.now(),
            texto: `Ei, ainda estou aqui! 😊\n\nSó queria confirmar — você tem interesse em "${prod?.dados.nome || 'nosso produto'}"? Posso te ajudar a decidir agora! 🎯`,
            opcoes: ['💳 Sim! Quero garantir agora', '👀 Quero ver as opções', '👋 Não, obrigado']
          };
          setConversa(prev => [...prev, msgReeng]);
        }, 60000);
      }
    }, 700);
  }, [etapaAtual, products, activeProduct, buildCtx, chamarGroq, sellerSlug]);

  const handleOpcaoRapida = (opcao: string) => {
    if (opcao.includes('adquirir') || opcao.includes('Adquirir') || opcao.includes('garantir') || opcao.includes('Garantir')) {
      const msgUsr: Msg = { remetente: 'comprador', texto: opcao, ts: Date.now() };
      setConversa(prev => [...prev, msgUsr]);
      setTimeout(() => {
        setShowAgentChat(false);
        // FIX 4: usar produto escolhido do ref, não pegar aleatório
        const prod = produtoEscolhidoRef.current || activeProduct || products[0];
        if (prod) abrirCheckout(prod, 'compra');
      }, 300);
      return;
    }
    if (opcao.includes('Agendar') || opcao.includes('agendar')) {
      const msgUsr: Msg = { remetente: 'comprador', texto: opcao, ts: Date.now() };
      setConversa(prev => [...prev, msgUsr]);
      setTimeout(() => {
        setShowAgentChat(false);
        const prod = produtoEscolhidoRef.current || activeProduct || products[0];
        if (prod) abrirCheckout(prod, 'agendamento');
      }, 300);
      return;
    }
    const msgUsr: Msg = { remetente: 'comprador', texto: opcao, ts: Date.now() };
    const novaConversa = [...conversa, msgUsr];
    setConversa(novaConversa);
    responderAgente(opcao, novaConversa, false);
  };

  const handleSendMsg = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput.trim() || chatLoading) return;
    const texto = msgInput.trim();
    setMsgInput('');
    const msgUsr: Msg = { remetente: 'comprador', texto, ts: Date.now() };
    const novaConversa = [...conversa, msgUsr];
    setConversa(novaConversa);
    responderAgente(texto, novaConversa, true);
  };

  // FIX 4: abrirCheckout sempre recebe o produto correto e salva no ref
  const abrirCheckout = (prod: Produto, modo: 'compra' | 'agendamento' | 'local_pagar' | 'local_chegada' = 'compra') => {
    setCheckoutProd(prod);
    setActiveProduct(prod);
    produtoEscolhidoRef.current = prod;
    setCheckoutStep('form');
    setPixStatus('');
    setPixCode('');
    setPixEnvioConfirmado(false);
    setCheckoutMode(modo);
    setShowCheckout(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutProd || !seller || !compradorNome.trim() || !compradorWhatsapp.trim()) return;
    if (sellerSlug) saveNome(sellerSlug, compradorNome.trim());
    nomeCompradorRef.current = compradorNome.trim(); // FIX 2

    if (checkoutMode === 'local_chegada') {
      const resId = 'res_' + uid();
      try {
        await sbUpsert('pix_solicitacoes', {
          id: resId, ts: Date.now(),
          dados: {
            id: resId, status: 'reserva_presencial',
            vendedor_id: seller.id, vendedor_nome: seller.dados.nome,
            comprador_nome: compradorNome, comprador_whatsapp: compradorWhatsapp,
            produto_id: checkoutProd.id, produto_nome: checkoutProd.dados.nome,
            valor_produto: checkoutProd.dados.preco,
            modo: 'local_chegada', data_agendamento: dataAgendamento,
            pix_confirmado: false, data: new Date().toISOString(),
          }
        });
        await sendTelegram(ADMIN_CHAT_ID, '📅 <b>RESERVA PRESENCIAL</b>\n\n👤 Cliente: <b>' + compradorNome + '</b>\n📱 WhatsApp: <b>' + compradorWhatsapp + '</b>\n🏪 Vendedor: ' + seller.dados.nome + '\n📦 Serviço: ' + checkoutProd.dados.nome + '\n' + (dataAgendamento ? '📅 Data: ' + dataAgendamento + '\n' : '') + '💵 Pagamento: NA CHEGADA\n💰 Valor: R$ ' + checkoutProd.dados.preco.toFixed(2));
        setCheckoutStep('done');
        setPixStatus('reserva_ok');
      } catch {}
      return;
    }

    const solId = 'pix_' + uid();
    const valorOriginal = checkoutProd.dados.preco;
    const valorComDesconto = checkoutMode === 'agendamento' ? parseFloat((valorOriginal * 0.9).toFixed(2)) : valorOriginal;
    const taxaPlataforma = parseFloat((valorComDesconto * TAXA_VENDA_PERCENTUAL).toFixed(2));
    const valorLiquido = parseFloat((valorComDesconto - taxaPlataforma).toFixed(2));

    try {
      // FIX 8: ir para tela "aguardando" (não tela branca)
      setPixStatus('aguardando_pix');
      setCheckoutStep('aguardando');
      const ok = await sbUpsert('pix_solicitacoes', {
        id: solId, ts: Date.now(),
        dados: {
          id: solId, status: 'aguardando_pix',
          vendedor_id: seller.id, vendedor_nome: seller.dados.nome, vendedor_slug: seller.dados.slug,
          comprador_nome: compradorNome, comprador_whatsapp: compradorWhatsapp,
          produto_id: checkoutProd.id, produto_nome: checkoutProd.dados.nome,
          valor_produto: valorComDesconto,
          taxa_plataforma: taxaPlataforma,
          taxa_percentual: TAXA_VENDA_PERCENTUAL,
          valor_liquido_vendedor: valorLiquido,
          valor_total: valorComDesconto,
          modo: checkoutMode,
          data_agendamento: checkoutMode === 'agendamento' ? dataAgendamento : null,
          pix_codigo: '', pix_confirmado: false,
          data: new Date().toISOString(),
        }
      });
      if (!ok) { alert('Erro ao registrar. Verifique conexão.'); setPixStatus(''); setCheckoutStep('form'); return; }
      setSolicitacaoId(solId);
      sessionStorage.setItem('pps_sol_' + sellerSlug, solId);
      await sendTelegram(ADMIN_CHAT_ID,
        '🛒 <b>' + (checkoutMode === 'agendamento' ? 'PRÉ-AGENDAMENTO' : 'NOVA SOLICITAÇÃO PIX') + '</b>\n\n' +
        '👤 Comprador: <b>' + compradorNome + '</b>\n📱 WhatsApp: <b>' + compradorWhatsapp + '</b>\n' +
        '🏪 Vendedor: ' + seller.dados.nome + '\n📦 Produto: ' + checkoutProd.dados.nome + '\n' +
        (checkoutMode === 'agendamento' ? '📅 Data Agendamento: ' + dataAgendamento + '\n' : '') +
        '💰 Valor: R$ ' + valorComDesconto.toFixed(2) + '\n' +
        '📊 Taxa (25%): R$ ' + taxaPlataforma.toFixed(2) + '\n' +
        '💵 Líquido Vendedor: R$ ' + valorLiquido.toFixed(2) + '\n' +
        '🆔 ID: <code>' + solId + '</code>\n\n⚡ Acesse o painel para gerar e enviar o Pix.'
      );
      await sbUpsert('leads', { id: leadId, ts: Date.now(), dados: { vendedor_id: seller.id, vendedor_slug: seller.dados.slug, status: 'convertido', origem: checkoutMode === 'agendamento' ? 'agendamento' : 'checkout', produto_interesse: checkoutProd.dados.nome, nome: compradorNome, whatsapp: compradorWhatsapp, ts_entrada: Date.now() } });
    } catch (err) { console.error(err); setPixStatus(''); setCheckoutStep('form'); }
  };

  const copiarPix = () => { navigator.clipboard.writeText(pixCode); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const gerarCodigo = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code.slice(0, 4) + '-' + code.slice(4);
  };

  const CART_KEY = (slug: string) => 'pps_cart_' + slug;
  const loadHistorico = (slug: string): CompraHistorico[] => { try { return JSON.parse(localStorage.getItem(CART_KEY(slug)) || '[]'); } catch { return []; } };
  const saveHistorico = (slug: string, lista: CompraHistorico[]) => { try { localStorage.setItem(CART_KEY(slug), JSON.stringify(lista)); } catch {} };
  const addToHistorico = (slug: string, compra: CompraHistorico) => {
    const atual = loadHistorico(slug);
    const nova = [compra, ...atual.filter(c => c.id !== compra.id)].slice(0, 20);
    saveHistorico(slug, nova);
    setHistoricoCompras(nova);
  };

  const NOME_KEY = (slug: string) => 'pps_nome_' + slug;
  const loadNomeSalvo = (slug: string) => { try { return localStorage.getItem(NOME_KEY(slug)) || ''; } catch { return ''; } };
  const saveNome = (slug: string, nome: string) => {
    try {
      localStorage.setItem(NOME_KEY(slug), nome);
      nomeCompradorRef.current = nome; // FIX 2: sincronizar sempre
    } catch {}
  };

  if (!seller) return (
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center gap-3">
      {loadError ? (
        <><p className="text-gray-500 text-sm font-medium">Vitrine não encontrada.</p><p className="text-gray-400 text-xs">Verifique o link ou tente novamente.</p></>
      ) : (
        <><div className="w-8 h-8 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" /><p className="text-gray-400 text-sm">Carregando vitrine...</p></>
      )}
    </div>
  );

  const totalConteudo = seller.dados.total_conteudo ?? products.length;
  const totalMidias = seller.dados.total_midias ?? (products.length * 12);
  const totalCurtidas = seller.dados.total_curtidas ?? 0;
  const nomeAgente = agent?.dados.nome_agente || seller.dados.nome_agente_publico || seller.dados.nome;

  return (
    <div className="min-h-screen bg-[#faf9f7]" style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>

      {/* Capa */}
      <div className="relative h-48 sm:h-60 overflow-hidden">
        {seller.dados.foto_capa_base64
          ? <img src={seller.dados.foto_capa_base64} alt="capa" className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, ' + corPrimaria + 'cc, ' + corPrimaria + '44, #f5f5f0)' }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Perfil */}
      <div className="max-w-lg mx-auto px-4">
        <div className="relative -mt-12 mb-4">
          <div className="relative inline-block">
            {seller.dados.avatar_base64
              ? <img src={seller.dados.avatar_base64} alt={seller.dados.nome} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
              : <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-bold" style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + '88)' }}>{seller.dados.nome[0]}</div>}
            <div className="absolute -bottom-1 -right-1 rounded-full p-1" style={{ background: corPrimaria }}>
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-0.5">{seller.dados.nome}</h1>
        <p className="text-gray-400 text-sm mb-2">@{seller.dados.slug}</p>
        {seller.dados.bio && <p className="text-gray-600 text-sm leading-relaxed mb-4">{seller.dados.bio}</p>}

        <div className="flex gap-5 mb-4 text-sm flex-wrap">
          <div className="flex items-center gap-1.5 text-gray-500"><ShoppingBag className="w-4 h-4" /><span className="font-semibold text-gray-800">{totalConteudo}</span><span>produtos</span></div>
          <div className="flex items-center gap-1.5 text-gray-500"><span>🎬</span><span className="font-semibold text-gray-800">{totalMidias}</span><span>mídias</span></div>
          {totalCurtidas > 0 && <div className="flex items-center gap-1.5 text-gray-500"><span>❤️</span><span className="font-semibold text-gray-800">{totalCurtidas >= 1000 ? (totalCurtidas / 1000).toFixed(1) + 'K' : totalCurtidas}</span></div>}
        </div>

        {(seller.dados.instagram || seller.dados.twitter || seller.dados.tiktok || seller.dados.site) && (
          <div className="flex gap-2 mb-6">
            {seller.dados.instagram && <a href={'https://instagram.com/' + seller.dados.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><Instagram className="w-4 h-4 text-gray-600" /></a>}
            {seller.dados.twitter && <a href={'https://x.com/' + seller.dados.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><Twitter className="w-4 h-4 text-gray-600" /></a>}
            {seller.dados.tiktok && <a href={'https://tiktok.com/@' + seller.dados.tiktok} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><Music2 className="w-4 h-4 text-gray-600" /></a>}
            {seller.dados.site && <a href={seller.dados.site} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition"><Globe className="w-4 h-4 text-gray-600" /></a>}
          </div>
        )}

        <div className="h-px bg-gray-100 mb-5" />

        {/* FIX 5/10: PRODUTOS com imagem, nome, descrição, preço */}
        {products.length > 0 && (
          <div className="mb-4">
            <h2 className="font-semibold text-gray-800 mb-3 text-xs uppercase tracking-widest">Produtos</h2>
            {products.map((prod) => {
              const isPreLancamento = prod.dados.pre_lancamento;
              const valorOriginal = parseFloat((prod.dados.preco * 1.25).toFixed(2));
              const fotoUrl = prod.dados.foto_base64 || (prod.dados as any).foto_url || '';
              return (
                <div key={prod.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-3 overflow-hidden">
                  {/* FIX 5: sempre mostrar área de imagem */}
                  {fotoUrl ? (
                    <div className="w-full h-40 overflow-hidden">
                      <img src={fotoUrl} alt={prod.dados.nome} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-full h-28 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, ' + corPrimaria + '22, ' + corPrimaria + '11)' }}>
                      <ShoppingBag className="w-10 h-10 opacity-30" style={{ color: corPrimaria }} />
                    </div>
                  )}
                  <div className="p-4">
                    {isPreLancamento && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-2" style={{ background: corPrimaria + '22', color: corPrimaria }}>
                        🚀 PRÉ-LANÇAMENTO
                      </span>
                    )}
                    {/* FIX 5: nome sempre visível */}
                    <h3 className="font-bold text-gray-900 text-base mb-1">{prod.dados.nome}</h3>
                    {/* FIX 5: descrição sempre visível */}
                    {prod.dados.descricao
                      ? <p className="text-gray-500 text-sm mb-3 leading-relaxed">{prod.dados.descricao}</p>
                      : <p className="text-gray-300 text-sm mb-3 italic">Produto exclusivo</p>
                    }
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-gray-300 line-through text-sm">{fmt(valorOriginal)}</span>
                      <span className="font-bold text-lg" style={{ color: corPrimaria }}>{fmt(prod.dados.preco)}</span>
                      <span className="text-xs text-green-600 font-semibold">20% off</span>
                    </div>
                    <div className="flex gap-2">
                      {prod.dados.modo_local ? (
                        <>
                          <button onClick={() => abrirCheckout(prod, 'local_pagar')}
                            className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + 'bb)' }}>
                            <Zap className="w-3.5 h-3.5 inline mr-1" />Pagar agora
                          </button>
                          {prod.dados.aceita_pagar_chegada && (
                            <button onClick={() => abrirCheckout(prod, 'local_chegada')}
                              className="flex-1 py-3 rounded-xl font-bold text-sm border-2 transition active:scale-[0.98]"
                              style={{ borderColor: corPrimaria, color: corPrimaria }}>
                              📅 Pagar na chegada
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <button onClick={() => abrirCheckout(prod, 'compra')}
                            className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + 'bb)' }}>
                            <Zap className="w-3.5 h-3.5 inline mr-1" />Adquirir agora
                          </button>
                          {isPreLancamento && (
                            <button onClick={() => abrirCheckout(prod, 'agendamento')}
                              className="flex-1 py-3 rounded-xl font-bold text-sm border-2 transition active:scale-[0.98]"
                              style={{ borderColor: corPrimaria, color: corPrimaria }}>
                              <Calendar className="w-3.5 h-3.5 inline mr-1" />Agendar (-10%)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="mt-2 flex gap-3">
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="text-xs font-semibold mb-0.5" style={{ color: corPrimaria }}>{totalConteudo} Produtos</p>
                <p className="text-xs text-gray-400">no catálogo</p>
              </div>
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-3 text-center shadow-sm">
                <p className="text-xs font-semibold mb-0.5" style={{ color: corPrimaria }}>{totalMidias} Mídias</p>
                <p className="text-xs text-gray-400">disponíveis</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 my-6">
          <div className="flex items-center justify-center gap-2 w-full py-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Shield className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-500 font-medium">Pagamento 100% seguro via Pix • <span className="text-green-600 font-semibold">PaguSeguro Pro</span></span>
          </div>
          {historicoCompras.length > 0 && (
            <button onClick={() => setShowHistorico(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl shadow-sm text-xs text-gray-600 font-medium hover:bg-gray-50 transition active:scale-[0.98]">
              <ShoppingBag className="w-3.5 h-3.5" style={{ color: corPrimaria }} />
              Minhas compras ({historicoCompras.length})
            </button>
          )}
        </div>
      </div>

      {/* POPUP AGENTE PRO */}
      {showAgentChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setShowAgentChat(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            style={{ width: 'min(92vw, 420px)', height: 'min(72vh, 580px)' }}>

            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + '99)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white/30">
                  {seller.dados.avatar_base64
                    ? <img src={seller.dados.avatar_base64} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white font-bold" style={{ background: corPrimaria + '88' }}>{nomeAgente[0]}</div>}
                </div>
                <div>
                  {/* FIX branding: "Agente Pro" não "AI" */}
                  <p className="text-white font-semibold text-sm">{nomeAgente}</p>
                  <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse inline-block" /><span className="text-white/75 text-xs">Agente Pro • online</span></div>
                </div>
              </div>
              <button onClick={() => setShowAgentChat(false)} className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/80">
              {conversa.map((msg, i) => (
                <div key={i}>
                  <div className={'flex ' + (msg.remetente === 'comprador' ? 'justify-end' : 'justify-start') + ' items-end gap-2'}>
                    {msg.remetente === 'ia' && (
                      <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mb-0.5">
                        {seller.dados.avatar_base64
                          ? <img src={seller.dados.avatar_base64} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ background: corPrimaria }}>{nomeAgente[0]}</div>}
                      </div>
                    )}
                    <div className={'max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ' + (msg.remetente === 'comprador' ? 'text-white rounded-br-sm' : 'bg-white text-gray-700 rounded-bl-sm shadow-sm border border-gray-100')}
                      style={{ whiteSpace: 'pre-wrap', background: msg.remetente === 'comprador' ? corPrimaria : undefined }}>
                      {msg.texto}
                    </div>
                  </div>
                  {msg.remetente === 'ia' && msg.opcoes && i === conversa.length - 1 && !chatLoading && (
                    <div className="flex flex-col gap-1.5 mt-2 ml-8">
                      {/* Cards catálogo — clique direto abre checkout */}
                      {etapaAtual === 'catalogo' && (() => {
                        const prods = products.length > 0 ? products : (activeProduct ? [activeProduct] : []);
                        // Mostrar TODOS os produtos, ordenados por preço
                        const sorted = [...prods].sort((a, b) => a.dados.preco - b.dados.preco);
                        if (!sorted.length) return null;
                        return (
                          <div className="grid grid-cols-1 gap-2 mb-1 w-full">
                            {sorted.map(prod => {
                              const foto = prod.dados.foto_base64 || (prod.dados as any).foto_url || '';
                              return (
                                <div key={prod.id}
                                  className="bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer active:scale-[0.98] transition"
                                  style={{ borderColor: corPrimaria + '33' }}
                                  onClick={() => {
                                    // Seleciona produto e abre checkout DIRETAMENTE — sem passar pelo fluxo de texto
                                    produtoEscolhidoRef.current = prod;
                                    const msgUsr: Msg = { remetente: 'comprador', texto: `Quero: ${prod.dados.nome}`, ts: Date.now() };
                                    setConversa(prev => [...prev, msgUsr]);
                                    setTimeout(() => {
                                      setShowAgentChat(false);
                                      abrirCheckout(prod, 'compra');
                                    }, 250);
                                  }}>
                                  {foto
                                    ? <img src={foto} alt={prod.dados.nome} className="w-full h-36 object-cover" />
                                    : <div className="w-full h-24 flex items-center justify-center" style={{ background: `linear-gradient(135deg,${corPrimaria}18,${corPrimaria}08)` }}>
                                        <ShoppingBag className="w-10 h-10 opacity-20" style={{ color: corPrimaria }} />
                                      </div>
                                  }
                                  <div className="px-3 py-3">
                                    <p className="font-bold text-gray-900 text-sm mb-0.5">{prod.dados.nome}</p>
                                    {prod.dados.descricao && <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">{prod.dados.descricao}</p>}
                                    <div className="flex items-center justify-between">
                                      <span className="font-black text-base" style={{ color: corPrimaria }}>{fmt(prod.dados.preco)}</span>
                                      <span className="text-[11px] font-bold text-white px-3 py-1.5 rounded-xl" style={{ background: corPrimaria }}>Comprar agora →</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}

                      {/* Preview produto fechar — clicar abre checkout direto */}
                      {(etapaAtual === 'detalhe_produto' || etapaAtual === 'fechar') && (() => {
                        const prods = products.length > 0 ? products : (activeProduct ? [activeProduct] : []);
                        const prodPreview = produtoEscolhidoRef.current || recomendarProduto([], prods);
                        if (!prodPreview) return null;
                        const foto = prodPreview.dados.foto_base64 || (prodPreview.dados as any).foto_url || '';
                        return (
                          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mb-1 cursor-pointer active:scale-[0.98] transition"
                            style={{ borderColor: corPrimaria + '33' }}
                            onClick={() => { setShowAgentChat(false); abrirCheckout(prodPreview, 'compra'); }}>
                            {foto
                              ? <img src={foto} alt={prodPreview.dados.nome} className="w-full h-28 object-cover" />
                              : <div className="w-full h-16 flex items-center justify-center" style={{ background: corPrimaria + '11' }}>
                                  <ShoppingBag className="w-6 h-6 opacity-20" style={{ color: corPrimaria }} />
                                </div>
                            }
                            <div className="px-3 py-2.5">
                              <p className="font-bold text-gray-900 text-xs mb-0.5">{prodPreview.dados.nome}</p>
                              {prodPreview.dados.descricao && <p className="text-[10px] text-gray-500 line-clamp-2 mb-1.5">{prodPreview.dados.descricao}</p>}
                              <div className="flex items-center justify-between">
                                <span className="font-black text-sm" style={{ color: corPrimaria }}>{fmt(prodPreview.dados.preco)}</span>
                                <span className="text-[10px] font-bold text-white px-2.5 py-1 rounded-xl" style={{ background: corPrimaria }}>Comprar agora →</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {/* Opções de texto — na etapa catálogo, botões abrem checkout direto */}
                      {msg.opcoes.filter(op => etapaAtual !== 'catalogo').map((op, oi) => (
                        <button key={oi} onClick={() => handleOpcaoRapida(op)}
                          className="text-left px-3 py-2 bg-white text-xs rounded-xl transition font-medium border hover:bg-gray-50 active:scale-[0.98]"
                          style={{ borderColor: corPrimaria + '55', color: corPrimaria }}>
                          {op}
                        </button>
                      ))}
                      {/* No catálogo, mostrar só o botão "não quero nenhum" */}
                      {etapaAtual === 'catalogo' && (
                        <button onClick={() => handleOpcaoRapida('🤔 Nenhum, quero entender melhor')}
                          className="text-left px-3 py-2 bg-white text-xs rounded-xl transition font-medium border hover:bg-gray-50 active:scale-[0.98] mt-1"
                          style={{ borderColor: corPrimaria + '55', color: corPrimaria }}>
                          🤔 Nenhum, quero entender melhor
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ background: corPrimaria }}>{nomeAgente[0]}</div>
                  <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl shadow-sm">
                    <div className="flex gap-1">{[0, 150, 300].map(d => <span key={d} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />)}</div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMsg} className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white flex-shrink-0">
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} placeholder="Ou escreva aqui..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none text-gray-700" />
              <button type="submit" disabled={!msgInput.trim() || chatLoading}
                className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40 transition flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + '99)' }}>
                <Send className="w-4 h-4 text-white" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CHECKOUT */}
      {showCheckout && checkoutProd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">{checkoutProd.dados.nome}</h3>
                {checkoutMode === 'agendamento' && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full mb-1" style={{ background: corPrimaria + '22', color: corPrimaria }}>
                    📅 Pré-agendamento — 10% de desconto
                  </span>
                )}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-gray-400 line-through text-sm">{fmt(parseFloat((checkoutProd.dados.preco * (checkoutMode === 'agendamento' ? 1.25 : 1.7)).toFixed(2)))}</span>
                  <span className="font-bold text-lg" style={{ color: corPrimaria }}>
                    {fmt(checkoutMode === 'agendamento' ? parseFloat((checkoutProd.dados.preco * 0.9).toFixed(2)) : checkoutProd.dados.preco)}
                  </span>
                </div>
              </div>
              {checkoutStep === 'form' && <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-gray-600 p-1 mt-1"><X className="w-5 h-5" /></button>}
            </div>

            <div className="px-5 pb-6 pt-4">
              {checkoutStep === 'form' && (
                <form onSubmit={handleCheckoutSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">Seu nome</label>
                    <input value={compradorNome} onChange={e => setCompradorNome(e.target.value)} required placeholder="Nome Sobrenome"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none text-gray-800" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5 font-medium">WhatsApp</label>
                    <input value={compradorWhatsapp} onChange={e => setCompradorWhatsapp(e.target.value)} required placeholder="(11) 99999-9999"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none text-gray-800" />
                  </div>
                  {checkoutMode === 'agendamento' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Data desejada</label>
                      <input type="date" value={dataAgendamento} onChange={e => setDataAgendamento(e.target.value)} required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none text-gray-800" />
                    </div>
                  )}
                  <button type="submit"
                    className="w-full py-4 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                    style={{ background: 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + '99)' }}>
                    <Zap className="w-4 h-4" /> {checkoutMode === 'agendamento' ? 'Confirmar Agendamento' : 'Continuar para Pix'}
                  </button>
                  <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1"><Lock className="w-3 h-3" /> Pagamento seguro via Pix</p>
                </form>
              )}

              {/* FIX 8: Tela "aguardando" — nunca tela branca */}
              {checkoutStep === 'aguardando' && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: corPrimaria + '15' }}>
                    <div className="w-8 h-8 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: corPrimaria, borderTopColor: 'transparent' }} />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-base mb-1">Pedido registrado! ✅</p>
                    <p className="text-gray-500 text-sm">Aguardando geração do código Pix...</p>
                    <p className="text-gray-400 text-xs mt-2">O administrador irá gerar o Pix em instantes.<br />Esta tela atualiza automaticamente.</p>
                  </div>
                  {/* FIX 8: botão "Confirmei o envio do PIX" */}
                  {!pixEnvioConfirmado ? (
                    <button
                      onClick={() => { setPixEnvioConfirmado(true); }}
                      className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                      ✅ Já enviei o Pix
                    </button>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                      <p className="text-green-700 font-semibold text-sm">Obrigado! Aguardando confirmação do administrador.</p>
                      <p className="text-green-600 text-xs mt-1">Você receberá o acesso assim que confirmado. 😊</p>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === 'pix' && pixStatus === 'pix_enviado' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="font-semibold text-gray-800 mb-1">Pix gerado! ✅</p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <span>Expira em:</span>
                      <span className="font-mono font-bold" style={{ color: pixTimeLeft < 60 ? '#ef4444' : corPrimaria }}>
                        {String(Math.floor(pixTimeLeft / 60)).padStart(2, '0')}:{String(pixTimeLeft % 60).padStart(2, '0')}
                      </span>
                    </div>
                  </div>
                  <textarea readOnly value={pixCode} rows={4}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono text-gray-600 resize-none bg-gray-50"
                    onClick={e => (e.target as HTMLTextAreaElement).select()} />
                  <button onClick={copiarPix}
                    className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                    style={{ background: copied ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg, ' + corPrimaria + ', ' + corPrimaria + '99)' }}>
                    <Clipboard className="w-4 h-4" />{copied ? 'Copiado! ✓' : 'Copiar código Pix'}
                  </button>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left space-y-3">
                    <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5">📱 Como pagar em 4 passos:</p>
                    <ol className="space-y-2.5 text-xs text-gray-600">
                      {[
                        ['Abra o', 'app do seu banco', 'no celular'],
                        ['Toque em', 'Pix', '→', '"Pix Copia e Cola"'],
                        ['Cole o', 'código copiado', 'acima no campo indicado'],
                        ['Confira o valor e toque em', 'Pagar / Confirmar'],
                      ].map((passos, idx) => (
                        <li key={idx} className="flex gap-2.5 items-start">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white text-[10px]" style={{ background: corPrimaria }}>{idx + 1}</span>
                          <span>{passos.map((p, pi) => pi % 2 === 1 ? <strong key={pi}>{p}</strong> : p)}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* FIX 8: botão "Confirmei o envio do PIX" na tela pix */}
                  {!pixEnvioConfirmado ? (
                    <button
                      onClick={() => { setPixEnvioConfirmado(true); }}
                      className="w-full py-3.5 rounded-2xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
                      style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                      ✅ Confirmei o envio do Pix
                    </button>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                      <p className="text-green-700 font-semibold text-sm mb-1">✅ Ótimo! Pix confirmado por você.</p>
                      <p className="text-green-600 text-xs">Aguardando verificação do administrador...<br />Seu acesso será liberado em breve! 😊</p>
                    </div>
                  )}

                  <p className="text-center text-xs text-gray-400">Aguardando confirmação automática...</p>
                </div>
              )}

              {(checkoutStep === 'done' || pixStatus === 'confirmado' || pixStatus === 'reserva_ok') && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto"><CheckCircle2 className="w-8 h-8 text-green-500" /></div>
                  <h4 className="font-bold text-gray-900 text-lg">
                    {pixStatus === 'reserva_ok' ? 'Reserva confirmada!' : checkoutMode === 'agendamento' ? 'Agendamento confirmado!' : 'Pagamento confirmado!'}
                  </h4>
                  <p className="text-gray-500 text-sm">
                    {pixStatus === 'reserva_ok' ? 'Sua reserva foi registrada! O vendedor entrará em contato.' : checkoutMode === 'agendamento' ? 'Seu horário foi reservado com sucesso.' : 'Seu acesso foi liberado com sucesso.'}
                  </p>
                  {checkoutMode === 'compra' && (() => {
                    const linkFinal = linkAcessoProduto || checkoutProd.dados.link_original || '';
                    const temConteudo = checkoutProd.dados.conteudo_interno;
                    const temArquivo = checkoutProd.dados.arquivo_base64;
                    return (
                      <div className="space-y-3">
                        {codigoAcesso && (
                          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center">
                            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">Seu código de acesso</p>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-2xl font-black tracking-[0.2em] text-gray-900 font-mono">{codigoAcesso}</span>
                              <button onClick={() => { navigator.clipboard.writeText(codigoAcesso); setCodigoCopied(true); setTimeout(() => setCodigoCopied(false), 2000); }}
                                className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 transition">
                                {codigoCopied ? <span className="text-[10px] text-green-600 font-bold">✓</span> : <Clipboard className="w-3.5 h-3.5 text-gray-600" />}
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">Guarde este código — ele dá acesso ao seu produto</p>
                          </div>
                        )}
                        {linkFinal ? (
                          <a href={linkFinal} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-white text-sm text-center"
                            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                            🔓 Acessar conteúdo agora
                          </a>
                        ) : temConteudo ? (
                          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left">
                            <p className="text-xs font-bold text-gray-700 mb-2">📄 Seu conteúdo exclusivo:</p>
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed font-sans max-h-48 overflow-y-auto">{temConteudo}</pre>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-4 py-3 text-center">✅ Compra registrada! O vendedor enviará seu acesso em breve.</p>
                        )}
                        {temArquivo && (
                          <a href={temArquivo} download="material"
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-white text-xs text-center"
                            style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}>
                            📥 Baixar arquivo
                          </a>
                        )}
                      </div>
                    );
                  })()}
                  <button onClick={() => { sessionStorage.removeItem('pps_sol_' + sellerSlug); setShowCheckout(false); }}
                    className="text-sm text-gray-400 underline">Fechar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FIX 1: POPUP BOAS-VINDAS — termos obrigatórios, sem "Pular por agora" */}
      {showBoasVindas && seller && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end justify-center sm:items-center">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 pb-8 shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3 border-2" style={{ borderColor: corPrimaria }}>
                {seller.dados.foto_url
                  ? <img src={seller.dados.foto_url} alt="" className="w-full h-full object-cover" />
                  : seller.dados.avatar_base64
                  ? <img src={seller.dados.avatar_base64} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-white" style={{ background: corPrimaria }}>{seller.dados.nome?.[0] || '?'}</div>
                }
              </div>
              <p className="font-bold text-gray-900 text-base">Olá! Bem-vindo(a) à loja de</p>
              <p className="font-black text-lg" style={{ color: corPrimaria }}>{seller.dados.nome}</p>
              <p className="text-xs text-gray-400 mt-1">Para uma experiência personalizada, nos diga seu nome:</p>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={boasVindasNome}
                onChange={e => { setBoasVindasNome(e.target.value); setBoasVindasErro(''); }}
                onKeyDown={e => e.key === 'Enter' && confirmarBoasVindas()}
                placeholder="Seu primeiro nome"
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-800 focus:outline-none text-center font-medium"
                autoFocus
              />
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer mb-4">
              <div
                onClick={() => { setTermosAceitos(v => !v); setBoasVindasErro(''); }}
                className={'w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition ' + (termosAceitos ? 'border-transparent' : 'border-gray-300')}
                style={{ background: termosAceitos ? corPrimaria : 'transparent' }}
              >
                {termosAceitos && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-xs text-gray-500 leading-relaxed">
                Concordo com os <span className="font-semibold text-gray-700">termos de uso</span> e <span className="font-semibold text-gray-700">política de privacidade</span>. Entendo que meu nome será salvo para facilitar futuras compras nesta loja.
              </span>
            </label>

            {boasVindasErro && <p className="text-xs text-red-500 text-center mb-3">{boasVindasErro}</p>}

            {/* FIX 1: SEM botão "Pular por agora" — só o botão de confirmar */}
            <button
              onClick={confirmarBoasVindas}
              className="w-full py-3.5 rounded-2xl font-bold text-white text-sm transition active:scale-[0.98]"
              style={{ background: `linear-gradient(135deg, ${corPrimaria}, ${corPrimaria}cc)` }}
            >
              Entrar na loja →
            </button>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DE COMPRAS */}
      {showHistorico && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowHistorico(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-5 pb-8 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" style={{ color: corPrimaria }} />
                Minhas Compras
              </h3>
              <button onClick={() => setShowHistorico(false)} className="p-2 rounded-xl hover:bg-gray-100 transition">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              {historicoCompras.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma compra registrada ainda.</p>}
              {historicoCompras.map((c) => (
                <div key={c.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{c.produto}</p>
                      <p className="text-xs text-gray-400">{c.data} · R$ {c.valor.toFixed(2)}</p>
                    </div>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded-lg">✓ Pago</span>
                  </div>
                  {c.codigo && (
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mt-2">
                      <span className="text-xs text-gray-400">Código:</span>
                      <span className="font-mono font-black text-sm text-gray-900 flex-1">{c.codigo}</span>
                      <button onClick={() => navigator.clipboard.writeText(c.codigo)} className="p-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
                        <Clipboard className="w-3 h-3 text-gray-500" />
                      </button>
                    </div>
                  )}
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl font-bold text-white text-xs"
                      style={{ background: corPrimaria }}>
                      🔓 Acessar conteúdo
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="text-center py-10 text-xs text-gray-300">© {new Date().getFullYear()} PaguSeguro Pro · Todos os direitos reservados</div>
    </div>
  );
}
