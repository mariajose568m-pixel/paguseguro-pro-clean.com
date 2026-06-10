import React, { useState, useEffect } from 'react';
import { sbGetWhere, sbUpsert, sbGetAll, sbDelete, sbMarkDeleted, uid, fmt, sbGetConfig, sendTelegram, ADMIN_CHAT_ID, TAXA_SAQUE, MINIMO_SAQUE } from '../supabase';
import { Vendedor, Produto, Venda, Saque, Agente, ProdutoQA } from '../types';
import { LayoutDashboard, ShoppingBag, DollarSign, ArrowUpRight, Bot, Sparkles, Plus, ToggleLeft, ToggleRight, List, Trash, Globe, Shield, LogOut, CheckCircle2, Ticket, MessageSquare, AlertCircle, RefreshCw, BarChart2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import PublicBioPage from './PublicBioPage';

interface SellerDashboardProps {
  currentSeller: Vendedor;
  onLogout: () => void;
}

type TabType = 'analytics' | 'produtos' | 'catalogo' | 'vendas' | 'saques' | 'tutorial' | 'agendamento';

export default function SellerDashboard({ currentSeller, onLogout }: SellerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('produtos');
  const [seller, setSeller] = useState<Vendedor>(currentSeller);
  const [platformFees, setPlatformFees] = useState<{ taxa_venda: number; taxa_saque: number }>({ taxa_venda: 2.50, taxa_saque: 2.50 });
  
  // Data Lists
  const [products, setProducts] = useState<Produto[]>([]);
  const [catalogoPaguseguro, setCatalogoPaguseguro] = useState<any[]>([]);
  const [sales, setSales] = useState<Venda[]>([]);
  const [withdrawals, setWithdrawals] = useState<Saque[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Form states: New Product
  const [newProdName, setNewProdName] = useState<string>('');
  const [newProdPrice, setNewProdPrice] = useState<string>('');
  const [newProdDesc, setNewProdDesc] = useState<string>('');
  const [newProdLink, setNewProdLink] = useState<string>('');
  const [newProdFotoBase64, setNewProdFotoBase64] = useState<string>('');
  const [temConteudoProprio, setTemConteudoProprio] = useState<boolean>(false);
  const [newProdConteudoInterno, setNewProdConteudoInterno] = useState<string>('');
  const [newProdArquivoBase64, setNewProdArquivoBase64] = useState<string>('');
  const [newProdArquivoTipo, setNewProdArquivoTipo] = useState<string>('');
  const [newProdPreLancamento, setNewProdPreLancamento] = useState<boolean>(false);
  const [newProdModoLocal, setNewProdModoLocal] = useState<boolean>(false);
  const [canalEntrega, setCanalEntrega] = useState<'conteudo' | 'link_externo' | 'telegram'>('conteudo');
  const [newProdAceitaChegada, setNewProdAceitaChegada] = useState<boolean>(false);
  const [editingProd, setEditingProd] = useState<Produto | null>(null);
  const [deletingProdId, setDeletingProdId] = useState<string | null>(null);
  const [confirmDeleteProd, setConfirmDeleteProd] = useState<Produto | null>(null);
  const [prodToast, setProdToast] = useState<string>('');
  const showProdToast = (msg: string) => { setProdToast(msg); setTimeout(() => setProdToast(''), 2500); };
  // Reformulador de catálogo
  const [showReformulador, setShowReformulador] = useState<boolean>(false);
  const [modalConteudo, setModalConteudo] = useState<Produto | null>(null);
  const [reformNicho, setReformNicho] = useState<string>('');
  const [reformNichoCustom, setReformNichoCustom] = useState<string>('');
  const [reformLoading, setReformLoading] = useState<boolean>(false);
  const [reformLog, setReformLog] = useState<string>('');

  const NICHOS_REFORMA = ['Renda Extra', 'Salão de Cabelo / Beleza', 'Lanchonete / Alimentação', 'Mercadinho / Comércio', 'Educação / Cursos', 'Fitness / Saúde', 'Moda / Roupas', 'Tecnologia / Informática', 'Outro'];

  const criarVitrineIA = async () => {
    const nicho = reformNicho === 'Outro' ? reformNichoCustom.trim() : reformNicho;
    if (!nicho) { alert('Escolha o nicho do seu negócio primeiro.'); return; }

    setReformLoading(true);
    setReformLog('🛒 Criando sua vitrine completa...');

    // Catálogos locais por nicho — sem chamada de API externa
    const catalogoPorNicho: Record<string, Array<{nome: string; descricao: string; preco: number; conteudo: string}>> = {
      'Renda Extra': [
        { nome: 'Kit Renda Extra Digital', descricao: 'Guia completo para começar a ganhar dinheiro online hoje mesmo.', preco: 27, conteudo: 'Acesso ao material digital enviado por e-mail após confirmação do pagamento.' },
        { nome: 'Planilha de Controle Financeiro', descricao: 'Organize suas finanças e descubra onde sobra dinheiro todo mês.', preco: 17, conteudo: 'Planilha em formato digital enviada após confirmação.' },
        { nome: 'Ebook: 50 Ideias de Negócio', descricao: '50 ideias validadas de negócios para iniciar com pouco investimento.', preco: 19, conteudo: 'Ebook em PDF enviado por e-mail.' },
        { nome: 'Mentoria Express Renda Extra', descricao: 'Sessão de 30 minutos para definir seu caminho na renda extra.', preco: 47, conteudo: 'Agendamento via WhatsApp após confirmação do pagamento.' },
        { nome: 'Curso Freelancer Iniciante', descricao: 'Aprenda a trabalhar como freelancer e conquistar seus primeiros clientes.', preco: 37, conteudo: 'Acesso ao curso digital enviado após confirmação.' },
      ],
      'Salão de Cabelo / Beleza': [
        { nome: 'Pacote Hidratação Completa', descricao: 'Hidratação profissional com produtos premium para cabelos danificados.', preco: 89, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
        { nome: 'Coloração + Corte', descricao: 'Transforme seu visual com coloração moderna e corte exclusivo.', preco: 149, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
        { nome: 'Manicure & Pedicure Completo', descricao: 'Cuidado completo para suas mãos e pés com acabamento impecável.', preco: 59, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
        { nome: 'Progressiva Premium', descricao: 'Alisamento de longa duração com produto importado e garantia de resultado.', preco: 199, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
        { nome: 'Tratamento Capilar VIP', descricao: 'Reconstrução e nutrição dos fios com laudo técnico personalizado.', preco: 119, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
      ],
      'Educação / Cursos': [
        { nome: 'Curso Online Completo', descricao: 'Domine o tema do zero ao avançado com aulas em vídeo e material de apoio.', preco: 97, conteudo: 'Link de acesso enviado por e-mail após confirmação.' },
        { nome: 'Ebook Profissional', descricao: 'Material didático completo elaborado por especialistas da área.', preco: 29, conteudo: 'PDF enviado por e-mail após confirmação.' },
        { nome: 'Aula Particular Online', descricao: 'Sessão ao vivo 1:1 para tirar dúvidas e acelerar seu aprendizado.', preco: 79, conteudo: 'Agendamento de horário via WhatsApp após pagamento.' },
        { nome: 'Workshop Intensivo', descricao: 'Imersão prática de 4 horas com exercícios e certificado de participação.', preco: 67, conteudo: 'Link da transmissão enviado por e-mail.' },
        { nome: 'Apostila + Exercícios', descricao: 'Material completo com teoria, exemplos práticos e lista de exercícios.', preco: 19, conteudo: 'PDF enviado por e-mail após confirmação.' },
      ],
      'Fitness / Saúde': [
        { nome: 'Plano de Treino Personalizado', descricao: 'Treino montado por personal trainer conforme seu objetivo e nível.', preco: 79, conteudo: 'PDF com planilha de treino enviado por e-mail.' },
        { nome: 'Dieta + Cardápio Semanal', descricao: 'Plano alimentar balanceado com receitas práticas para a semana toda.', preco: 59, conteudo: 'PDF enviado por e-mail após confirmação.' },
        { nome: 'Consulta Nutricional Online', descricao: 'Avaliação individual e orientação nutricional por profissional certificado.', preco: 129, conteudo: 'Agendamento via WhatsApp após confirmação do pagamento.' },
        { nome: 'Programa 30 Dias Fit', descricao: 'Desafio completo de 30 dias com treinos diários e acompanhamento.', preco: 47, conteudo: 'Acesso ao programa digital enviado após confirmação.' },
        { nome: 'Pack Receitas Fit', descricao: '100 receitas saudáveis e saborosas para o dia a dia sem culpa.', preco: 27, conteudo: 'Ebook em PDF enviado por e-mail.' },
      ],
      'Tecnologia / Informática': [
        { nome: 'Suporte Técnico Remoto', descricao: 'Resolução de problemas no seu computador via acesso remoto seguro.', preco: 59, conteudo: 'Agendamento da sessão via WhatsApp após pagamento.' },
        { nome: 'Formatação + Instalação Windows', descricao: 'Formatação completa com instalação de Windows e programas essenciais.', preco: 89, conteudo: 'Serviço presencial ou remoto. Agendamento via WhatsApp.' },
        { nome: 'Criação de Site Simples', descricao: 'Site profissional de até 3 páginas para divulgar seu negócio online.', preco: 297, conteudo: 'Briefing enviado após confirmação. Entrega em até 5 dias úteis.' },
        { nome: 'Aula de Informática Básica', descricao: 'Aprenda a usar o computador, internet e aplicativos essenciais do zero.', preco: 49, conteudo: 'Agendamento de aula presencial ou online via WhatsApp.' },
        { nome: 'Configuração de Celular / Tablet', descricao: 'Configuração completa, limpeza de vírus e otimização do seu dispositivo.', preco: 39, conteudo: 'Serviço presencial. Agendamento via WhatsApp.' },
      ],
      'Moda / Roupas': [
        { nome: 'Consultoria de Estilo Online', descricao: 'Descubra seu estilo pessoal e monte looks incríveis com o que você já tem.', preco: 79, conteudo: 'Sessão online agendada via WhatsApp após confirmação.' },
        { nome: 'Look do Dia — Curadoria', descricao: 'Seleção personalizada de 5 looks completos baseados no seu perfil.', preco: 47, conteudo: 'PDF com sugestões enviado por e-mail.' },
        { nome: 'Guia de Estilo por Biotipo', descricao: 'Aprenda quais peças valorizam seu corpo de acordo com seu biotipo.', preco: 29, conteudo: 'Ebook em PDF enviado por e-mail.' },
        { nome: 'Personal Shopper Virtual', descricao: 'Acompanhamento completo na hora de comprar roupas online ou em loja.', preco: 99, conteudo: 'Sessão agendada via WhatsApp após confirmação.' },
        { nome: 'Kit Looks para Trabalho', descricao: '10 combinações elegantes e versáteis para usar no ambiente profissional.', preco: 37, conteudo: 'PDF com lookbook enviado por e-mail.' },
      ],
      'Lanchonete / Alimentação': [
        { nome: 'Combo Lanche Especial', descricao: 'Lanche artesanal + batata frita + refri. Feito na hora com ingredientes frescos.', preco: 29, conteudo: 'Pedido via WhatsApp. Retirada no local ou entrega na região.' },
        { nome: 'Marmita Fitness Semanal', descricao: 'Pacote com 5 marmitas fit para a semana. Saudável, prático e saboroso.', preco: 89, conteudo: 'Pedido com antecedência via WhatsApp. Entrega combinada.' },
        { nome: 'Açaí Especial 500ml', descricao: 'Açaí cremoso com granola, banana e leite condensado. Personalize a seu gosto.', preco: 19, conteudo: 'Pedido via WhatsApp. Retirada ou entrega local.' },
        { nome: 'Kit Festa — Salgados 50un', descricao: '50 salgados variados para festas e eventos. Feitos na hora, sem conservantes.', preco: 79, conteudo: 'Pedido com 48h de antecedência via WhatsApp.' },
        { nome: 'Café da Manhã Completo', descricao: 'Café, pão de queijo, tapioca, suco e fruta. Entregue fresquinho toda manhã.', preco: 22, conteudo: 'Assinatura semanal via WhatsApp.' },
      ],
      'Mercadinho / Comércio': [
        { nome: 'Cesta Básica Completa', descricao: 'Cesta com os itens essenciais do mês: arroz, feijão, óleo, macarrão e mais.', preco: 89, conteudo: 'Pedido via WhatsApp. Entrega ou retirada na loja.' },
        { nome: 'Kit Limpeza da Casa', descricao: 'Produtos de limpeza essenciais reunidos em um único kit econômico.', preco: 59, conteudo: 'Pedido via WhatsApp. Entrega ou retirada na loja.' },
        { nome: 'Bebidas Geladas — Pack 12un', descricao: 'Refrigerantes ou sucos em lata. Fresquinhos e prontos para a sua festa.', preco: 39, conteudo: 'Pedido via WhatsApp. Retirada na loja ou entrega local.' },
        { nome: 'Frios e Embutidos — 500g', descricao: 'Seleção de queijo, presunto e salame para o seu café da manhã ou lanche.', preco: 29, conteudo: 'Pedido via WhatsApp. Retirada na loja.' },
        { nome: 'Compras do Mês — Delivery', descricao: 'Monte sua lista e receba tudo em casa. Entrega no mesmo dia para pedidos até 14h.', preco: 149, conteudo: 'Pedido via WhatsApp. Entrega mediante taxa na região.' },
      ],
    };

    // Fotos por nicho via Unsplash
    const fotosPorNicho: Record<string, string[]> = {
      'Renda Extra': ['https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=400','https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400','https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400'],
      'Salão de Cabelo / Beleza': ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=400','https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=400'],
      'Educação / Cursos': ['https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=400','https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400','https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400'],
      'Fitness / Saúde': ['https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400','https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400','https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=400'],
      'Tecnologia / Informática': ['https://images.unsplash.com/photo-1518770660439-4636190af475?w=400','https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400','https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400'],
      'Moda / Roupas': ['https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400','https://images.unsplash.com/photo-1467043237213-65f2da53396f?w=400','https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400'],
      'Lanchonete / Alimentação': ['https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=400','https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400'],
      'Mercadinho / Comércio': ['https://images.unsplash.com/photo-1534723452862-4c874018d66d?w=400','https://images.unsplash.com/photo-1542838132-92c53300491e?w=400','https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400'],
    };

    const fotos = fotosPorNicho[nicho] || fotosPorNicho['Renda Extra'];
    const catalogo = catalogoPorNicho[nicho] || catalogoPorNicho['Renda Extra'];

    try {
      setReformLog(`Salvando ${catalogo.length} produto(s)...`);
      const novosProds: Produto[] = [];
      for (let i = 0; i < catalogo.length; i++) {
        const item = catalogo[i];
        const precoFake = Math.round(item.preco * 1.7 / 5) * 5;
        const novoProd: Produto = {
          id: uid(),
          ts: Date.now(),
          dados: {
            vendedor_id: seller.id,
            nome: item.nome,
            descricao: item.descricao,
            preco: item.preco,
            preco_original: precoFake,
            ativo: true,
            conteudo_interno: item.conteudo,
            tem_conteudo_proprio: true,
            foto_url: fotos[i % fotos.length],
          }
        };
        await sbUpsert('produtos', novoProd);
        novosProds.push(novoProd);
      }
      setProducts(novosProds);
      setReformLog(`✅ ${catalogo.length} produto(s) criados com sucesso para o nicho "${nicho}"! Sua vitrine está pronta.`);
    } catch (err) {
      setReformLog('Erro ao criar produtos. Tente novamente.');
    } finally {
      setReformLoading(false);
    }
  };

  const reformularCatalogo = async () => {
    const nicho = reformNicho === 'Outro' ? reformNichoCustom.trim() : reformNicho;
    if (!nicho) { alert('Escolha ou descreva o nicho do seu negócio.'); return; }
    if (products.length === 0) { alert('Você não tem produtos cadastrados para reformular.'); return; }

    setReformLoading(true);
    setReformLog('Reformulando seus produtos...');

    // Templates locais de reformulação por nicho — sem chamada de API externa
    const prefixosPorNicho: Record<string, { nomePrefix: string; descSuffix: string }> = {
      'Renda Extra':            { nomePrefix: 'Kit Digital',    descSuffix: 'Ideal para quem quer gerar renda extra de forma rápida e prática.' },
      'Salão de Cabelo / Beleza': { nomePrefix: 'Serviço Premium', descSuffix: 'Realizado por profissional especializado com produtos de qualidade.' },
      'Educação / Cursos':      { nomePrefix: 'Curso Completo', descSuffix: 'Aprenda do zero ao avançado com didática clara e objetiva.' },
      'Fitness / Saúde':        { nomePrefix: 'Programa Fit',   descSuffix: 'Desenvolvido por especialistas para resultados reais e duradouros.' },
      'Tecnologia / Informática': { nomePrefix: 'Solução Tech',  descSuffix: 'Atendimento técnico especializado com garantia de qualidade.' },
      'Moda / Roupas':          { nomePrefix: 'Look Exclusivo',  descSuffix: 'Selecionado por consultora de estilo para valorizar sua imagem.' },
      'Lanchonete / Alimentação': { nomePrefix: 'Especial da Casa', descSuffix: 'Preparado na hora com ingredientes frescos e selecionados.' },
      'Mercadinho / Comércio':  { nomePrefix: 'Oferta Especial', descSuffix: 'Preço justo e qualidade garantida para você e sua família.' },
    };

    const template = prefixosPorNicho[nicho] || { nomePrefix: 'Produto', descSuffix: 'Qualidade garantida e atendimento personalizado.' };
    const prodsParaReformar = products;

    try {
      setReformLog('Salvando produtos atualizados...');
      const novosProds = [...products];
      let count = 0;
      for (let i = 0; i < prodsParaReformar.length; i++) {
        const prod = prodsParaReformar[i];
        const nomeBase = prod.dados.nome.replace(/^(Kit|Curso|Programa|Serviço|Solução|Look|Especial|Oferta)\s+/i, '').trim();
        const novoNome = `${template.nomePrefix} — ${nomeBase}`;
        const descBase = prod.dados.descricao || '';
        const novaDesc = descBase
          ? `${descBase} ${template.descSuffix}`
          : template.descSuffix;
        const updated = { ...prod, dados: { ...prod.dados, nome: novoNome, descricao: novaDesc } };
        await sbUpsert('produtos', updated);
        const gi = novosProds.findIndex(p => p.id === prod.id);
        if (gi !== -1) novosProds[gi] = updated;
        count++;
      }
      setProducts(novosProds);
      setReformLog(`✅ ${count} produto(s) reformulados com sucesso para o nicho "${nicho}"!`);
    } catch (err) {
      setReformLog('Erro ao reformular catálogo. Tente novamente.');
    } finally {
      setReformLoading(false);
    }
  };

  const handleDeleteProduct = async (prod: Produto) => {
    setConfirmDeleteProd(null);
    setDeletingProdId(prod.id);
    try {
      const ok = await sbDelete('produtos', prod.id);
      if (ok) {
        setProducts(prev => prev.filter(p => p.id !== prod.id));
        showProdToast('🗑️ Produto excluído!');
      } else {
        // Fallback via PATCH — marca como excluído (contorna RLS no DELETE)
        const salvou = await sbMarkDeleted('produtos', prod.id, prod.dados);
        if (salvou) {
          setProducts(prev => prev.filter(p => p.id !== prod.id));
          showProdToast('🗑️ Produto removido!');
        } else {
          showProdToast('❌ Erro ao excluir. Execute o SQL de permissão no Supabase.');
        }
      }
    } catch (err) {
      console.error('Erro ao excluir produto:', err);
      showProdToast('❌ Erro ao excluir. Verifique a conexão.');
    } finally {
      setDeletingProdId(null);
    }
  };

  const handleStartEdit = (prod: Produto) => {
    setEditingProd(prod);
    setNewProdName(prod.dados.nome);
    setNewProdDesc(prod.dados.descricao || '');
    setNewProdPrice(String(prod.dados.preco));
    setTemConteudoProprio(prod.dados.tem_conteudo_proprio || false);
    setNewProdConteudoInterno(prod.dados.conteudo_interno || '');
    setNewProdLink(prod.dados.link_original || '');
    // Scroll para o formulário
    setTimeout(() => document.getElementById('form-novo-produto')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Live preview modal state
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);

  // Form states: Custom AI Sales Agent
  const [agentName, setAgentName] = useState<string>('');
  const [corVitrine, setCorVitrine] = useState<string>('#f97316'); // cor padrão laranja
  const [agentNicho, setAgentNicho] = useState<string>('');
  const [agentPersonality, setAgentPersonality] = useState<string>('');
  const [agentActive, setAgentActive] = useState<boolean>(true);
  const [agentRecord, setAgentRecord] = useState<Agente | null>(null);

  // Form states: Spawn Customer support Q&A
  const [qaSelectedProd, setQaSelectedProd] = useState<string>('');
  const [qaBuyerName, setQaBuyerName] = useState<string>('');
  const [qaBuyerPhone, setQaBuyerPhone] = useState<string>('');
  const [qaList, setQaList] = useState<ProdutoQA[]>([]);
  const [generatedQaUrl, setGeneratedQaUrl] = useState<string>('');

  // Form states: Withdraw / Saque
  const [saqueAmount, setSaqueAmount] = useState<string>('');
  const [saquePix, setSaquePix] = useState<string>('');
  const [saqueBanco, setSaqueBanco] = useState<string>('');
  const [saqueFeedback, setSaqueFeedback] = useState<{ tipo: 'sucesso' | 'erro' | 'aviso'; msg: string } | null>(null);
  const [saqueLoading, setSaqueLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [seller.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Carrega informações atualizadas do vendedor
      const updatedSellers = await sbGetAll<Vendedor>('vendedores');
      const latestSeller = updatedSellers.find(s => s.id === seller.id);
      if (latestSeller) setSeller(latestSeller);

      const [prods, sld, wth, ags, qas, cfg, catProds] = await Promise.all([
        sbGetWhere<Produto>('produtos', 'vendedor_id', seller.id),
        sbGetWhere<Venda>('vendas', 'vendedor_id', seller.id),
        sbGetWhere<Saque>('saques', 'vendedor_id', seller.id),
        sbGetWhere<Agente>('agentes', 'vendedor_id', seller.id),
        sbGetWhere<ProdutoQA>('produtos_qa', 'vendedor_id', seller.id),
        sbGetConfig(),
        sbGetAll<any>('catalogo_paguseguro').catch(() => [])
      ]);

      setProducts(prods.filter(p => !p.dados?._excluido));
      setSales(sld);
      setWithdrawals(wth);
      setQaList(qas);
      setCatalogoPaguseguro(catProds?.filter((p: any) => p.dados?.ativo) || []); // todos ativos pela plataforma; o vendedor pode desativar individualmente
      if (cfg) setPlatformFees(cfg);

      // Carrega agente do vendedor
      if (ags && ags.length > 0) {
        const ag = ags[0];
        setAgentRecord(ag);
        setAgentName(ag.dados.nome_agente);
        setAgentNicho(ag.dados.nicho);
        if (ag.dados.cor_vitrine) setCorVitrine(ag.dados.cor_vitrine);
        setAgentPersonality(ag.dados.personalidade);
        setAgentActive(ag.dados.ativo);
      } else {
        // Valores padrão de inicialização de novo agente
        setAgentName(seller?.dados?.nome || 'Assistente Comercial');
        setAgentNicho('Consultoria Geral');
        setAgentPersonality('Você é amigável, acolhedor, pergunta as dores do cliente, responde de forma resumida e simpática, e no final motiva a compra por Pix de maneira amigável.');
        setAgentActive(true);
      }

      if (prods.length > 0) {
        setQaSelectedProd(prods[0].dados.nome);
      }
    } catch (e) {
      console.error('Error fetching seller analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auxiliares para conversão e controle de arquivos Base64
  const handleProductPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem do produto excede o limite máximo de 2MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewProdFotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleProductArchiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('O arquivo selecionado excede o limite de 2MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setNewProdArquivoBase64(reader.result as string);
      setNewProdArquivoTipo(file.type);
    };
    reader.readAsDataURL(file);
  };

  // Cadastrar Produto
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    if (!temConteudoProprio && !newProdLink) return;
    if (temConteudoProprio && !newProdConteudoInterno) return;
    if (parseFloat(newProdPrice) < 4) {
      showProdToast('❌ Valor mínimo por produto é R$ 4,00.');
      return;
    }

    // Modo edição
    if (editingProd) {
      const updated: Produto = {
        ...editingProd,
        dados: {
          ...editingProd.dados,
          nome: newProdName,
          descricao: newProdDesc,
          preco: parseFloat(newProdPrice),
          link_original: temConteudoProprio ? '' : newProdLink,
          foto_base64: newProdFotoBase64 || editingProd.dados.foto_base64,
          conteudo_interno: temConteudoProprio ? newProdConteudoInterno : undefined,
          tem_conteudo_proprio: temConteudoProprio,
          arquivo_base64: temConteudoProprio && newProdArquivoBase64 ? newProdArquivoBase64 : editingProd.dados.arquivo_base64,
          arquivo_tipo: temConteudoProprio && newProdArquivoTipo ? newProdArquivoTipo : editingProd.dados.arquivo_tipo,
          pre_lancamento: newProdPreLancamento,
          modo_local: newProdModoLocal,
          aceita_pagar_chegada: newProdModoLocal ? newProdAceitaChegada : undefined,
        }
      };
      try {
        await sbUpsert('produtos', updated);
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        setEditingProd(null);
        setNewProdName(''); setNewProdPrice(''); setNewProdDesc(''); setNewProdLink('');
        setNewProdFotoBase64(''); setTemConteudoProprio(false); setNewProdConteudoInterno('');
        setNewProdArquivoBase64(''); setNewProdArquivoTipo(''); setNewProdPreLancamento(false);
        setNewProdModoLocal(false); setNewProdAceitaChegada(false);
      } catch (err) {
        alert('Erro ao salvar edição.');
      }
      return;
    }

    const prodId = 'pd_' + uid();
    const novoProduto: Produto = {
      id: prodId,
      ts: Date.now(),
      dados: {
        vendedor_id: seller.id,
        nome: newProdName,
        descricao: newProdDesc,
        preco: parseFloat(newProdPrice),
        link_original: temConteudoProprio ? '' : newProdLink,
        ativo: true,
        foto_base64: newProdFotoBase64 || undefined,
        conteudo_interno: temConteudoProprio ? newProdConteudoInterno : undefined,
        tem_conteudo_proprio: temConteudoProprio,
        arquivo_base64: temConteudoProprio && newProdArquivoBase64 ? newProdArquivoBase64 : undefined,
        arquivo_tipo: temConteudoProprio && newProdArquivoTipo ? newProdArquivoTipo : undefined,
        pre_lancamento: newProdPreLancamento,
        modo_local: newProdModoLocal,
        aceita_pagar_chegada: newProdModoLocal ? newProdAceitaChegada : undefined,
      }
    };

    try {
      await sbUpsert('produtos', novoProduto);
      setProducts([novoProduto, ...products]);
      setNewProdName('');
      setNewProdPrice('');
      setNewProdDesc('');
      setNewProdLink('');
      setNewProdFotoBase64('');
      setTemConteudoProprio(false);
      setNewProdConteudoInterno('');
      setNewProdArquivoBase64('');
      setNewProdArquivoTipo('');
      setNewProdPreLancamento(false);
      setNewProdModoLocal(false);
      setNewProdAceitaChegada(false);
      
      // Auto selecionar para suporte QA se for o primeiro
      if (products.length === 0) {
        setQaSelectedProd(newProdName);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Alternar Status do Produto
  const toggleProductStatus = async (prod: Produto) => {
    const updated: Produto = {
      ...prod,
      dados: { ...prod.dados, ativo: !prod.dados.ativo }
    };
    try {
      await sbUpsert('produtos', updated);
      setProducts(products.map(p => p.id === prod.id ? updated : p));
      showProdToast(updated.dados.ativo ? '✅ Produto ativado!' : '⏸ Produto pausado!');
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCatalogItem = async (catId: string) => {
    const desativados: string[] = seller.dados.catalogo_desativado || [];
    const novoDesativados = desativados.includes(catId)
      ? desativados.filter(id => id !== catId)
      : [...desativados, catId];
    const updatedSeller = { ...seller, dados: { ...seller.dados, catalogo_desativado: novoDesativados } };
    try {
      await sbUpsert('vendedores', updatedSeller);
      setSeller(updatedSeller);
    } catch (e) { console.error(e); }
  };


  // Salvar Agente de IA Comercial
  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentName || !agentNicho || !agentPersonality) return;

    const recordId = agentRecord?.id || 'agent_' + uid();
    const novoAgente: Agente = {
      id: recordId,
      ts: Date.now(),
      dados: {
        vendedor_id: seller.id,
        nome_agente: agentName,
        personalidade: agentPersonality,
        nicho: agentNicho,
        ativo: agentActive,
        cor_vitrine: corVitrine
      }
    };

    try {
      await sbUpsert('agentes', novoAgente);
      setAgentRecord(novoAgente);
      showProdToast('✅ Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
    }
  };

  // Criar Atendimento Q&A (10 Perguntas)
  const handleCreateQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaSelectedProd || !qaBuyerName || !qaBuyerPhone) return;

    const foundProd = products.find(p => p.id === qaSelectedProd);
    const prodNome = foundProd ? foundProd.dados.nome : qaSelectedProd;
    const prodDesc = foundProd ? foundProd.dados.descricao : 'Material Digital Exclusivo';

    const qaId = 'qa_' + uid();
    const novoQA: ProdutoQA = {
      id: qaId,
      ts: Date.now(),
      dados: {
        vendedor_id: seller.id,
        produto_nome: prodNome,
        produto_desc: prodDesc,
        perguntas_usadas: 0,
        limite_perguntas: 10,
        comprador_nome: qaBuyerName,
        comprador_contato: qaBuyerPhone,
        historico_qa: []
      }
    };

    try {
      await sbUpsert('produtos_qa', novoQA);
      setQaList([novoQA, ...qaList]);
      
      // Gera URL de suporte
      const supportUrl = `${window.location.origin}${window.location.pathname}?qa=${qaId}`;
      setGeneratedQaUrl(supportUrl);

      setQaBuyerName('');
      setQaBuyerPhone('');
    } catch (err) {
      console.error(err);
    }
  };

  // Solicitar Saque / Transferência
  const handleRequestWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaqueFeedback(null);
    const value = parseFloat(saqueAmount);

    if (!value || value <= 0 || !saquePix || !saqueBanco) {
      setSaqueFeedback({ tipo: 'aviso', msg: '⚠️ Preencha todos os campos antes de continuar.' });
      return;
    }
    if (value < MINIMO_SAQUE) {
      setSaqueFeedback({ tipo: 'erro', msg: '❌ Valor mínimo para saque é de ' + fmt(MINIMO_SAQUE) + '.' });
      return;
    }
    if (value > seller.dados.saldo) {
      setSaqueFeedback({ tipo: 'erro', msg: '❌ Saldo insuficiente. Disponível: ' + fmt(seller.dados.saldo) + '.' });
      return;
    }
    if (value <= TAXA_SAQUE) {
      setSaqueFeedback({ tipo: 'erro', msg: '❌ O valor deve ser maior que a taxa de ' + fmt(TAXA_SAQUE) + '.' });
      return;
    }

    setSaqueLoading(true);
    const withdrawId = 'wq_' + uid();
    const feeVal = TAXA_SAQUE;
    const netVal = value - feeVal;

    const novoSaque: Saque = {
      id: withdrawId,
      ts: Date.now(),
      dados: {
        vendedor_id: seller.id,
        vendedor_nome: seller.dados.nome,
        valor: value,
        taxa_saque: feeVal,
        valor_liquido: netVal,
        chave_pix: saquePix,
        banco: saqueBanco,
        status: 'pendente',
        data_solicitacao: new Date().toLocaleDateString('pt-BR')
      }
    };

    const updatedSeller: Vendedor = {
      ...seller,
      dados: { ...seller.dados, saldo: seller.dados.saldo - value }
    };

    try {
      await Promise.all([
        sbUpsert('saques', novoSaque),
        sbUpsert('vendedores', updatedSeller)
      ]);
      setSeller(updatedSeller);
      setWithdrawals([novoSaque, ...withdrawals]);
      setSaqueAmount('');
      setSaquePix('');
      setSaqueBanco('');
      setSaqueFeedback({ tipo: 'sucesso', msg: '✅ Solicitação registrada! Você receberá o Pix em breve.' });

      await sendTelegram(ADMIN_CHAT_ID,
        '💸 <b>SOLICITAÇÃO DE SAQUE</b>\n\n' +
        '🏪 Vendedor: ' + seller.dados.nome + '\n' +
        '💰 Valor solicitado: R$ ' + value.toFixed(2) + '\n' +
        '📈 Taxa de Processamento: R$ ' + feeVal.toFixed(2) + '\n' +
        '💵 Valor Líquido a Enviar: R$ ' + netVal.toFixed(2) + '\n' +
        '🏦 Banco Destino: ' + saqueBanco + '\n' +
        '🔑 Chave Pix: <code>' + saquePix + '</code>\n' +
        '🆔 Solicitação ID: ' + withdrawId
      );
    } catch (err: any) {
      console.error(err);
      setSaqueFeedback({ tipo: 'erro', msg: '❌ Erro ao registrar no servidor. Tente novamente.' });
    } finally {
      setSaqueLoading(false);
    }
  };

  // Cálculos rápidos de Analytics
  const paidSales = sales.filter(s => s.dados.status_venda === 'pago');
  const revenueTotal = paidSales.reduce((acc, curr) => acc + curr.dados.valor, 0);
  const conversionRate = sales.length > 0 ? (paidSales.length / sales.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#06060a] text-gray-200 font-sans flex flex-col md:flex-row shadow-inner" id="dash_panel">
      
      {/* Toast de feedback */}
      {prodToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-700 text-white text-sm font-bold px-5 py-2.5 rounded-2xl shadow-xl animate-pulse">
          {prodToast}
        </div>
      )}

      {/* Sidebar Nav */}
      <aside className="w-full md:w-64 bg-[#0a0a10] border-b md:border-b-0 md:border-r border-gray-900 flex flex-col flex-shrink-0">
        
        {/* Logo Branding */}
        <div className="p-6 border-b border-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white text-base font-black shadow-inner">
              P
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-white font-display">PaguSeguro</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-400 font-mono">Plataforma</span>
                <span className="text-[9px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-1 py-0.2 rounded font-black font-mono">PRO</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={fetchDashboardData}
            title="Atualizar dados"
            className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-800 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Perfil Rápido do Vendedor */}
        <div className="p-4 bg-gradient-to-r from-red-950/10 to-transparent border-b border-gray-950 flex flex-col items-center text-center gap-2">
          <div className="relative group w-20 h-20">
            {seller.dados.avatar_base64 ? (
              <img 
                src={seller.dados.avatar_base64} 
                alt="Avatar" 
                className="w-20 h-20 rounded-full object-cover border-2 border-red-500"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500/40 flex items-center justify-center text-red-500 text-2xl font-bold uppercase select-none">
                {seller.dados.nome[0]}
              </div>
            )}
            
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer">
              <span className="text-[10px] text-white font-bold leading-tight">MUDAR</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    alert('O avatar excede o limite de 2MB.');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = async () => {
                    const base64 = reader.result as string;
                    const updatedSeller = {
                      ...seller,
                      dados: {
                        ...seller.dados,
                        avatar_base64: base64
                      }
                    };
                    try {
                      const success = await sbUpsert('vendedores', updatedSeller);
                      if (success) {
                        setSeller(updatedSeller);
                      }
                    } catch (err) {
                      console.error('Error updating profile avatar:', err);
                    }
                  };
                  reader.readAsDataURL(file);
                }} 
                className="hidden" 
              />
            </label>
          </div>
          <div className="overflow-hidden w-full">
            <p className="text-xs font-bold text-gray-200 truncate">{seller.dados.nome}</p>
            <p className="text-[10px] text-gray-500 font-mono truncate">{seller.dados.email}</p>
          </div>
        </div>

        {/* Menu Nav List */}
        <nav className="flex-1 p-4 space-y-1.5">
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'analytics' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Visão Geral / Analytics
          </button>

          <button
            onClick={() => setActiveTab('produtos')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'produtos' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Meus Produtos
          </button>

          <button
            onClick={() => setActiveTab('catalogo')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'catalogo' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Catálogo PaguSeguro
            {catalogoPaguseguro.length > 0 && <span className="ml-auto bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{catalogoPaguseguro.length}</span>}
          </button>

          <button 
            onClick={() => setActiveTab('vendas')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'vendas' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Vendas / Faturamento
          </button>

          <button 
            onClick={() => setActiveTab('saques')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'saques' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Saques / Saldo Pix
          </button>

          <button
            onClick={() => setActiveTab('tutorial')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'tutorial' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span>🎓</span>
            Tutorial & Guia
          </button>

          <button
            onClick={() => setActiveTab('agendamento')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'agendamento' ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-900/10' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span>📅</span>
            Agendamentos
          </button>
        </nav>

        {/* Logout Bottom */}
        <div className="p-4 border-t border-gray-900">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/5 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
            Desconectar da Plataforma
          </button>
        </div>
      </aside>

      {/* Main Container Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8">
        
        {/* Top Header Card */}
        <header className="bg-gradient-to-r from-[#10101b] to-[#07070b] border border-gray-900 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-red-600/15 text-red-500 border border-red-500/20 px-2.5 py-0.5 rounded-full font-bold font-mono">DASHBOARD DO PAINEL</span>
              <span className="text-[10px] bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 px-1.5 py-0.5 rounded font-black font-mono">CONTA PRO</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white font-display mt-1">Olá, {seller.dados.nome}!</h2>
            <p className="text-xs text-gray-400 mt-0.5">Seja bem vindo à nova versão PaguSeguro Pro</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={() => setShowLivePreview(true)}
              className="px-4 py-2 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-xs font-mono text-red-500 rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              👁 Visualizar Minha Vitrine
            </button>

            <a 
              href={`?u=${seller.dados.slug}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gray-900 border border-gray-800 hover:border-gray-700 text-xs font-mono text-gray-300 rounded-xl flex items-center gap-2 transition"
            >
              <Globe className="w-3.5 h-3.5 text-red-500" />
              Ver Minha Vitrine Comercial: /{seller.dados.slug}
            </a>
          </div>
        </header>

        {/* TAB 1: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6" id="tab_view_analytics">
            {/* Metricas Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#0b0b12] border border-gray-900 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <span className="text-gray-400 text-xs font-mono">Faturamento Total</span>
                <p className="text-xl font-black text-red-500 font-mono mt-2">{fmt(revenueTotal)}</p>
              </div>

              <div className="bg-[#0b0b12] border border-gray-900 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <span className="text-gray-400 text-xs font-mono">Saldo Disponível</span>
                <p className="text-xl font-black text-white font-mono mt-2">{fmt(seller.dados.saldo || 0)}</p>
              </div>

              <div className="bg-[#0b0b12] border border-gray-900 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <span className="text-gray-400 text-xs font-mono">Contratos Pagos</span>
                <p className="text-xl font-black text-green-400 font-mono mt-2">{paidSales.length} faturas</p>
              </div>

              <div className="bg-[#0b0b12] border border-gray-900 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
                <span className="text-gray-400 text-xs font-mono font-bold text-orange-400">Conversão pelo agente Pro</span>
                <p className="text-xl font-black text-white font-mono mt-2">{conversionRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Ultimas Vendas log e Status */}
            <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white font-display">Acompanhamento de Vendas Recentes</h3>
              {sales.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono text-center py-6">Nenhuma interação de faturamento capturada ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-mono text-xs">
                    <thead>
                      <tr className="border-b border-gray-900 text-gray-500">
                        <th className="py-3 px-2">Cliente</th>
                        <th className="py-3 px-2">Produto</th>
                        <th className="py-3 px-2">Valor</th>
                        <th className="py-3 px-2">Data</th>
                        <th className="py-3 px-2 text-right">Faturamento Pix</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-950">
                      {sales.slice(0, 10).map((venda) => (
                        <tr key={venda.id} className="hover:bg-gray-950/40">
                          <td className="py-3.5 px-2 font-medium text-white">{venda.dados.comprador_nome}</td>
                          <td className="py-3.5 px-2 text-gray-400">{venda.dados.produto_nome}</td>
                          <td className="py-3.5 px-2 font-bold text-gray-300">{fmt(venda.dados.valor)}</td>
                          <td className="py-3.5 px-2 text-gray-500">{venda.dados.data_venda}</td>
                          <td className="py-3.5 px-2 text-right">
                            <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                              venda.dados.status_venda === 'pago' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'
                            }`}>
                              {venda.dados.status_venda === 'pago' ? 'APROVADO' : 'PENDENTE'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MEUS PRODUTOS */}
        {activeTab === 'produtos' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="tab_view_produtos">
            
            {/* Esquerda: Cadastro de Novo Produto */}
            <div className="lg:col-span-4 bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl h-fit">
              <h3 className="text-base font-bold text-white font-display mb-1 flex items-center gap-1.5">
                <Plus className="w-5 h-5 text-red-500" />
                Novo Produto Comercial
              </h3>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">Cadastre manuais e infoprodutos protegidos com faturamento imediato.</p>

              <form onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Título Comercial</label>
                  <input 
                    type="text" 
                    value={newProdName} 
                    onChange={(e) => setNewProdName(e.target.value)}
                    required
                    placeholder="Ex: Fórmula Enriquecimento Digital"
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600"
                  />
                </div>


                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Preço BRL (Pix)</label>
                  <input 
                    type="number" 
                    value={newProdPrice} 
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    required
                    placeholder="Ex: 47.90"
                    step="0.01"
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Foto do Produto (Opcional)</label>
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    onChange={handleProductPhotoChange}
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-red-600 file:text-white hover:file:bg-red-700 cursor-pointer"
                  />
                  {newProdFotoBase64 && (
                    <div className="mt-3 relative w-[120px] h-[120px] rounded-lg border border-gray-800 overflow-hidden bg-black flex items-center justify-center">
                      <img src={newProdFotoBase64} alt="Preview do produto" className="object-cover w-full h-full" referrerPolicy="no-referrer" />
                      <button 
                        type="button" 
                        onClick={() => setNewProdFotoBase64('')}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Detalhamento do Produto</label>
                  <textarea 
                    value={newProdDesc} 
                    onChange={(e) => setNewProdDesc(e.target.value)}
                    required
                    placeholder="Descreva os pontos fortes, benefícios e diferenciais do produto..."
                    rows={4}
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600 leading-relaxed"
                  />
                </div>

                {/* TOGGLE ENTREGA METODO */}
                <div className="space-y-1">
                  <label className="block text-[10px] text-gray-400 font-mono uppercase font-semibold">Forma de Entrega</label>
                  <div className="flex bg-[#12121e] border border-gray-800 rounded-xl p-1 gap-1">
                    <button
                      type="button"
                      onClick={() => setTemConteudoProprio(false)}
                      className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        !temConteudoProprio ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Link Externo
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemConteudoProprio(true)}
                      className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                        temConteudoProprio ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Conteúdo Próprio
                    </button>
                  </div>
                </div>

                {/* Seletor de canal de entrega */}
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-2 uppercase font-bold">Canal de Entrega</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'conteudo', label: '📄 Conteúdo', desc: 'Texto na plataforma' },
                      { key: 'link_externo', label: '🔗 Link externo', desc: 'Drive, etc.' },
                      { key: 'telegram', label: '✈️ Telegram', desc: 'Link do grupo/canal' },
                    ].map(op => (
                      <button key={op.key} type="button"
                        onClick={() => { setCanalEntrega(op.key as any); setTemConteudoProprio(op.key === 'conteudo'); }}
                        className={`p-2 rounded-xl border text-left transition ${canalEntrega === op.key ? 'border-red-500 bg-red-500/10 text-white' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}
                      >
                        <p className="text-[10px] font-bold">{op.label}</p>
                        <p className="text-[9px] opacity-70 mt-0.5">{op.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {canalEntrega === 'conteudo' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase font-semibold">Conteúdo do Produto (Entregue no Pós-Pago)</label>
                      <textarea 
                        value={newProdConteudoInterno} 
                        onChange={(e) => setNewProdConteudoInterno(e.target.value)}
                        required={canalEntrega === 'conteudo'}
                        placeholder="Escreva aqui o conteúdo secreto que o cliente receberá após pagar..."
                        rows={5}
                        className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600 leading-relaxed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase font-semibold">Mídia / Arquivo de Entrega (Opcional - Máx 2MB)</label>
                      <input 
                        type="file" 
                        accept="image/*,video/*,application/pdf"
                        onChange={handleProductArchiveChange}
                        className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-400 file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#1f1f2e] file:text-gray-300 hover:file:bg-gray-700 cursor-pointer"
                      />
                      {newProdArquivoBase64 && (
                        <p className="text-[10px] text-green-400 font-mono mt-1">✓ Arquivo carregado com sucesso ({newProdArquivoTipo?.split('/')[1] || 'mídia'})</p>
                      )}
                    </div>
                  </div>
                ) : canalEntrega === 'link_externo' ? (
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Link do Material / Produto Digital</label>
                    <input
                      type="url"
                      value={newProdLink}
                      onChange={(e) => setNewProdLink(e.target.value)}
                      required={canalEntrega === 'link_externo'}
                      placeholder="Ex: https://drive.google.com/arquivo"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Link do Telegram (grupo, canal ou bot)</label>
                    <input
                      type="url"
                      value={newProdLink}
                      onChange={(e) => setNewProdLink(e.target.value)}
                      required={canalEntrega === 'telegram'}
                      placeholder="Ex: https://t.me/seugrupopago"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-600"
                    />
                    <p className="text-[9px] text-gray-600 mt-1">O link será entregue ao comprador após confirmação do pagamento.</p>
                  </div>
                )}

                {/* TOGGLE MODO LOCAL */}
                <div className="flex items-center justify-between bg-[#12121e] border border-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-gray-200">🏪 Serviço Presencial</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">Salão, estúdio, loja física — cliente agenda e vai até você</p>
                  </div>
                  <button type="button" onClick={() => setNewProdModoLocal(v => !v)}
                    className={'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ' + (newProdModoLocal ? 'bg-red-600' : 'bg-gray-700')}>
                    <span className={'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (newProdModoLocal ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>

                {newProdModoLocal && (
                  <div className="flex items-center justify-between bg-[#0e0e1a] border border-gray-800 rounded-xl px-4 py-3 ml-3">
                    <div>
                      <p className="text-xs font-bold text-gray-300">💵 Aceitar pagamento na chegada</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">Cliente pode reservar sem pagar agora</p>
                    </div>
                    <button type="button" onClick={() => setNewProdAceitaChegada(v => !v)}
                      className={'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ' + (newProdAceitaChegada ? 'bg-green-600' : 'bg-gray-700')}>
                      <span className={'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (newProdAceitaChegada ? 'translate-x-5' : 'translate-x-0')} />
                    </button>
                  </div>
                )}

                {/* TOGGLE PRÉ-LANÇAMENTO */}
                <div className="flex items-center justify-between bg-[#12121e] border border-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-gray-200">🚀 Pré-lançamento</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">Clientes poderão agendar com 10% de desconto antes do lançamento</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewProdPreLancamento(v => !v)}
                    className={'relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ' + (newProdPreLancamento ? 'bg-red-600' : 'bg-gray-700')}
                  >
                    <span className={'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ' + (newProdPreLancamento ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full mt-2.5 py-2.5 bg-red-600 hover:bg-red-700 transition font-bold text-xs text-white uppercase rounded-xl tracking-wider shadow-lg cursor-pointer"
                >
                  Confirmar Cadastro
                </button>
              </form>
            </div>

            {/* Direita: Lista dos Produtos */}
            <div className="lg:col-span-8 bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-base font-bold text-white font-display">Seus Produtos Digitais Cadastrados</h3>
                <button
                  onClick={() => { setShowReformulador(!showReformulador); setReformLog(''); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/15 border border-purple-500/30 hover:bg-purple-600/25 text-purple-300 text-xs font-bold rounded-xl transition"
                >
                  ✨ Reformular Catálogo com Agente Pro
                </button>
              </div>

              {/* Painel do Reformulador */}
              {showReformulador && (
                <div className="mb-5 p-5 bg-[#130e1f] border border-purple-800/40 rounded-2xl space-y-4">
                  <p className="text-xs text-gray-300 leading-relaxed">O Agente Pro vai reescrever nome e descrição de todos os seus produtos de forma profissional, alinhada ao seu nicho.</p>
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-2 uppercase">Qual é o seu nicho?</label>
                    <div className="flex flex-wrap gap-2">
                      {NICHOS_REFORMA.map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => { setReformNicho(n); setReformNichoCustom(''); }}
                          className={`px-3 py-1.5 text-xs rounded-xl border transition font-medium ${reformNicho === n ? 'bg-purple-600 border-purple-500 text-white' : 'bg-[#0e0e16] border-gray-700 text-gray-400 hover:border-purple-600 hover:text-purple-300'}`}
                        >{n}</button>
                      ))}
                    </div>
                  </div>
                  {reformNicho === 'Outro' && (
                    <input
                      type="text"
                      value={reformNichoCustom}
                      onChange={e => setReformNichoCustom(e.target.value)}
                      placeholder="Descreva seu nicho (ex: pet shop, academia, imóveis...)"
                      className="w-full bg-[#0e0e16] border border-gray-700 focus:border-purple-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100 placeholder-gray-600"
                    />
                  )}
                  {reformLog && (
                    <p className={`text-xs font-mono px-3 py-2 rounded-xl ${reformLog.startsWith('✅') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800/50 text-gray-400'}`}>
                      {reformLog}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={products.length === 0 ? criarVitrineIA : reformularCatalogo}
                    disabled={reformLoading || !reformNicho}
                    className="w-full flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl px-4 py-2.5 transition"
                  >
                    {reformLoading ? (
                      <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Agente Pro trabalhando...</>
                    ) : products.length === 0 ? <>✨ Criar Vitrine com Agente Pro</> : <>🤖 Reformular Catálogo Agora</>}
                  </button>
                </div>
              )}
              {products.length === 0 ? (
                <div className="p-8 text-center space-y-4">
                  <div className="text-4xl">🏪</div>
                  <p className="text-gray-400 text-sm font-bold">Sua vitrine está vazia!</p>
                  <p className="text-gray-500 text-xs">Nenhum produto cadastrado ainda. Use o Agente Pro para criar sua vitrine completa automaticamente.</p>
                  <button
                    onClick={() => setShowReformulador(true)}
                    className="mx-auto flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold text-xs rounded-xl transition shadow-lg"
                  >
                    ✨ Criar minha vitrine com Agente Pro
                  </button>
                  <p className="text-[10px] text-gray-600">Ou adicione produtos manualmente pelo formulário ao lado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.map((prod) => (
                    <div key={prod.id} className="p-4 bg-[#0e0e15] border border-gray-800 hover:border-gray-700 rounded-2xl flex flex-col md:flex-row md:items-start md:items-center justify-between gap-4 transition duration-200">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Thumbnail */}
                        {prod.dados.foto_base64 ? (
                          <img 
                            src={prod.dados.foto_base64} 
                            alt={prod.dados.nome} 
                            className="w-[60px] h-[60px] object-cover rounded-lg border border-gray-800 flex-shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-[60px] h-[60px] bg-[#12121e] rounded-lg border border-gray-800 flex items-center justify-center text-xl flex-shrink-0">
                            🛍️
                          </div>
                        )}

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white font-display text-sm truncate">{prod.dados.nome}</span>
                            <span className={'px-1.5 py-0.2 rounded font-mono text-[9px] font-black ' + (prod.dados.ativo ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800 text-gray-400')}>
                              {prod.dados.ativo ? 'ATIVO' : 'PAUSADO'}
                            </span>
                            {prod.dados.pre_lancamento && (
                              <span className="px-1.5 py-0.2 rounded font-mono text-[9px] font-black bg-orange-500/10 text-orange-400 border border-orange-500/20">🚀 PRÉ-LANÇAMENTO</span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs line-clamp-2 max-w-xl font-sans leading-relaxed">{prod.dados.descricao}</p>
                          {prod.dados.tem_conteudo_proprio ? (
                            <span className="inline-block text-[9px] bg-red-600/15 text-red-400 border border-red-500/10 rounded px-1.5 py-0.5 font-sans font-bold">★ CONTEÚDO PRÓPRIO INTEGRADO</span>
                          ) : (
                            <p className="text-[10px] text-gray-600 font-mono truncate">Link: <a href={prod.dados.link_original} target="_blank" className="hover:underline text-gray-400">{prod.dados.link_original}</a></p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:self-center self-end flex-shrink-0">
                        <span className="text-red-500 font-black font-mono text-base">{fmt(prod.dados.preco)}</span>
                        
                        {/* Ver conteúdo — só aparece se tem conteudo_interno */}
                        {prod.dados.conteudo_interno && (
                          <button
                            onClick={() => setModalConteudo(prod)}
                            title="Ver conteúdo digital"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}

                        {/* Editar */}
                        <button
                          onClick={() => handleStartEdit(prod)}
                          title="Editar produto"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>

                        {/* Excluir */}
                        <button
                          onClick={() => setConfirmDeleteProd(prod)}
                          title="Excluir produto"
                          disabled={deletingProdId === prod.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-40"
                        >
                          {deletingProdId === prod.id ? (
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          )}
                        </button>

                        {/* Toggle ativo/inativo */}
                        <button 
                          onClick={() => toggleProductStatus(prod)}
                          title={prod.dados.ativo ? "Pausar vendas" : "Ativar vendas"}
                          className="p-1 text-gray-400 hover:text-white transition"
                        >
                          {prod.dados.ativo ? (
                            <ToggleRight className="w-8 h-8 text-red-500 focus:outline-none" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-gray-600 focus:outline-none" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ajustar Inteligência Comercial e Q&A integrado na tab_produtos */}
            <div className="lg:col-span-12 border-t border-gray-900 pt-8 mt-10">
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-5 h-5 text-red-500 font-display" />
                <h3 className="text-lg font-bold text-white font-display">Meu Assistente de Vendas</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Esquerda: Personalizar Agente comercial */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-5 h-5 text-orange-500 animate-pulse" />
                        <h4 className="text-sm font-bold text-white font-display">Personalidade de Vendas</h4>
                      </div>
                      <p className="text-xs text-gray-400 leading-relaxed font-sans mt-1">Inscreva o manual de objeções, tom de faturamento e nome do seu representante.</p>
                    </div>

                    <form onSubmit={handleSaveAgent} className="space-y-4 font-mono text-xs">
                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Nome do Consultor (Comprador verá este nome)</label>
                        <input 
                          type="text" 
                          value={agentName}
                          onChange={(e) => setAgentName(e.target.value)}
                          required
                          placeholder="Ex: Consultor Patrícia"
                          className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Nicho de Venda / Área de Atuação</label>
                        <input 
                          type="text" 
                          value={agentNicho}
                          onChange={(e) => setAgentNicho(e.target.value)}
                          required
                          placeholder="Ex: Treinamentos VIP"
                          className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Personalidade / Instruções Secretas</label>
                        <textarea 
                          value={agentPersonality}
                          onChange={(e) => setAgentPersonality(e.target.value)}
                          required
                          rows={6}
                          placeholder="Ex: Sou persuasivo, tiro dúvidas e guio o cliente a fazer o faturamento Pix..."
                          className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-101 leading-relaxed font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Cor da Vitrine</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={corVitrine}
                            onChange={(e) => setCorVitrine(e.target.value)}
                            className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                          />
                          <div className="flex gap-2 flex-wrap">
                            {['#f97316','#ef4444','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#1d4ed8'].map(cor => (
                              <button
                                key={cor}
                                type="button"
                                onClick={() => setCorVitrine(cor)}
                                style={{ background: cor, width: 24, height: 24, borderRadius: 6, border: corVitrine === cor ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">{corVitrine}</span>
                        </div>
                        <p className="text-[9px] text-gray-600 mt-1">Esta cor aparece na vitrine pública dos seus clientes.</p>
                      </div>

                      {/* Toggle Usar Agente */}
                      <div className="bg-[#0e0e15] border border-gray-800 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-white mb-0.5">🤖 Usar Agente de Vendas</p>
                            <p className="text-[10px] text-gray-500 leading-relaxed">Quando ativo, o agente aborda visitantes automaticamente. Você paga <span className="text-yellow-400 font-bold">25% apenas por venda convertida</span> — se não vender, não paga nada.</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const novoAtivo = !agentActive;
                              setAgentActive(novoAtivo);
                              // Salva imediatamente no Supabase
                              if (agentRecord) {
                                const updated: Agente = { ...agentRecord, dados: { ...agentRecord.dados, ativo: novoAtivo } };
                                await sbUpsert('agentes', updated);
                                setAgentRecord(updated);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${agentActive ? 'bg-green-500' : 'bg-gray-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${agentActive ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                        <p className={`text-[10px] font-bold ${agentActive ? 'text-green-400' : 'text-gray-500'}`}>
                          {agentActive ? '✅ Agente ativo — convertendo visitantes 24h' : '⏸ Agente pausado — sem atendimento automático'}
                        </p>
                      </div>

                      <button 
                        type="submit"
                        className="w-full py-2.5 bg-red-650 hover:bg-red-750 font-bold font-sans text-xs text-white rounded-xl uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Salvar Configurações
                      </button>
                    </form>
                  </div>
                </div>

                {/* Direita: Modulo Q&A Geradora de links 10 Perguntas */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
                    <div>
                      <h4 className="text-sm font-bold text-white font-display mb-1">Módulo Q&A (Suporte Pós-Venda de 10 Consultas)</h4>
                      <p className="text-xs text-gray-400 font-sans leading-relaxed">
                        Gere um link amigável exclusivo para seu cliente. Ele poderá fazer até 10 perguntas à nossa especialista dedicada de suporte do seu produto.
                      </p>
                    </div>

                    <form onSubmit={handleCreateQA} className="space-y-4 font-mono text-xs">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Escolher Produto</label>
                          <select 
                            value={qaSelectedProd}
                            onChange={(e) => setQaSelectedProd(e.target.value)}
                            className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                          >
                            <option value="">Selecionar produto...</option>
                            {products.filter(p => !p.dados._excluido && p.dados.ativo).map(p => (
                              <option key={p.id} value={p.id}>{p.dados.nome}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Nome do Comprador</label>
                          <input 
                            type="text" 
                            value={qaBuyerName}
                            onChange={(e) => setQaBuyerName(e.target.value)}
                            required
                            placeholder="Ex: João da Silva"
                            className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Contato do Comprador</label>
                        <input 
                          type="text" 
                          value={qaBuyerPhone}
                          onChange={(e) => setQaBuyerPhone(e.target.value)}
                          required
                          placeholder="Ex: joao@email.com ou (11) 98888-8888"
                          className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                        />
                      </div>

                      <button 
                        type="submit"
                        disabled={products.length === 0}
                        className="w-full py-2 bg-gradient-to-r from-red-650 to-rose-650 hover:from-red-750 hover:to-rose-750 disabled:opacity-50 font-bold font-sans text-xs text-white rounded-xl uppercase tracking-wider transition cursor-pointer"
                      >
                        Gerar Atendimento Q&A
                      </button>
                    </form>

                    {/* Exibição se gerado */}
                    {generatedQaUrl && (
                      <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl text-xs space-y-2 font-mono">
                        <span className="text-yellow-400 font-bold flex items-center gap-1">
                          <Ticket className="w-4 h-4" />
                          Link de Atendimento Q&A Gerado!
                        </span>
                        <input 
                          type="text" 
                          value={generatedQaUrl} 
                          readOnly 
                          className="w-full bg-[#12121f] text-gray-300 border border-gray-850 rounded px-2.5 py-1.5 focus:outline-none text-[10px]"
                          onClick={(e) => (e.target as any).select()}
                        />
                        <p className="text-[10px] text-gray-500">Envie o link acima diretamente no suporte técnico do seu comprador.</p>
                      </div>
                    )}

                    {/* Historico de Links QA Gerados */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-gray-300 font-sans">Histórico de Atendimentos Q&A Criados</h4>
                      {qaList.length === 0 ? (
                        <p className="text-[10px] text-gray-500 font-mono">Nenhum atendimento gerado para controle ainda.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {qaList.map((qaItem) => (
                            <div key={qaItem.id} className="p-3 bg-[#0a0a0f] border border-gray-900 rounded-xl flex items-center justify-between text-xs gap-3 font-mono">
                              <div className="overflow-hidden">
                                <p className="font-bold text-gray-200 truncate">{qaItem.dados.comprador_nome}</p>
                                <p className="text-[10px] text-gray-500 truncate">{qaItem.dados.produto_nome}</p>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] ${
                                  qaItem.dados.perguntas_usadas >= 10 ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-400'
                                }`}>
                                  {qaItem.dados.perguntas_usadas} / 10 perguntas
                                </span>
                                <a 
                                  href={`?qa=${qaItem.id}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-gray-800 hover:bg-gray-750 text-[10px] rounded text-gray-400 hover:text-white transition cursor-pointer"
                                >
                                  Portal
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VENDAS / FATURAMENTO */}
        {/* ABA TUTORIAL */}
        {activeTab === 'tutorial' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#0c0c14] border border-gray-900 rounded-2xl p-5">
              <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">🎓 Guia de Início Rápido</h3>
              <p className="text-gray-400 text-xs mb-4">Siga estas etapas para configurar sua vitrine e começar a vender.</p>
              <div className="space-y-3">
                {[
                  { step: 1, titulo: 'Cadastre seu produto', desc: 'Vá em "Meus Produtos" → clique em "+ Novo Produto" → preencha nome, preço, descrição e foto.', done: products.length > 0 },
                  { step: 2, titulo: 'Configure seu assistente', desc: 'Vá em "Meu Representante" → defina o nome, nicho e personalidade do assistente que vai atender seus clientes.', done: false },
                  { step: 3, titulo: 'Escolha a cor da vitrine', desc: 'Ainda em "Meu Representante", selecione a cor que vai aparecer na sua vitrine pública.', done: false },
                  { step: 4, titulo: 'Compartilhe sua vitrine', desc: 'Copie o link da sua vitrine e envie para seus clientes. O link aparece no topo do painel.', done: false },
                  { step: 5, titulo: 'Aguarde o cliente comprar', desc: 'Quando um cliente solicitar, você receberá uma notificação no Telegram. Cole o código Pix no painel admin para liberar o acesso.', done: false },
                  { step: 6, titulo: 'Saque seu saldo', desc: 'Após confirmar o pagamento, seu saldo é creditado automaticamente. Solicite saque em "Saques / Saldo Pix".', done: false },
                ].map(({ step, titulo, desc, done }) => (
                  <div key={step} className={`flex gap-3 p-3 rounded-xl border ${done ? 'border-green-500/30 bg-green-500/5' : 'border-gray-800 bg-[#0a0a12]'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
                      {done ? '✓' : step}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${done ? 'text-green-400' : 'text-white'}`}>{titulo}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#0c0c14] border border-gray-900 rounded-2xl p-5">
              <h3 className="text-white font-bold text-sm mb-3">📋 Como funciona o sistema</h3>
              <div className="space-y-2 text-xs text-gray-400">
                <p>• Seu cliente acessa sua vitrine pelo link personalizado</p>
                <p>• O assistente inicia uma conversa automática após 30 segundos</p>
                <p>• O cliente escolhe o produto e solicita o Pix</p>
                <p>• Você recebe notificação no Telegram com os dados</p>
                <p>• Você gera o Pix manualmente e cola no painel admin</p>
                <p>• O cliente recebe o código Pix na tela e paga</p>
                <p>• Você confirma o pagamento → saldo é creditado automaticamente</p>
                <p>• O cliente recebe acesso ao produto imediatamente</p>
              </div>
            </div>
          </div>
        )}

        {/* ABA AGENDAMENTO */}
        {activeTab === 'agendamento' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-[#0c0c14] border border-gray-900 rounded-2xl p-5">
              <h3 className="text-white font-bold text-base mb-1 flex items-center gap-2">📅 Pré-Agendamento & Pré-Compra</h3>
              <p className="text-gray-400 text-xs mb-4">Gerencie agendamentos e pré-vendas dos seus clientes.</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-[#0a0a12] border border-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">0</p>
                  <p className="text-[10px] text-gray-500 font-mono">AGENDAMENTOS HOJE</p>
                </div>
                <div className="bg-[#0a0a12] border border-gray-800 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">0</p>
                  <p className="text-[10px] text-gray-500 font-mono">PRÉ-VENDAS ATIVAS</p>
                </div>
              </div>

              <div className="border border-dashed border-gray-800 rounded-xl p-6 text-center">
                <p className="text-3xl mb-2">📅</p>
                <p className="text-white text-sm font-semibold mb-1">Nenhum agendamento ainda</p>
                <p className="text-gray-500 text-xs">Quando seus clientes agendarem pela vitrine, aparecerão aqui.</p>
              </div>

              <div className="mt-4 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-400 text-xs font-semibold mb-1">💡 Como ativar agendamentos na vitrine?</p>
                <p className="text-gray-400 text-[11px]">No cadastro do produto, ative a opção "Permitir Agendamento". Seus clientes poderão escolher data e hora na vitrine antes de pagar.</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'catalogo' && (
          <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white font-display mb-1">Catálogo PaguSeguro</h3>
              <p className="text-gray-400 text-xs">Produtos prontos pra você vender agora. Sem criar nada — só divulgar o link da sua vitrine. Você ganha 45% de cada venda.</p>
            </div>

            {catalogoPaguseguro.length === 0 ? (
              <div className="text-center py-12 text-gray-600 text-xs font-mono">
                Nenhum produto disponível no catálogo ainda. Em breve!
              </div>
            ) : (
              <div className="grid gap-4">
                {catalogoPaguseguro.map((cat: any) => {
                  const desativados: string[] = seller.dados.catalogo_desativado || [];
                  const isAtivo = !desativados.includes(cat.id);
                  const comissaoVendedor = parseFloat((cat.dados.preco * 0.45).toFixed(2));
                  const taxaPlataforma = parseFloat((cat.dados.preco * 0.55).toFixed(2));
                  return (
                    <div key={cat.id} className={`bg-[#0e0e15] border rounded-2xl p-5 transition ${isAtivo ? 'border-gray-800' : 'border-gray-900 opacity-60'}`}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex gap-3 flex-1">
                          {cat.dados.foto_base64 ? (
                            <img src={cat.dados.foto_base64} alt={cat.dados.nome} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-700" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0 text-2xl">📦</div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-white">{cat.dados.nome}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-red-600/15 text-red-400 border border-red-500/10">CATÁLOGO</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${isAtivo ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-gray-800 text-gray-500'}`}>
                                {isAtivo ? 'ATIVO' : 'PAUSADO'}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs leading-relaxed">{cat.dados.descricao}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <p className="text-white font-bold text-base">{fmt(cat.dados.preco)}</p>
                          <button
                            onClick={() => toggleCatalogItem(cat.id)}
                            title={isAtivo ? 'Pausar' : 'Ativar'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isAtivo ? 'bg-green-500' : 'bg-gray-700'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${isAtivo ? 'translate-x-6' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-3 bg-[#12121e] rounded-xl px-4 py-3 mb-3">
                        <div className="flex-1 text-center">
                          <p className="text-green-400 font-bold text-sm">{fmt(comissaoVendedor)}</p>
                          <p className="text-[10px] text-gray-500">você ganha (45%)</p>
                        </div>
                        <div className="w-px bg-gray-800" />
                        <div className="flex-1 text-center">
                          <p className="text-red-400 font-bold text-sm">{fmt(taxaPlataforma)}</p>
                          <p className="text-[10px] text-gray-500">plataforma (55%)</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono text-center">
                        ✅ Divulgue o link da sua vitrine — a PaguSeguro entrega o produto e repassa sua comissão automaticamente
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3">
              <p className="text-yellow-400 text-xs font-semibold mb-1">💡 Como funciona?</p>
              <p className="text-gray-400 text-[11px] leading-relaxed">Os produtos do catálogo já aparecem automaticamente na sua vitrine pública. Quando alguém comprar, a PaguSeguro entrega o conteúdo e credita 45% do valor na sua carteira.</p>
            </div>
          </div>
        )}

        {activeTab === 'vendas' && (
          <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-6" id="tab_view_vendas">
            <div>
              <h3 className="text-base font-bold text-white font-display mb-1">Livro de Caixa & Faturamento</h3>
              <p className="text-xs text-gray-400 font-mono">Abaixo constam as cobranças geradas por sua equipe consultiva de IA.</p>
            </div>

            {sales.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-12">Nenhuma venda gerada ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-gray-900 text-gray-500">
                      <th className="py-3 px-2">Identificador</th>
                      <th className="py-3 px-2">Cliente Comprador</th>
                      <th className="py-3 px-2">Contato / Fone</th>
                      <th className="py-3 px-2">Produto Comprado</th>
                      <th className="py-3 px-2">Data da Cobrança</th>
                      <th className="py-3 px-2 text-right">Preço Bruto</th>
                      <th className="py-3 px-2 text-right">Retenção (25%)</th>
                      <th className="py-3 px-2 text-right">Valor Líquido</th>
                      <th className="py-3 px-2 text-right">Compensação Pix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-950">
                    {sales.map((venda) => (
                      <tr key={venda.id} className="hover:bg-gray-950/40">
                        <td className="py-3.5 px-2 text-gray-600 text-[10px]">{venda.id}</td>
                        <td className="py-3.5 px-2 font-bold text-white">{venda.dados.comprador_nome}</td>
                        <td className="py-3.5 px-2 text-gray-400">{venda.dados.comprador_telefone}</td>
                        <td className="py-3.5 px-2 text-gray-400">{venda.dados.produto_nome}</td>
                        <td className="py-3.5 px-2 text-gray-500">{venda.dados.data_venda}</td>
                        <td className="py-3.5 px-2 text-right text-gray-400 font-bold">{fmt(venda.dados.valor)}</td>
                        <td className="py-3.5 px-2 text-right text-red-500/80">
                          {venda.dados.status_venda === 'pago' ? fmt(venda.dados.taxa_plataforma ?? parseFloat((venda.dados.valor * 0.25).toFixed(2))) : '-'}
                        </td>
                        <td className="py-3.5 px-2 text-right text-green-400 font-semibold">
                          {venda.dados.status_venda === 'pago' ? fmt(venda.dados.valor_liquido ?? parseFloat((venda.dados.valor * 0.75).toFixed(2))) : '-'}
                        </td>
                        <td className="py-3.5 px-2 text-right font-semibold">
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                            venda.dados.status_venda === 'pago' ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {venda.dados.status_venda === 'pago' ? 'PAGA' : 'AGUARDANDO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}



        {/* TAB 5: SAQUES / SOLICITAR TRANSFERENCIA */}
        {activeTab === 'saques' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="tab_view_saques">
            
            {/* Solicitar saque */}
            <div className="lg:col-span-5 bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl h-fit space-y-4">
              <div>
                <h3 className="text-base font-bold text-white font-display mb-1 flex items-center gap-1.5">
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                  Transferência de Saldo Líquido
                </h3>
                <p className="text-xs text-gray-400 font-sans">Receba seus faturamentos compensados direto na sua chave Pix cadastrada.</p>
              </div>

              <div className="p-4 bg-[#07070d] border border-gray-950 rounded-2xl flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-500 font-mono">Disponível para Resgate</span>
                  <p className="text-2xl font-black text-white font-mono mt-0.5">{fmt(seller.dados.saldo || 0)}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-500 font-mono">Pendente de Entrega</span>
                  <p className="text-sm font-bold text-gray-400 font-mono mt-0.5">{fmt(seller.dados.saldo_pendente || 0)}</p>
                </div>
              </div>

              <form onSubmit={handleRequestWithdrawal} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Valor a Sacar (BRL)</label>
                  <input 
                    type="number" 
                    value={saqueAmount} 
                    onChange={(e) => setSaqueAmount(e.target.value)}
                    required
                    placeholder="Ex: 50.00"
                    step="0.01"
                    className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Sua Chave Pix</label>
                  <input 
                    type="text" 
                    value={saquePix} 
                    onChange={(e) => setSaquePix(e.target.value)}
                    required
                    placeholder="E-mail, Telefone, CPF ou Aleatória"
                    className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Instituição Bancária</label>
                  <input 
                    type="text" 
                    value={saqueBanco} 
                    onChange={(e) => setSaqueBanco(e.target.value)}
                    required
                    placeholder="Ex: Nubank, Itaú, Inter"
                    className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                  />
                </div>

                {parseFloat(saqueAmount) > 0 && (
                  <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-2xl space-y-2 text-xs">
                    <p className="font-bold text-orange-400 font-sans">Resumo Financeiro da Solicitação:</p>
                    <div className="flex justify-between font-mono text-[11px] text-gray-300">
                      <span>Valor de Resgate Bruto:</span>
                      <span>{fmt(parseFloat(saqueAmount) || 0)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-[11px] text-red-400">
                      <span>Taxa de Saque Descontada (Taxa Pix Fixa):</span>
                      <span>-{fmt(TAXA_SAQUE)}</span>
                    </div>
                    <div className="border-t border-gray-900 pt-1.5 flex justify-between font-mono text-xs text-green-400 font-bold">
                      <span>Valor Líquido Recebido:</span>
                      <span>{fmt(Math.max(0, (parseFloat(saqueAmount) || 0) - TAXA_SAQUE))}</span>
                    </div>
                  </div>
                )}

                <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-[10px] leading-relaxed text-gray-400 font-sans">
                  A taxa de saque cobrada de {fmt(TAXA_SAQUE)} é regulada pelas diretrizes PaguSeguro Pro e atualizada pelo gestor master. O processamento ocorre de forma imediata via Pix.
                </div>

                {saqueFeedback && (
                  <div className={
                    'px-4 py-3 rounded-xl text-xs font-sans font-semibold flex items-center gap-2 ' +
                    (saqueFeedback.tipo === 'sucesso' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                     saqueFeedback.tipo === 'erro' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                     'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20')
                  }>
                    {saqueFeedback.msg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saqueLoading}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 font-bold font-sans text-xs text-white uppercase rounded-xl transition tracking-wider shadow-lg flex items-center justify-center gap-2"
                >
                  {saqueLoading ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processando...</>
                  ) : 'Solicitar Pix Imediato'}
                </button>
              </form>
            </div>

            {/* Historico de saques */}
            <div className="lg:col-span-7 bg-[#0b0b12] border border-gray-900 rounded-3xl p-6 shadow-xl">
              <h3 className="text-base font-bold text-white font-display mb-4">Seu Histórico de Transferências Pix</h3>
              
              {withdrawals.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-xs font-mono">Nenhum saque solicitado nesta conta de faturamento.</div>
              ) : (
                <div className="space-y-3">
                  {withdrawals.map((item) => (
                    <div key={item.id} className="p-4 bg-[#0e0e15] border border-gray-800 rounded-2xl flex items-center justify-between text-xs gap-3 font-mono">
                      <div className="space-y-1">
                        <span className="font-bold text-white text-sm">{fmt(item.dados.valor)}</span>
                        {item.dados.taxa_saque !== undefined && (
                          <p className="text-[10px] text-gray-400">Líquido Creditado: <span className="text-green-400 font-bold">{fmt(item.dados.valor_liquido ?? (item.dados.valor - item.dados.taxa_saque))}</span></p>
                        )}
                        <p className="text-gray-500 text-[10px]">Chave: {item.dados.chave_pix} • {item.dados.banco}</p>
                        <p className="text-gray-600 text-[9px]">Solicitado em: {item.dados.data_solicitacao}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        item.dados.status === 'pago' 
                          ? 'bg-green-500/10 text-green-400' 
                          : item.dados.status === 'recusado'
                            ? 'bg-red-500/10 text-red-500'
                            : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {item.dados.status ? item.dados.status.toUpperCase() : 'PENDENTE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* MODAL PREVIEW VITRINE AO VIVO */}
      {showLivePreview && (
        <div className="fixed inset-0 z-50 bg-[#06060a]/95 overflow-y-auto flex flex-col">
          <div className="p-4 bg-[#0e0e15] border-b border-gray-900 flex justify-between items-center sticky top-0 z-50">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-red-600/10 text-red-500 px-2.5 py-0.5 rounded-full font-mono font-bold border border-red-500/20">PREVIEW AO VIVO</span>
              <span className="text-xs text-gray-400 font-sans hidden sm:inline">Esta é a visualização real da sua vitrine de vendas comercial.</span>
            </div>
            <button 
              onClick={() => setShowLivePreview(false)}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Voltar ao Painel ✕
            </button>
          </div>
          <div className="flex-1 bg-[#06060a]">
            <PublicBioPage sellerSlug={seller.dados.slug} />
          </div>
        </div>
      )}
      {/* Modal ver conteúdo do produto */}
      {modalConteudo && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModalConteudo(null)}>
          <div className="bg-[#0e0e16] border border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white">📄 Conteúdo Digital</h3>
                <p className="text-[10px] text-green-400 font-mono mt-0.5">{modalConteudo.dados.nome}</p>
              </div>
              <button onClick={() => setModalConteudo(null)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#080810] border border-gray-800 rounded-xl p-4">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{modalConteudo.dados.conteudo_interno}</pre>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { navigator.clipboard.writeText(modalConteudo.dados.conteudo_interno || ''); }} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-xl transition">📋 Copiar</button>
              <button onClick={() => setModalConteudo(null)} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition">Fechar</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal confirmação excluir produto */}
      {confirmDeleteProd && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmDeleteProd(null)}>
          <div className="bg-[#0e0e16] border border-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </div>
            <h3 className="text-base font-bold text-white text-center mb-1">Excluir produto?</h3>
            <p className="text-xs text-gray-400 text-center mb-1 font-semibold">"{confirmDeleteProd.dados.nome}"</p>
            <p className="text-xs text-gray-500 text-center mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteProd(null)}
                className="flex-1 py-2.5 border border-gray-700 hover:bg-gray-800 text-xs text-gray-300 rounded-xl font-bold transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteProduct(confirmDeleteProd)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
