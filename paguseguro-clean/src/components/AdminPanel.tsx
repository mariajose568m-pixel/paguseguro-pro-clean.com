import React, { useState, useEffect } from 'react';
import { sbGetAll, sbGetWhere, sbUpsert, sbDelete, fmt, uid, sendTelegram, ADMIN_CHAT_ID, TAXA_DEPOSITO } from '../supabase';
import { Vendedor, Venda, Saque, Agente, Entrega, Acesso } from '../types';
import { ShieldCheck, UserCheck, DollarSign, Send, Bot, FileText, Settings, RefreshCw, Box, AlertCircle, ToggleLeft, ToggleRight, Check, Eye, X } from 'lucide-react';

interface AdminPanelProps {
  onLogout: () => void;
}

type AdminTab = 'vendedores' | 'saques' | 'entrega' | 'agentes' | 'logs' | 'config' | 'agentePro' | 'pix_solicitacoes' | 'catalogo';

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab ] = useState<AdminTab>('vendedores');
  const [loading, setLoading] = useState<boolean>(false);

  // Agente Pro states
  const [proQueryInput, setProQueryInput] = useState<string>('');
  const [proOutput, setProOutput] = useState<string>('');
  const [proLoading, setProLoading] = useState<boolean>(false);
  const [proChatHistory, setProChatHistory] = useState<Array<{ role: 'user' | 'agent'; text: string; ts: number; operations?: any[] }>>([
    {
      role: 'agent',
      text: 'Olá Master! Eu sou o ✦ Agente Pro. Estou pronto para gerenciar todo o ecossistema PaguSeguro Pro. Caso queira, você pode me guiar em linguagem natural sem restrições (ex: "aprovar vendedor Silva", "alterar a comissão do gateway para 3%", "zerar saldos", etc.) para que eu audite e aplique diretamente no Supabase em tempo real.',
      ts: Date.now()
    }
  ]);

  // Entities
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  // Modal edição de vendedor
  const [editVendedor, setEditVendedor] = useState<Vendedor | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [saques, setSaques] = useState<Saque[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [pixSolicitacoes, setPixSolicitacoes] = useState<any[]>([]);
  const [pixConfirmFeedback, setPixConfirmFeedback] = useState<Record<string, 'loading' | 'ok' | 'erro'>>({});
  const [pixAcessoInfo, setPixAcessoInfo] = useState<Record<string, { link: string; codigo: string }>>({});

  // Input code tracking
  const [pixCodesInput, setPixCodesInput] = useState<Record<string, string>>({});

  // FIX 7: Catálogo de produtos
  const [catalogoProdutos, setCatalogoProdutos] = useState<any[]>([]);
  const [editProduto, setEditProduto] = useState<any | null>(null);
  const [prodSaving, setProdSaving] = useState(false);
  const [prodFeedback, setProdFeedback] = useState('');

  // Delivery Modal States
  const [showDeliveryModal, setShowDeliveryModal] = useState<boolean>(false);
  const [selectedVendaDelivery, setSelectedVendaDelivery] = useState<Venda | null>(null);
  const [deliveryLink, setDeliveryLink] = useState<string>('');
  const [deliveryMsg, setDeliveryMsg] = useState<string>('');
  const [deliveryMethod, setDeliveryMethod] = useState<'whatsapp' | 'telegram' | 'email'>('whatsapp');
  const [delivering, setDelivering] = useState<boolean>(false);

  // View Prompt Modal States
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [activePromptText, setActivePromptText] = useState<string>('');
  const [activePromptTitle, setActivePromptTitle] = useState<string>('');

  // Global Configs State
  const [systemFee, setSystemFee] = useState<string>('2.50');
  const [taxaSaqueFee, setTaxaSaqueFee] = useState<string>('2.50');
  const [apiGateway, setApiGateway] = useState<string>('TerrorPay Dynamic Gateway');
  const [savedConfig, setSavedConfig] = useState<boolean>(false);

  // File Management & AI Programmer Expansion States
  const [fileList, setFileList] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
  const [isSavingFile, setIsSavingFile] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [devPrompt, setDevPrompt] = useState<string>('');
  const [isRewritingCode, setIsRewritingCode] = useState<boolean>(false);
  const [devAIOutput, setDevAIOutput] = useState<string>('');

  useEffect(() => {
    fetchAdminData();
    fetchEditableFiles();
  }, []);

  // Recarregar solicitações Pix ao entrar na aba
  useEffect(() => {
    if (activeTab === 'pix_solicitacoes') {
      sbGetAll<any>('pix_solicitacoes').then(data => {
        setPixSolicitacoes(data.sort((a: any, b: any) => b.ts - a.ts));
      });
    }
  }, [activeTab]);

  // FIX 7: Carregar catálogo ao entrar na aba
  useEffect(() => {
    if (activeTab === 'catalogo') {
      sbGetAll<any>('produtos').then(data => {
        setCatalogoProdutos(data.sort((a: any, b: any) => b.ts - a.ts));
      });
    }
  }, [activeTab]);

  const fetchEditableFiles = async () => {
    try {
      const res = await fetch('/api/code/list');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFileList(data.files || []);
          if (data.files && data.files.length > 0 && !selectedFile) {
            handleSelectFile(data.files[0]);
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar lista de arquivos editáveis:', e);
    }
  };

  const handleSelectFile = async (filePath: string) => {
    if (!filePath) return;
    setSelectedFile(filePath);
    setIsReadingFile(true);
    setSaveStatus('');
    try {
      const res = await fetch('/api/code/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setFileContent(data.content || '');
        } else {
          setSaveStatus(`Erro: ${data.error}`);
        }
      }
    } catch (err: any) {
      setSaveStatus(`Erro ao ler arquivo: ${err.message}`);
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleManualSaveFile = async () => {
    if (!selectedFile || isSavingFile) return;
    setIsSavingFile(true);
    setSaveStatus('Salvando...');
    try {
      const res = await fetch('/api/code/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: selectedFile, content: fileContent })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSaveStatus('Arquivo salvo com sucesso no disco!');
          setTimeout(() => setSaveStatus(''), 4000);
        } else {
          setSaveStatus(`Erro ao salvar: ${data.error}`);
        }
      }
    } catch (err: any) {
      setSaveStatus(`Erro de rede: ${err.message}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleDevAIRewrite = async () => {
    if (!devPrompt.trim() || isRewritingCode) return;
    setIsRewritingCode(true);
    setDevAIOutput('Iniciando análise dos arquivos do sistema e montando plano de reescrita neural...');
    try {
      const res = await fetch('/api/code/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: devPrompt,
          selectedFiles: selectedFile ? [selectedFile] : []
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setDevAIOutput(`✦ SUCESSO DE ENGENHARIA! arquivos reescritos/atualizados com sucesso: [${data.updatedFiles.join(', ')}]\n\nPARECER TÉCNICO:\n${data.explanation}`);
          setDevPrompt('');
          // Recarregar o arquivo atual que estava selecionado
          if (selectedFile) {
            handleSelectFile(selectedFile);
          }
        } else {
          setDevAIOutput(`❌ ERRO NO MOTOR DE EXECUÇÃO: ${data.error}`);
        }
      } else {
        throw new Error('Falha na conexão do servidor');
      }
    } catch (err: any) {
      setDevAIOutput(`❌ ERRO CRÍTICO NA RECONSTRUÇÃO DO SINAL DE CÓDIGO: ${err.message}`);
    } finally {
      setIsRewritingCode(false);
    }
  };

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [vends, vnds, sqs, agts, entrs, configs, pixSols] = await Promise.all([
        sbGetAll<Vendedor>('vendedores'),
        sbGetAll<Venda>('vendas'),
        sbGetAll<Saque>('saques'),
        sbGetAll<Agente>('agentes'),
        sbGetAll<Entrega>('entregas'),
        sbGetAll<any>('config'),
        sbGetAll<any>('pix_solicitacoes')
      ]);

      setVendedores(vends || []);
      setVendas(vnds || []);
      setSaques(sqs || []);
      setAgentes(agts || []);
      setEntregas(entrs || []);
      setPixSolicitacoes(pixSols || []);

      const foundGlobal = configs?.find((c: any) => c.id === 'global_config');
      if (foundGlobal && foundGlobal.dados) {
        setSystemFee(String(foundGlobal.dados.taxa_venda ?? '2.50'));
        setTaxaSaqueFee(String(foundGlobal.dados.taxa_saque ?? '2.50'));
        setApiGateway(foundGlobal.dados.gateway_api ?? 'TerrorPay Dynamic Gateway');
      }
    } catch (e) {
      console.error('Error fetching admin control records:', e);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE ENTREGA DIGITAL ---
  const paidSales = vendas.filter(v => v.dados.status_venda === 'pago');
  
  // Filtra as vendas pagas que NÃO têm entrega correspondente na tabela entregas (comparando chatId ou comprador_nome + produto_nome)
  const pendingDeliveries = paidSales.filter(v => {
    const deliveryExists = entregas.some(ent => ent.dados.comprador_nome === v.dados.comprador_nome && ent.dados.produto_nome === v.dados.produto_nome);
    return !deliveryExists;
  });

  // --- MÉTRICAS DE RECEITA DA PLATAFORMA (CORREÇÃO 5) ---
  const approvedSaques = saques.filter(s => s.dados.status === 'pago');
  
  const totalTaxasVenda = paidSales.reduce((acc, v) => {
    const fee = typeof v.dados.taxa_plataforma === 'number'
      ? v.dados.taxa_plataforma
      : 2.50;
    return acc + fee;
  }, 0);

  const totalTaxasSaque = approvedSaques.reduce((acc, s) => {
    const fee = typeof s.dados.taxa_saque === 'number'
      ? s.dados.taxa_saque
      : 2.50;
    return acc + fee;
  }, 0);

  const totalArrecadado = totalTaxasVenda + totalTaxasSaque;

  const handleOpenDelivery = (venda: Venda) => {
    setSelectedVendaDelivery(venda);
    setDeliveryLink('');
    setDeliveryMsg(`Olá, ${venda.dados.comprador_nome}! Seu faturamento Pix foi processado com sucesso. Segue seu link oficial de acesso ao produto digital "${venda.dados.produto_nome}". Aproveite!`);
    setDeliveryMethod('whatsapp');
    setShowDeliveryModal(true);
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendaDelivery || !deliveryLink || delivering) return;

    setDelivering(true);
    try {
      const deliveryId = 'dlv_' + uid();
      const novaEntrega: Entrega = {
        id: deliveryId,
        ts: Date.now(),
        dados: {
          chat_id: selectedVendaDelivery.id,
          vendedor_id: selectedVendaDelivery.dados.vendedor_id,
          comprador_nome: selectedVendaDelivery.dados.comprador_nome,
          produto_nome: selectedVendaDelivery.dados.produto_nome,
          valor: selectedVendaDelivery.dados.valor,
          link_entrega: deliveryLink,
          mensagem: deliveryMsg,
          metodo: deliveryMethod,
          entregue: true,
          data_entrega: new Date().toLocaleDateString('pt-BR')
        }
      };

      // Marcar venda como entregue no Supabase
      const vendaAtualizada = {
        ...selectedVendaDelivery,
        dados: {
          ...selectedVendaDelivery.dados,
          entregue: true,
          link_entrega: deliveryLink,
          data_entrega: new Date().toLocaleDateString('pt-BR')
        }
      };

      await Promise.all([
        sbUpsert('entregas', novaEntrega),
        sbUpsert('vendas', vendaAtualizada)
      ]);

      setEntregas([novaEntrega, ...entregas]);
      setVendas(prev => prev.map(v => v.id === selectedVendaDelivery.id ? vendaAtualizada : v));
      setShowDeliveryModal(false);
      setSelectedVendaDelivery(null);
      setDeliveryLink('');
      setDeliveryMsg('');
    } catch (err) {
      console.error(err);
    } finally {
      setDelivering(false);
    }
  };

  // --- LÓGICA DE AGENTES IA ---
  const handleToggleAgentStatus = async (agent: Agente) => {
    const updated: Agente = {
      ...agent,
      dados: {
        ...agent.dados,
        ativo: !agent.dados.ativo
      }
    };
    try {
      await sbUpsert('agentes', updated);
      setAgentes(agentes.map(a => a.id === agent.id ? updated : a));
    } catch (err) {
      console.error(err);
    }
  };

  // --- LÓGICA DO AGENTE PRO CONTROL PANEL ---
  const [proImageBase64, setProImageBase64] = useState<string>('');
  const [proImageMime, setProImageMime] = useState<string>('');

  const handleProImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('Imagem muito grande. Máximo 4MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setProImageBase64(result.split(',')[1]);
      setProImageMime(file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleQueryAgentePro = async (customPrompt?: string) => {
    const promptToUse = customPrompt || proQueryInput;
    if (!promptToUse.trim() || proLoading) return;

    const userMsg = { role: 'user' as const, text: promptToUse, ts: Date.now() };
    setProChatHistory(prev => [...prev, userMsg]);
    setProQueryInput('');
    setProImageBase64('');
    setProImageMime('');

    setProLoading(true);
    setProOutput('');
    try {
      // 1. Preparar o contexto de dados vivos para o executor
      const contextPayload = {
        vendedores,
        vendas,
        saques,
        agentes,
        entregas,
        config: [
          {
            id: 'global_config',
            dados: {
              taxa_venda: parseFloat(systemFee) || 2.50,
              taxa_saque: parseFloat(taxaSaqueFee) || 2.50,
              gateway_api: apiGateway
            }
          }
        ]
      };

      // Modo manual — sem IA externa
      const data = { success: true, explanation: '✅ Anotado! Use as abas do painel para gerenciar vendedores, saques e vendas manualmente.', operations: [] };

      // 3. Formular output
      let outputText = data.explanation + '\n\n';
      const ops: any[] = [];

      if (ops.length > 0) {
        outputText += `🚨 [AGENTE PRO EXECUTOU ${ops.length} OPERAÇÃO(ÕES) EM TEMPO REAL]\n`;
        outputText += "========================================================================\n\n";

        for (const op of ops) {
          const { table, action, record } = op;
          if (action === 'delete') {
            outputText += `🗑️ REMOVENDO REGISTRO: ID "${record.id}" da tabela "${table}"...\n`;
            await sbDelete(table, record.id);
          } else {
            outputText += `⚙️ SALVANDO/ATUALIZANDO REGISTRO: ID "${record.id}" na tabela "${table}"...\n`;
            
            // Garantir que os dados mesclam adequadamente e o timestamp 'ts' seja válido
            let recordToSave = { ...record };
            recordToSave.ts = record.ts || Date.now();

            if (typeof record.dados === 'string') {
              try {
                recordToSave.dados = JSON.parse(record.dados);
              } catch (e) {}
            }

            // Descobrir se já existe esse registro localmente para mesclar campos extras se necessário
            let existingRecord: any = null;
            if (table === 'vendedores') {
              existingRecord = vendedores.find(v => v.id === record.id);
            } else if (table === 'saques') {
              existingRecord = saques.find(s => s.id === record.id);
            } else if (table === 'vendas') {
              existingRecord = vendas.find(v => v.id === record.id);
            } else if (table === 'agentes') {
              existingRecord = agentes.find(a => a.id === record.id);
            } else if (table === 'entregas') {
              existingRecord = entregas.find(ent => ent.id === record.id);
            }

            if (existingRecord && existingRecord.dados && recordToSave.dados) {
              recordToSave.dados = {
                ...existingRecord.dados,
                ...recordToSave.dados
              };
            }

            await sbUpsert(table, recordToSave);
          }
        }

        outputText += "\n========================================================================\n";
        outputText += "✨ Sincronização concluída! Toda a base tática de dados foi atualizada no Supabase.";
        
        // 4. Recarregar os dados do painel administrador completamente
        await fetchAdminData();
      } else {
        outputText += "✓ Parecer emitido apenas para leitura. (Nenhuma alteração direta exigida no banco de dados).";
      }

      setProOutput(outputText);
      
      const agentMsg = {
        role: 'agent' as const,
        text: outputText,
        ts: Date.now(),
        operations: ops
      };
      setProChatHistory(prev => [...prev, agentMsg]);

    } catch (err: any) {
      console.error(err);
      const errText = `❌ Erro de processamento operacional: ${err.message || 'Sem conexão com o barramento do gateway'}`;
      setProOutput(errText);
      setProChatHistory(prev => [...prev, {
        role: 'agent' as const,
        text: errText,
        ts: Date.now()
      }]);
    } finally {
      setProLoading(false);
    }
  };

  const handleCreateDefaultPlatformAgent = async () => {
    try {
      // Criar agente global fallback da PLATFORM
      const fallbackId = 'agent_fallback_global';
      const novoAgent: Agente = {
        id: fallbackId,
        ts: Date.now(),
        dados: {
          vendedor_id: 'PLATFORM',
          nome_agente: 'Terapeuta Comercial IA',
          nicho: 'Comércio Geral & Escolaridade',
          personalidade: 'Você é um agente global amigável, educado, soluciona dores técnicas do cliente de maneira clara, descomplica barreiras e induz a compra tranquila por Pix.',
          ativo: true
        }
      };

      await sbUpsert('agentes', novoAgent);
      // Recarrega
      const ags = await sbGetAll<Agente>('agentes');
      setAgentes(ags || []);
      alert('Agente fallback padrão da plataforma ativado na nuvem!');
    } catch (err) {
      console.error(err);
    }
  };

  // --- CONSOLE DE APROVAÇÃO ---
  const handleApproveSeller = async (vendedor: Vendedor) => {
    const updated: Vendedor = {
      ...vendedor,
      dados: { ...vendedor.dados, aprovado: true }
    };
    try {
      await sbUpsert('vendedores', updated);
      setVendedores(vendedores.map(v => v.id === vendedor.id ? updated : v));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSalvarEdicaoVendedor = async () => {
    if (!editVendedor) return;
    setEditSaving(true);
    try {
      const updated: Vendedor = {
        ...editVendedor,
        dados: {
          ...editVendedor.dados,
          email: editEmail.trim() || editVendedor.dados.email,
          ...(editSenha.trim() ? { senha: editSenha.trim() } as any : {}),
        }
      };
      await sbUpsert('vendedores', updated);
      setVendedores(vendedores.map(v => v.id === updated.id ? updated : v));
      setEditVendedor(null);
    } catch (e) {
      console.error(e);
    } finally {
      setEditSaving(false);
    }
  };

  // --- CONSOLE DE DISBURSEMENT ---
  const handleApproveSaque = async (saq: Saque, approve: boolean) => {
    const updated: Saque = {
      ...saq,
      dados: {
        ...saq.dados,
        status: approve ? 'pago' : 'recusado',
        data_processamento: new Date().toLocaleDateString('pt-BR')
      }
    };
    try {
      await sbUpsert('saques', updated);
      setSaques(saques.map(s => s.id === saq.id ? updated : s));
    } catch (err) {
      console.error(err);
    }
  };

  // --- CONTROLE DE SOLICITAÇÕES PIX MANUAL ---
  const handleEnviarPix = async (solId: string, codigo: string) => {
    if (!codigo.trim()) {
      alert('Por favor, informe ou cole o código Pix cópia e cola antes de enviar.');
      return;
    }

    try {
      const allSols = await sbGetAll<any>('pix_solicitacoes');
      const sol = allSols.find(s => s.id === solId);
      if (!sol) {
        alert('Solicitação não localizada!');
        return;
      }

      const updatedSol = {
        ...sol,
        dados: {
          ...sol.dados,
          status: 'pix_enviado',
          pix_codigo: codigo.trim()
        }
      };

      const salvou = await sbUpsert('pix_solicitacoes', updatedSol);
      if (!salvou) {
        alert('Erro ao salvar no banco. Tente novamente.');
        return;
      }
      // Atualizar lista local imediatamente
      setPixSolicitacoes(prev => prev.map((p: any) =>
        p.id === solId ? { ...p, dados: { ...p.dados, status: 'pix_enviado', pix_codigo: codigo.trim() } } : p
      ));
      alert('Código Pix enviado com sucesso para a tela do comprador!');
      
      // Notificar no chat do admin
      await sendTelegram(ADMIN_CHAT_ID,
        `⚡ <b>PIX ENVIADO AO COMPRADOR</b>\n\n` +
        `👤 Comprador: ${sol.dados.comprador_nome}\n` +
        `📦 Produto: ${sol.dados.produto_nome}\n` +
        `💰 Valor total: R$ ${sol.dados.valor_total.toFixed(2)}\n` +
        `🆔 ID: ${solId}\n\n` +
        `O comprador agora pode efetuar a cópia do Pix.`
      );

      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar código Pix: ' + err.message);
    }
  };

  const handleConfirmarPagamentoPix = async (solId: string) => {
    setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'loading' }));
    try {
      const allSols = await sbGetAll<any>('pix_solicitacoes');
      const sol = allSols.find(s => s.id === solId);
      if (!sol) { setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'erro' })); return; }

      const valorProduto = sol.dados.valor_produto;
      const vendedorId = sol.dados.vendedor_id;

      const vends = await sbGetAll<Vendedor>('vendedores');
      const vend = vends.find(v => v.id === vendedorId);
      if (!vend) { setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'erro' })); return; }

      const commValue = sol.dados.taxa_plataforma ?? parseFloat((valorProduto * 0.25).toFixed(2));
      const sellerEarnings = sol.dados.valor_liquido_vendedor || parseFloat((valorProduto - commValue).toFixed(2));

      const vendaId = 'vd_' + uid();

      // Gerar link de acesso único para o comprador
      let linkProduto = '';
      let codigoAcesso = '';
      try {
        const acessoId = 'acesso_' + uid();
        // Código legível de 8 caracteres: ex PAG-7X3K
        codigoAcesso = 'PAG-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const novoAcesso: Acesso = {
          id: acessoId,
          ts: Date.now(),
          dados: {
            venda_id: vendaId,
            vendedor_id: vendedorId,
            produto_id: sol.dados.produto_id,
            produto_nome: sol.dados.produto_nome,
            comprador_nome: sol.dados.comprador_nome,
            comprador_whatsapp: sol.dados.comprador_whatsapp || '',
            valor: valorProduto,
            codigo_acesso: codigoAcesso,
          } as any
        };
        await sbUpsert('acessos', novoAcesso);
        linkProduto = `${window.location.origin}${window.location.pathname}?p=${acessoId}`;
      } catch { linkProduto = ''; }

      const novaVenda: Venda = {
        id: vendaId,
        ts: Date.now(),
        dados: {
          vendedor_id: vendedorId,
          produto_id: sol.dados.produto_id,
          produto_nome: sol.dados.produto_nome,
          valor: valorProduto,
          comprador_nome: sol.dados.comprador_nome,
          comprador_email: `${sol.dados.comprador_nome.toLowerCase().replace(/\s+/g, '')}@pagupro.com`,
          comprador_telefone: sol.dados.comprador_whatsapp,
          status_venda: 'pago',
          data_venda: new Date().toLocaleDateString('pt-BR'),
          metodo_pagamento: 'pix',
          taxa_plataforma: commValue,
          valor_liquido: sellerEarnings
        }
      };

      const updatedVend: Vendedor = {
        ...vend,
        dados: { ...vend.dados, saldo: (vend.dados.saldo || 0) + sellerEarnings }
      };

      const updatedSol = {
        ...sol,
        dados: { ...sol.dados, status: 'confirmado', pix_confirmado: true, link_produto: linkProduto }
      };

      const resultados = await Promise.all([
        sbUpsert('vendas', novaVenda),
        sbUpsert('vendedores', updatedVend),
        sbUpsert('pix_solicitacoes', updatedSol)
      ]);

      if (resultados.some(r => !r)) {
        setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'erro' }));
        return;
      }

      setPixSolicitacoes(prev => prev.map((p: any) =>
        p.id === solId ? { ...p, dados: { ...p.dados, status: 'confirmado', pix_confirmado: true } } : p
      ));
      setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'ok' }));
      if (linkProduto) setPixAcessoInfo(prev => ({ ...prev, [solId]: { link: linkProduto, codigo: codigoAcesso } }));

      await sendTelegram(ADMIN_CHAT_ID,
        `🎉 <b>VENDA MANUAL PIX CONFIRMADA!</b>\n\n` +
        `👤 Comprador: ${sol.dados.comprador_nome}\n` +
        `🏪 Vendedor: ${vend.dados.nome}\n` +
        `📦 Produto: ${sol.dados.produto_nome}\n` +
        `💰 Valor Líquido: R$ ${sellerEarnings.toFixed(2)}\n` +
        `📈 Taxa Cobrada: R$ ${commValue.toFixed(2)}\n` +
        `🆔 ID Venda: ${vendaId}`
      );

      if (vend.dados.telegram_chat_id) {
        await sendTelegram(vend.dados.telegram_chat_id,
          `💸 <b>NOVA VENDA CONFIRMADA! No Pix</b>\n\n` +
          `📦 Produto: ${sol.dados.produto_nome}\n` +
          `💰 Valor Líquido Creditado: R$ ${sellerEarnings.toFixed(2)}\n` +
          `Acesse sua carteira no painel para ver seu saldo atualizado.`
        );
      }

      fetchAdminData();
    } catch (err: any) {
      console.error(err);
      setPixConfirmFeedback(prev => ({ ...prev, [solId]: 'erro' }));
    }
  };

  return (
    <div className="min-h-screen bg-[#08080d] text-gray-200 font-sans flex flex-col md:flex-row pb-6" id="admin_master">
      
      {/* Sidebar Nav */}
      <aside className="w-full md:w-64 bg-[#0c0c14] border-b md:border-b-0 md:border-r border-gray-900 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white text-base font-black">
              M
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-white font-display">PAINEL MASTER</span>
              <p className="text-[10px] text-gray-500 font-mono">PaguSeguro Pro</p>
            </div>
          </div>
          <button 
            onClick={fetchAdminData}
            title="Atualizar dados admin"
            className="p-1 px-1.5 bg-gray-950 font-bold border border-gray-900 hover:border-gray-800 rounded-lg text-gray-500 hover:text-white transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Menu Tabs */}
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('vendedores')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'vendedores' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <UserCheck className="w-4 h-4" />
              Aprovação de Vendedores
            </span>
            <span className="text-[10px] bg-red-950/20 px-1.5 py-0.5 rounded text-red-400 font-mono font-bold">
              {vendedores.filter(v => !v.dados.aprovado).length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('saques')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'saques' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Controle de Saques
            </span>
            <span className="text-[10px] bg-red-950/20 px-1.5 py-0.5 rounded text-red-400 font-mono font-bold">
              {saques.filter(s => s.dados.status === 'pendente').length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('pix_solicitacoes')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'pix_solicitacoes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-[#12121e] hover:text-white'
            }`}
            id="admin_tab_pix_solicitacoes"
          >
            <span className="flex items-center gap-2">
              <span className="text-red-500 font-bold">💳</span>
              Solicitações Pix
            </span>
            {pixSolicitacoes.filter(p => !p.dados.pix_confirmado && p.dados.status === 'aguardando_pix').length > 0 && (
              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
                {pixSolicitacoes.filter(p => !p.dados.pix_confirmado && p.dados.status === 'aguardando_pix').length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('entrega')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'entrega' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
            id="admin_tab_entrega"
          >
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              Entrega Digital
            </span>
            {pendingDeliveries.length > 0 && (
              <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                {pendingDeliveries.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('agentes')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'agentes' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-[#12121a] hover:text-white'
            }`}
            id="admin_tab_agentes"
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-orange-400" />
              Agentes IA
            </span>
            <span className="text-[10px] bg-red-950/20 px-1.5 py-0.5 rounded text-gray-400 font-mono">
              {agentes.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'logs' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Logs Conversas IA
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('agentePro')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'agentePro' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
            id="admin_tab_agente_pro"
          >
            <span className="flex items-center gap-2">
              <span className="text-red-400 font-bold">✦</span> Agente Pro Console
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('catalogo')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'catalogo' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Box className="w-4 h-4" />
              Catálogo de Produtos
            </span>
            <span className="text-[10px] bg-red-950/20 px-1.5 py-0.5 rounded text-gray-400 font-mono">
              {catalogoProdutos.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition ${
              activeTab === 'config' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-900/80 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configurações Gerais
            </span>
          </button>
        </nav>

        {/* Botão de Saída Master */}
        <div className="p-4 border-t border-gray-900">
          <button 
            onClick={onLogout}
            className="w-full py-2 bg-gradient-to-r from-red-950/50 to-red-900/30 hover:to-red-800 text-xs text-red-500 hover:text-white rounded-xl transition font-semibold"
          >
            Sair do Painel Master
          </button>
        </div>
      </aside>

      {/* Area Central de Conteúdo do Admin */}
      <main className="flex-grow p-4 md:p-8 flex flex-col gap-6 overflow-y-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-950 pb-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white font-display">Ações de Administração</h2>
            <p className="text-xs text-gray-400 font-mono">Mapeamento de faturamento e governança das instâncias de IA.</p>
          </div>
          
          <div className="text-xs font-mono text-gray-500 bg-gray-950/40 p-2 border border-gray-900 rounded-xl">
            Sessão segura ativa • 100% criptografado
          </div>
        </header>

        {/* TAB vendedores: Aprovação */}
        {activeTab === 'vendedores' && (
          <div className="space-y-6">
            
            {/* Bloco de BI Financeiro da Plataforma (CORREÇÃO 5) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="bi_dashboard_cards">
              <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-red-500 opacity-10">
                  <DollarSign className="w-16 h-16" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Receita em Taxas de Venda</span>
                  <h4 className="text-xl font-bold text-white font-mono mt-2">{fmt(totalTaxasVenda || 0)}</h4>
                  <p className="text-[10px] text-gray-500 font-sans mt-1">Soma de comissões retidas em cobranças compensadas.</p>
                </div>
              </div>

              <div className="bg-[#0b0b12] border border-gray-900 rounded-3xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-red-500 opacity-10">
                  <Send className="w-16 h-16" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">Receita em Taxas de Saque</span>
                  <h4 className="text-xl font-bold text-white font-mono mt-2">{fmt(totalTaxasSaque || 0)}</h4>
                  <p className="text-[10px] text-gray-500 font-sans mt-1">Soma de comissões retidas em transferências pagas.</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#12080d] to-[#0d070d] border border-red-900/30 rounded-3xl p-5 shadow-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute bottom-0 right-0 p-3 text-red-500 opacity-10">
                  <ShieldCheck className="w-20 h-20" />
                </div>
                <div>
                  <span className="text-[10px] text-orange-400 uppercase tracking-wider font-mono font-bold">Total Arrecadado pela Plataforma</span>
                  <h4 className="text-2xl font-extrabold text-red-500 font-mono mt-2">{fmt(totalArrecadado || 0)}</h4>
                  <p className="text-[10px] text-orange-500/70 font-sans mt-1">Receita consolidada de governança e custódia.</p>
                </div>
              </div>
            </div>

            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white font-display">Vendedores Solicitando Filiação (Aprovação)</h3>
            
            {vendedores.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-10">Nenhum vendedor registrado no sistema.</p>
            ) : (
              <div className="space-y-3">
                {vendedores.map((v) => (
                  <div key={v.id} className="p-4 bg-[#08080d] border border-gray-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="font-bold text-white text-sm">{v.dados.nome}</span>
                      <p className="text-gray-400">{v.dados.email} • {v.dados.whatsapp}</p>
                      <p className="text-gray-500 text-[10px]">Chave Pix: {v.dados.chave_pix} ({v.dados.banco})</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[9px] ${
                        v.dados.aprovado ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {v.dados.aprovado ? 'AFILIADO PRO' : 'PENDENTE DE AUDITORIA'}
                      </span>

                      {!v.dados.aprovado ? (
                        <button 
                          onClick={() => handleApproveSeller(v)}
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 transition font-bold text-[10px] text-white rounded-xl uppercase tracking-wider"
                        >
                          Aprovar Cadastro
                        </button>
                      ) : (
                        <span className="text-[10px] text-gray-500">Aprovado ✓</span>
                      )}
                      <button
                        onClick={() => { setEditVendedor(v); setEditEmail(v.dados.email); setEditSenha(''); }}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-bold rounded-xl transition"
                      >
                        ✏️ Editar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
        )}

        {/* TAB saques: Controle de Disbursement */}
        {activeTab === 'saques' && (
          <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white font-display">Solicitações de Resgate Pix</h3>
            
            {saques.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-10">Nenhum pedido de saque capturado na fila.</p>
            ) : (
              <div className="space-y-3">
                {saques.map((item) => (
                  <div key={item.id} className="p-4 bg-[#08080d] border border-gray-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-white text-sm">{fmt(item.dados.valor)}</span>
                        <span className="text-[10px] text-gray-500">Pedido por: {item.dados.vendedor_nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-400">Banco: {item.dados.banco} • Pix: <span className="text-yellow-400 font-mono">{item.dados.chave_pix}</span></p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(item.dados.chave_pix || ''); alert('Chave Pix copiada!'); }}
                          className="px-2 py-0.5 text-[10px] bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 rounded-lg transition font-bold"
                          title="Copiar chave Pix"
                        >
                          📋 Copiar
                        </button>
                      </div>
                      <p className="text-gray-600 text-[10px]">Data da solicitação: {item.dados.data_solicitacao}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.dados.status === 'pendente' ? (
                        <>
                          <button 
                            onClick={() => handleApproveSaque(item, false)}
                            className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-rose-500 border border-gray-850 hover:border-gray-800 rounded-xl scale-95 transition"
                          >
                            Recusar
                          </button>
                          <button 
                            onClick={() => handleApproveSaque(item, true)}
                            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 font-bold text-white rounded-xl shadow-lg transition flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Confirmar Pix
                          </button>
                        </>
                      ) : (
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] tracking-wide ${
                          item.dados.status === 'pago' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {item.dados.status ? item.dados.status.toUpperCase() : 'PENDENTE'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ENTREGA DIGITAL (NOVO) */}
        {activeTab === 'pix_solicitacoes' && (
          <div className="bg-[#0c0c14] border border-gray-950 rounded-3xl p-6 shadow-xl space-y-6" id="admin_tab_pix_sol_view">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-900 pb-4">
              <div>
                <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                  <span className="text-red-500 font-bold text-lg">💳</span> Solicitações de Cobrança Pix Manual
                </h3>
                <p className="text-xs text-gray-400 font-mono">Gerenciamento manual do faturamento Pix, envio de códigos e auditoria de depósitos.</p>
              </div>
              <button
                onClick={() => sbGetAll<any>('pix_solicitacoes').then(data => setPixSolicitacoes(data.sort((a: any, b: any) => b.ts - a.ts)))}
                style={{ background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12 }}
              >
                🔄 Atualizar
              </button>
              <button
                onClick={fetchAdminData}
                className="px-3 py-1.5 bg-[#12121c] hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 text-gray-300"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar Fila
              </button>
            </div>

            {pixSolicitacoes.length === 0 ? (
              <p className="text-xs text-gray-500 font-mono text-center py-12">Nenhuma solicitação de faturamento Pix manual capturada.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...pixSolicitacoes].sort((a,b) => b.ts - a.ts).map((sol) => {
                  const solId = sol.id;
                  const dados = sol.dados || {};
                  const isAguardando = dados.status === 'aguardando_pix';
                  const isEnviado = dados.status === 'pix_enviado';
                  const isConfirmado = dados.status === 'confirmado';

                  return (
                    <div key={solId} className="p-5 bg-[#08080c] border border-gray-900 rounded-2xl space-y-4 font-mono text-xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-900/60 pb-2">
                          <span className="font-extrabold text-white text-xs block truncate max-w-[180px]" title={solId}>
                            Pedido #{solId.slice(-6).toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            isConfirmado 
                              ? 'bg-green-500/10 text-green-400' 
                              : isEnviado 
                              ? 'bg-blue-500/10 text-blue-400 animate-pulse' 
                              : 'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {isConfirmado ? 'PAGO & CREDITADO ✓' : isEnviado ? 'PIX ENVIADO' : 'AGUARDANDO PIX'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 border-b border-gray-900/40 pb-3 text-gray-400 text-[11px]">
                          <div>
                            <span className="text-gray-600 block text-[9px] uppercase font-bold">Comprador</span>
                            <span className="text-gray-300 block font-semibold truncate">{dados.comprador_nome}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 block text-[9px] uppercase font-bold">WhatsApp</span>
                            <a 
                              href={`https://wa.me/${dados.comprador_whatsapp?.replace(/\D/g, '')}`}
                              target="_blank" 
                              rel="noreferrer"
                              className="text-red-400 hover:underline block truncate font-bold"
                            >
                              {dados.comprador_whatsapp}
                            </a>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-600 block text-[9px] uppercase font-bold">Produto Adquirido</span>
                            <span className="text-gray-200 block truncate font-sans text-xs font-semibold">{dados.produto_nome}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 block text-[9px] uppercase font-bold">Vendedor Afiliado</span>
                            <span className="text-gray-300 block truncate">{dados.vendedor_nome}</span>
                          </div>
                          <div>
                            <span className="text-gray-600 block text-[9px] uppercase font-bold">Data</span>
                            <span className="text-gray-300 block text-[10px]/tight">{new Date(sol.ts).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>

                        <div className="bg-[#0b0b12] p-2.5 rounded-xl border border-gray-900/60 space-y-1 block">
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-[10px]">Preço Produto:</span>
                            <span className="text-white text-[11px] font-bold">{fmt(dados.valor_produto || 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500 text-[10px]">Taxa Processamento:</span>
                            <span className="text-red-400 text-[11px] font-bold">+{fmt(TAXA_DEPOSITO)}</span>
                          </div>
                          <div className="border-t border-gray-900/80 my-1 pt-1 flex justify-between">
                            <span className="text-gray-400 font-bold text-[10px]">Total a Pagar Comprador:</span>
                            <span className="text-green-400 text-xs font-black">{fmt(dados.valor_total || 0)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ações de Estado */}
                      <div className="pt-2">
                        {isAguardando && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[9px] text-gray-500 font-bold mb-1 uppercase">Código Copia e Cola Pix Gerado ou Final</label>
                              <input 
                                type="text"
                                placeholder="Cole o código Pix completo aqui..."
                                value={pixCodesInput[solId] || ''}
                                onChange={(e) => setPixCodesInput(prev => ({ ...prev, [solId]: e.target.value }))}
                                className="w-full bg-[#12121e] border border-gray-850 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-red-500"
                              />
                            </div>
                            <button
                              onClick={() => handleEnviarPix(solId, pixCodesInput[solId] || '')}
                              className="w-full py-2 bg-red-600 hover:bg-red-700 font-bold text-white rounded-xl tracking-wide uppercase text-[10px] transition cursor-pointer"
                            >
                              Enviar Pix ao Comprador
                            </button>
                          </div>
                        )}

                        {isEnviado && (
                          <div className="space-y-3">
                            <div className="bg-[#0a0a0f] border border-gray-900 p-2 rounded-xl text-[10px] text-gray-400 flex items-center justify-between gap-1.5">
                              <span className="truncate max-w-[80%] font-mono select-all text-[9.5px]">
                                {dados.pix_code || dados.pix_codigo || 'Sem código'}
                              </span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(dados.pix_code || dados.pix_codigo || '');
                                  alert('Copiado para área de transferência!');
                                }}
                                className="text-red-500 hover:text-white uppercase font-bold text-[9px] font-mono shrink-0 cursor-pointer"
                              >
                                Copiar
                              </button>
                            </div>
                            <button
                              onClick={() => handleConfirmarPagamentoPix(solId)}
                              disabled={pixConfirmFeedback[solId] === 'loading' || pixConfirmFeedback[solId] === 'ok'}
                              className={'w-full py-2.5 font-extrabold text-white rounded-xl shadow-lg text-[10px] transition uppercase tracking-wider cursor-pointer ' + (pixConfirmFeedback[solId] === 'ok' ? 'bg-green-700' : pixConfirmFeedback[solId] === 'erro' ? 'bg-red-700 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700')}
                            >
                              {pixConfirmFeedback[solId] === 'loading' ? '⏳ Confirmando...' :
                               pixConfirmFeedback[solId] === 'ok' ? '✅ Pago & Creditado!' :
                               pixConfirmFeedback[solId] === 'erro' ? '❌ Erro — tente novamente' :
                               'Confirmar Pagamento Pix Manual'}
                            </button>
                            {/* Link e código após confirmar */}
                            {pixConfirmFeedback[solId] === 'ok' && pixAcessoInfo[solId] && (
                              <div className="mt-3 p-3 bg-green-950/20 border border-green-900/40 rounded-xl space-y-2">
                                <p className="text-[9px] font-bold text-green-400 uppercase">📦 Enviar ao comprador:</p>
                                <div className="bg-[#0a0a10] border border-gray-800 rounded-lg p-2">
                                  <p className="text-[9px] text-gray-400 font-mono mb-1">🔗 Link:</p>
                                  <p className="text-[9px] text-green-300 break-all font-mono">{pixAcessoInfo[solId].link}</p>
                                </div>
                                <div className="bg-[#0a0a10] border border-gray-800 rounded-lg p-2 flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-[9px] text-gray-400 font-mono mb-0.5">🔑 Código:</p>
                                    <p className="text-lg font-black text-yellow-400 tracking-widest">{pixAcessoInfo[solId].codigo}</p>
                                  </div>
                                  <button onClick={() => navigator.clipboard.writeText(`Link de acesso: ${pixAcessoInfo[solId].link}\nCódigo: ${pixAcessoInfo[solId].codigo}`)} className="text-[9px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1.5 rounded-lg font-bold flex-shrink-0">📋 Copiar</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {isConfirmado && (
                          <div className="bg-green-950/10 border border-green-900/30 p-2.5 rounded-xl text-center">
                            <span className="text-green-400 text-[10px] font-bold block">✓ Pago &amp; Creditado com sucesso!</span>
                            <span className="text-gray-500 text-[9px] block mt-0.5 mt-1">
                              Creditado Vendedor: {fmt(dados.valor_produto - (dados.valor_produto * 2.5) / 100)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ENTREGA DIGITAL (NOVO) */}
        {activeTab === 'entrega' && (
          <div className="space-y-6" id="admin_tab_entrega_view">
            
            {/* Pendentes */}
            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-display">Pendentes de Entrega Digital</h3>
                <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                  {pendingDeliveries.length}
                </span>
              </div>

              {pendingDeliveries.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono text-center py-8">Todas as vendas pagas possuem registro de liberação / entrega.</p>
              ) : (
                <div className="space-y-3">
                  {pendingDeliveries.map((v) => (
                    <div key={v.id} className="p-4 bg-[#08080d] border border-gray-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-rose-400">{v.dados.produto_nome}</span>
                          <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.2 rounded">PAGO VIA PIX</span>
                        </div>
                        <p className="text-gray-300">Comprador: {v.dados.comprador_nome} • Valor: {fmt(v.dados.valor)}</p>
                        <p className="text-gray-500 text-[10px]">Código ID: {v.id} • Data: {v.dados.data_venda}</p>
                      </div>

                      <span className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold rounded-xl">
                        ✅ Entregue automaticamente
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Realizadas Histórico */}
            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-gray-300 font-display">Entregas Realizadas (Histórico de Liberados)</h3>
              
              {entregas.length === 0 ? (
                <p className="text-xs text-gray-600 font-mono text-center py-6">Nenhum registro de entrega material salvo no banco local.</p>
              ) : (
                <div className="divide-y divide-gray-950 max-h-72 overflow-y-auto">
                  {entregas.map((ent) => (
                    <div key={ent.id} className="py-3 flex items-center justify-between font-mono text-xs gap-3">
                      <div>
                        <span className="font-bold text-white text-xs block">{ent.dados.comprador_nome}</span>
                        <p className="text-gray-400 text-[10px]">{ent.dados.produto_nome} • Valor: {fmt(ent.dados.valor)}</p>
                        <a href={ent.dados.link_entrega} target="_blank" className="text-red-400 hover:underline text-[10.5px] break-all">{ent.dados.link_entrega}</a>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-black">ENTREGUE ({ent.dados.metodo})</span>
                        <p className="text-[9px] text-gray-600 mt-1">Sincronizado: {ent.dados.data_entrega}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AGENTES IA (NOVO - Controle de IA e Fallbacks) */}
        {activeTab === 'agentes' && (
          <div className="space-y-6" id="admin_tab_agentes_view">
            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white font-display mb-1 flex items-center gap-1.5">
                    <Bot className="w-5 h-5 text-orange-400 animate-pulse" />
                    Gerenciamento Central de Agentes IA
                  </h3>
                  <p className="text-xs text-gray-400 font-sans leading-relaxed">Visualize prompts, gerencie ativações de IA e crie modelos de fallback operacional.</p>
                </div>

                <button 
                  onClick={handleCreateDefaultPlatformAgent}
                  className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 transition font-bold font-sans text-[10px] text-white uppercase tracking-wider rounded-xl shadow-lg"
                >
                  + Criar Agente Padrão da Plataforma
                </button>
              </div>

              {agentes.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono text-center py-10">Nenhum agente comercial registrado.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {agentes.map((ag) => (
                    <div key={ag.id} className="p-4 bg-[#08080d] border border-gray-900 hover:border-gray-850 transition p-4 rounded-2xl flex flex-col justify-between gap-4 font-mono text-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white text-sm block truncate">{ag.dados.nome_agente}</span>
                          <span className={`px-1.5 py-0.2 rounded font-black text-[8px] ${
                            ag.dados.vendedor_id === 'PLATFORM' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-gray-800 text-gray-400'
                          }`}>
                            {ag.dados.vendedor_id === 'PLATFORM' ? 'GLOBAL PLATFORM' : 'VENDEDOR EXCLUSIVO'}
                          </span>
                        </div>
                        <p className="text-gray-400">Nicho: {ag.dados.nicho}</p>
                        <p className="text-[10px] text-gray-600 truncate">Vendedor ID: {ag.dados.vendedor_id}</p>
                      </div>

                      <div className="flex items-center justify-between bg-gray-950 p-2 rounded-xl mt-2">
                        <button 
                          onClick={() => {
                            setActivePromptTitle(ag.dados.nome_agente);
                            setActivePromptText(ag.dados.personalidade);
                            setShowPromptModal(true);
                          }}
                          className="px-2.5 py-1.5 bg-gray-900 border border-gray-850 hover:border-gray-800 text-[10px] font-bold tracking-wide rounded-lg flex items-center gap-1 text-gray-400 hover:text-white transition"
                        >
                          <Eye className="w-3.5 h-3.5" /> Ver Prompt Original
                        </button>

                        <button 
                          onClick={() => handleToggleAgentStatus(ag)}
                          className="focus:outline-none"
                        >
                          {ag.dados.ativo ? (
                            <div className="flex items-center gap-1 text-green-400 font-bold select-none text-[10px]">
                              <span>ATIVO</span>
                              <ToggleRight className="w-7 h-7" />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-500 font-bold select-none text-[10px]">
                              <span>PAUSADO</span>
                              <ToggleLeft className="w-7 h-7" />
                            </div>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB logs: Log conversas do agente */}
        {activeTab === 'logs' && (
          <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white font-display">Histórico de Sessões de Checkout e IA</h3>
            <p className="text-xs text-gray-400 font-mono">Veja abaixo logs e fluxos estruturados de prospecção do chatbot.</p>
            
            <div className="p-8 text-center text-gray-500 font-mono text-xs">
              Todas as interações e de vendas psicossociais são arquivadas de acordo com as chaves Pix geradas. Para consultar chaves de compra completas, utilize a aba de vendas ou suporte.
            </div>
          </div>
        )}


        {/* FIX 7: TAB catalogo — editar produtos */}
        {activeTab === 'catalogo' && (
          <div className="space-y-6">
            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-gray-900 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                    <Box className="w-4 h-4 text-orange-400" /> Catálogo de Produtos
                  </h3>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">Edite nome, imagem, descrição, preço e status de cada produto.</p>
                </div>
                <button onClick={() => sbGetAll<any>('produtos').then(d => setCatalogoProdutos(d.sort((a:any,b:any)=>b.ts-a.ts)))}
                  className="px-3 py-1.5 bg-[#12121c] hover:bg-gray-800 border border-gray-800 rounded-xl text-xs text-gray-300 font-mono flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                </button>
              </div>

              {catalogoProdutos.length === 0 ? (
                <p className="text-xs text-gray-500 font-mono text-center py-12">Nenhum produto cadastrado ainda.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {catalogoProdutos.map((prod: any) => {
                    const foto = prod.dados?.foto_base64 || prod.dados?.foto_url || '';
                    const ativo = prod.dados?.ativo !== false;
                    return (
                      <div key={prod.id} className="p-4 bg-[#08080d] border border-gray-900 rounded-2xl flex flex-col gap-3">
                        <div className="flex gap-3 items-start">
                          {foto ? (
                            <img src={foto} alt={prod.dados?.nome} className="w-16 h-16 rounded-xl object-cover flex-shrink-0 border border-gray-800" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0">
                              <Box className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white text-sm truncate">{prod.dados?.nome || 'Sem nome'}</p>
                            <p className="text-gray-400 text-xs mt-0.5 line-clamp-2">{prod.dados?.descricao || 'Sem descrição'}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-green-400 font-bold text-xs">R$ {(prod.dados?.preco || 0).toFixed(2)}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ativo ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                {ativo ? 'ATIVO' : 'INATIVO'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setEditProduto({ ...prod, dados: { ...prod.dados } })}
                          className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5">
                          ✏️ Editar Produto
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal edição produto */}
            {editProduto && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-[#0e0e16] border border-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-white">✏️ Editar Produto</h3>
                    <button onClick={() => { setEditProduto(null); setProdFeedback(''); }} className="text-gray-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Nome</label>
                      <input value={editProduto.dados.nome || ''} onChange={e => setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, nome: e.target.value } }))}
                        className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Descrição</label>
                      <textarea value={editProduto.dados.descricao || ''} rows={3} onChange={e => setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, descricao: e.target.value } }))}
                        className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100 resize-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Preço (R$)</label>
                      <input type="number" step="0.01" value={editProduto.dados.preco || ''} onChange={e => setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, preco: parseFloat(e.target.value) || 0 } }))}
                        className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Imagem do Produto</label>
                      {/* Upload de arquivo */}
                      <label className="flex items-center gap-2 w-full cursor-pointer bg-[#12121e] border border-dashed border-gray-600 hover:border-red-500 rounded-xl px-3 py-2.5 text-xs text-gray-400 transition mb-2">
                        <span>📁 Clique para enviar foto</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const b64 = ev.target?.result as string;
                            setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, foto_base64: b64, foto_url: '' } }));
                          };
                          reader.readAsDataURL(file);
                        }} />
                      </label>
                      {/* Ou URL */}
                      <input value={editProduto.dados.foto_url || ''} onChange={e => setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, foto_url: e.target.value, foto_base64: '' } }))}
                        placeholder="Ou cole URL da imagem: https://..."
                        className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100" />
                      {(editProduto.dados.foto_base64 || editProduto.dados.foto_url) && (
                        <img src={editProduto.dados.foto_base64 || editProduto.dados.foto_url} alt="" className="mt-2 w-full h-32 object-cover rounded-xl border border-gray-700" />
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Status</label>
                      <div className="flex gap-2">
                        {['Ativo', 'Inativo'].map(s => (
                          <button key={s} type="button"
                            onClick={() => setEditProduto((p: any) => ({ ...p, dados: { ...p.dados, ativo: s === 'Ativo' } }))}
                            className={'flex-1 py-2 rounded-xl text-xs font-bold transition ' + (editProduto.dados.ativo === (s === 'Ativo') ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700')}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {prodFeedback && <p className={`text-xs text-center font-bold ${prodFeedback.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>{prodFeedback}</p>}

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setEditProduto(null); setProdFeedback(''); }} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition">Cancelar</button>
                    <button
                      disabled={prodSaving}
                      onClick={async () => {
                        setProdSaving(true);
                        setProdFeedback('');
                        try {
                          const ok = await sbUpsert('produtos', editProduto);
                          if (ok) {
                            setProdFeedback('✅ Produto salvo com sucesso!');
                            setCatalogoProdutos(prev => prev.map((p: any) => p.id === editProduto.id ? editProduto : p));
                            setTimeout(() => { setEditProduto(null); setProdFeedback(''); }, 1500);
                          } else { setProdFeedback('❌ Erro ao salvar. Tente novamente.'); }
                        } catch { setProdFeedback('❌ Erro de conexão.'); }
                        finally { setProdSaving(false); }
                      }}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition">
                      {prodSaving ? '⏳ Salvando...' : '💾 Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB config: Configurações Gerais */}
        {activeTab === 'config' && (
          <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-bold text-white font-display mb-1">Configurações de Cobrança e Margens</h3>
              <p className="text-xs text-gray-400 font-mono">Parametros de governança padrão SaaS aplicados no PaguSeguro Pro.</p>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const configRecord = {
                  id: 'global_config',
                  ts: Date.now(),
                  dados: {
                    taxa_venda: parseFloat(systemFee) || 2.50,
                    taxa_saque: parseFloat(taxaSaqueFee) || 2.50,
                    gateway_api: apiGateway
                  }
                };
                await sbUpsert('config', configRecord);
                setSavedConfig(true);
                setTimeout(() => setSavedConfig(false), 3000);
              } catch (err) {
                console.error(err);
                alert('Erro ao persistir configurações globais no Supabase.');
              }
            }} className="space-y-4 font-mono text-xs max-w-md">
              <div>
                <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Taxa de Intermediação de Venda (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={systemFee}
                  onChange={(e) => setSystemFee(e.target.value)}
                  className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Taxa de Resgate de Saque (%)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={taxaSaqueFee}
                  onChange={(e) => setTaxaSaqueFee(e.target.value)}
                  className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase">Processador Oficial de Compensação Pix</label>
                <input 
                  type="text" 
                  value={apiGateway}
                  onChange={(e) => setApiGateway(e.target.value)}
                  className="w-full bg-[#12121e] border border-gray-800 focus:outline-none focus:border-red-500 rounded-xl px-3 py-2 text-xs text-gray-100 font-bold text-red-500"
                />
              </div>

              <button 
                type="submit"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 transition rounded-xl font-bold uppercase"
              >
                Gravar Configuração
              </button>

              {savedConfig && (
                <p className="text-green-400 text-xs font-semibold">Configurações globais salvas e atualizadas com sucesso!</p>
              )}
            </form>
          </div>
        )}

        {/* TAB Agente Pro: Inteligência Estratégica Executiva & Console */}
        {activeTab === 'agentePro' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 min-h-[640px]">
            {/* Esquerda: Painel lateral de Ações Rápidas do Console */}
            <div className="xl:col-span-4 bg-[#0c0c14] border border-gray-900 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <div>
                <span className="text-[9px] bg-red-650/20 text-red-400 border border-red-500/10 px-2.5 py-1 rounded-full font-mono font-bold uppercase tracking-wider">MODO MANUAL DE GOVERNANÇA</span>
                <h3 className="text-sm font-black text-white mt-2 font-display">✦ Terminal Agente Pro</h3>
                <p className="text-[11px] text-gray-500 font-sans mt-1 leading-relaxed">
                  Terminal de auto-execução em lote. Envie ordens em português para modificar o banco de dados Supabase em tempo real com o Agente Pro.
                </p>
              </div>

              <hr className="border-gray-900" />

              <span className="text-[10px] text-gray-400 font-mono font-bold uppercase tracking-wider block">Disparadores de Ações Rápidas</span>
              
              <div className="space-y-2 flex-1">
                <button 
                  onClick={() => handleQueryAgentePro('Faça uma auditoria geral sobre a saúde financeira e conversão de transações do gateway baseando-se no faturamento total processado e taxas.')}
                  disabled={proLoading}
                  className="w-full p-3 bg-[#11111a] hover:bg-[#141424] border border-gray-850 hover:border-red-500/20 text-left rounded-xl transition font-sans cursor-pointer group flex flex-col"
                >
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition flex items-center gap-1.5">
                    📈 Auditoria de Faturamento
                  </span>
                  <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">Relatório das taxas cobradas e margens de liquidez do gateway.</span>
                </button>

                <button 
                  onClick={() => handleQueryAgentePro('Audite as solicitações de saques pendentes, resgates efetuados e comportamento de vendedores para apontar possíveis fraudes ou saques de alto risco.')}
                  disabled={proLoading}
                  className="w-full p-3 bg-[#11111a] hover:bg-[#141424] border border-gray-850 hover:border-red-500/20 text-left rounded-xl transition font-sans cursor-pointer group flex flex-col"
                >
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition flex items-center gap-1.5">
                    🛡️ Engenharia de Risco
                  </span>
                  <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">Analisa saques recentes e aponta comportamento suspeito.</span>
                </button>

                <button 
                  onClick={() => handleQueryAgentePro('Analise a lista de agentes do sistema e crie um roteiro ideal de abordagem psicológica para impulsionar a taxa de fechamento Pix nas vendas.')}
                  disabled={proLoading}
                  className="w-full p-3 bg-[#11111a] hover:bg-[#141424] border border-gray-850 hover:border-red-500/20 text-left rounded-xl transition font-sans cursor-pointer group flex flex-col"
                >
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition flex items-center gap-1.5">
                    💬 Roteiro de Conversão
                  </span>
                  <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">Ajusta roteiro tático para abordagem de vendas.</span>
                </button>

                <button 
                  onClick={() => handleQueryAgentePro('Elabore uma campanha promocional copy para atrair mais infoprodutores a ingressarem como vendedores no PaguSeguro Pro.')}
                  disabled={proLoading}
                  className="w-full p-3 bg-[#11111a] hover:bg-[#141424] border border-gray-850 hover:border-red-500/20 text-left rounded-xl transition font-sans cursor-pointer group flex flex-col"
                >
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition flex items-center gap-1.5">
                    ⚙️ Atração de Vendedores
                  </span>
                  <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">Modelagem de chamadas persuasivas para infoprodutores.</span>
                </button>

                <button 
                  onClick={() => handleQueryAgentePro('Fazer uma varredura geral e listar de forma analítica todos os vendedores pendentes de aprovação e saques em aberto.')}
                  disabled={proLoading}
                  className="w-full p-3 bg-[#11111a] hover:bg-[#141424] border border-gray-850 hover:border-red-500/20 text-left rounded-xl transition font-sans cursor-pointer group flex flex-col"
                >
                  <span className="text-xs font-bold text-white group-hover:text-red-400 transition flex items-center gap-1.5">
                    📋 Listagem de Pendências
                  </span>
                  <span className="text-[9.5px] text-gray-500 font-mono mt-0.5">Lista de decisões táticas prioritárias e faturamento pendente.</span>
                </button>
              </div>

              <div className="bg-[#08080d] border border-gray-900 rounded-2xl p-3 text-center">
                <span className="text-[9px] text-gray-500 block font-mono uppercase">CONEXÃO SEGUNDA CAMADA</span>
                <span className="text-[11px] text-green-400 font-mono font-bold mt-1 block">● GOVERNANÇA OPERACIONAL SEGURA</span>
              </div>
            </div>

            {/* Direita: Interface Interativa do Chat Console */}
            <div className="xl:col-span-8 bg-[#0c0c14] border border-gray-900 rounded-3xl p-5 shadow-xl flex flex-col justify-between min-h-[600px] h-[640px]">
              
              {/* Header do Chat Console */}
              <div className="flex justify-between items-center border-b border-gray-900 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase font-display tracking-widest">Agente Pro Console</h4>
                    <p className="text-[9px] text-gray-500 font-mono">Consolidação Real Supabase Via API</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setProChatHistory([
                      {
                        role: 'agent',
                        text: 'Olá Master! Eu sou o ✦ Agente Pro. Estou pronto para gerenciar todo o ecossistema PaguSeguro Pro. Caso queira, você pode me guiar em linguagem natural sem restrições (ex: "aprovar vendedor Silva", "alterar a comissão do gateway para 3%", "zerar saldos", etc.) para que eu audite e aplique diretamente no Supabase em tempo real.',
                        ts: Date.now()
                      }
                    ]);
                    setProOutput('');
                  }}
                  className="text-[10px] bg-[#11111a] hover:bg-red-950/20 text-gray-400 hover:text-red-400 border border-gray-850 hover:border-red-500/20 px-2.5 py-1 rounded-lg transition font-mono cursor-pointer"
                >
                  Zerar Histórico
                </button>
              </div>

              {/* Corpo de Mensagens do Chat Scrollable */}
              <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 font-mono scrollbar-thin scrollbar-thumb-gray-800" id="agente_pro_chat_scroll">
                {proChatHistory.map((msg, i) => (
                  <div 
                    key={i}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mb-1">
                      <span>{msg.role === 'user' ? 'MASTER' : '✦ AGENTE PRO'}</span>
                      <span>•</span>
                      <span>{new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div 
                      className={`max-w-[90%] p-3.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user' 
                          ? 'bg-red-600 text-white font-sans rounded-tr-none' 
                          : 'bg-[#11111a] border border-gray-850 text-gray-200 rounded-tl-none font-mono'
                      }`}
                    >
                      {msg.text}

                      {msg.operations && msg.operations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-gray-900 text-[10px] text-green-400 space-y-1">
                          <span className="font-bold uppercase tracking-wider block">✓ Mutação Executada por IA:</span>
                          {msg.operations.map((op: any, idx: number) => (
                            <div key={idx} className="bg-[#090910] p-1.5 rounded-lg border border-gray-950 flex items-center justify-between mt-1">
                              <span>Action: <strong className="text-yellow-400 uppercase font-bold">{op.action}</strong> ({op.table})</span>
                              <span className="text-gray-500 text-[9px]">ID: {op.record.id?.slice(0, 10)}...</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {proLoading && (
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-500 mb-1">
                      <span>✦ AGENTE PRO</span>
                      <span>•</span>
                      <span>processando...</span>
                    </div>
                    <div className="bg-[#11111a] border border-gray-850 p-4 rounded-2xl rounded-tl-none text-xs flex items-center gap-3">
                      <RefreshCw className="w-4.5 h-4.5 animate-spin text-red-500" />
                      <span className="text-gray-400 text-[11px] animate-pulse">Compilando escopo e aplicando alterações dinâmicas ao Supabase...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Campo para Inserção de Comandos do Chat */}
              <div className="border-t border-gray-900 pt-3 space-y-2">
                {/* Preview da imagem selecionada */}
                {proImageBase64 && (
                  <div className="flex items-center gap-2 bg-[#11111a] border border-gray-800 rounded-xl px-3 py-2">
                    <img src={`data:${proImageMime};base64,${proImageBase64}`} alt="preview" style={{width:40,height:40,objectFit:'cover',borderRadius:6}} />
                    <span className="text-[10px] text-gray-400 font-mono flex-1">Imagem anexada</span>
                    <button onClick={() => { setProImageBase64(''); setProImageMime(''); }} className="text-red-400 text-[10px] hover:text-red-300">✕ remover</button>
                  </div>
                )}
                <div className="flex gap-2">
                  {/* Botão de upload de imagem */}
                  <label className="flex items-center justify-center w-10 h-10 bg-[#12121e] border border-gray-800 hover:border-red-500/40 rounded-xl cursor-pointer transition" title="Anexar imagem">
                    <input type="file" accept="image/*" onChange={handleProImageUpload} className="hidden" />
                    <span className="text-base">📎</span>
                  </label>
                  <input 
                    type="text"
                    value={proQueryInput}
                    onChange={(e) => setProQueryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && proQueryInput.trim()) {
                        handleQueryAgentePro();
                      }
                    }}
                    disabled={proLoading}
                    placeholder="Instrua o Agente Pro (Ex: 'zerar o saldo de joao', 'mudar taxa global de saque para 4.2%', 'aprovar silva')..."
                    className="flex-1 bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-3 text-xs text-gray-100 placeholder-gray-500 font-mono"
                  />
                  <button 
                    onClick={() => handleQueryAgentePro()}
                    disabled={proLoading || !proQueryInput.trim()}
                    className="px-5 bg-red-600 hover:bg-red-700 transition disabled:opacity-45 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar
                  </button>
                </div>
              </div>

            </div>
          </div>

            {/* SEÇÃO INTEGRADA: AUTO-EVOLUÇÃO DO CÓDIGO FONTE E FILE DEV STUDIO */}
            <div className="bg-[#0c0c14] border border-gray-900 rounded-3xl p-6 shadow-xl space-y-6">
              <header className="border-b border-gray-900 pb-4">
                <span className="text-[9px] bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">✦ AMBIENTE DE DESENVOLVIMENTO INTEGRADO</span>
                <h3 className="text-base font-extrabold text-white font-display mt-2 flex items-center gap-2">
                  🛠️ Workspace Real-Time File Developer (IDE) & AI Architecture Auto-Coder
                </h3>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  Sem restrições. Você pode selecionar e editar manualmente qualquer arquivo-fonte do sistema ou usar a **IA Desenvolvedora Ultra** para auto-escrever novas melhorias no backend, frontend, hooks ou componentes!
                </p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Lado Esquerdo: Editor / Visualizador Manual de Código do Projeto */}
                <div className="lg:col-span-7 bg-[#11111a] border border-gray-850 rounded-2xl p-5 space-y-4 flex flex-col">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-gray-900 pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Navegador e Editor de Arquivos</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">Selecione o arquivo ativo no workspace do servidor</p>
                    </div>
                    <select
                      value={selectedFile}
                      onChange={(e) => handleSelectFile(e.target.value)}
                      className="bg-[#181826] text-xs text-gray-100 font-mono border border-gray-800 rounded-xl px-2.5 py-1.5 focus:border-indigo-500 focus:outline-none min-w-[200px]"
                    >
                      {fileList.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  {isReadingFile ? (
                    <div className="py-20 flex flex-col justify-center items-center text-center space-y-3">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      <p className="text-[10px] text-gray-500 font-mono">Lendo código em tempo real do disco...</p>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 flex flex-col">
                      <label className="text-[10px] text-gray-400 font-mono uppercase block">Conteúdo Atual do Arquivo selecionado ({selectedFile || 'Nenhum'}):</label>
                      <textarea
                        value={fileContent}
                        onChange={(e) => setFileContent(e.target.value)}
                        rows={16}
                        className="w-full bg-[#07070b] border border-gray-900 focus:border-indigo-500 focus:outline-none rounded-xl p-4 text-xs text-indigo-300 font-mono leading-relaxed"
                        placeholder="Selecione um arquivo para carregar e editar o código-fonte..."
                      />
                      
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <p className="text-[10px] text-yellow-500 font-mono leading-relaxed">
                          ⚠️ Qualquer gravação será compilada ao vivo no servidor de produção.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={fetchEditableFiles}
                            type="button"
                            className="bg-gray-900 hover:bg-gray-850 text-gray-300 text-[11px] font-bold px-3 py-2 rounded-xl"
                            title="Recarregar arquivos"
                          >
                            Recarregar
                          </button>
                          <button
                            onClick={handleManualSaveFile}
                            disabled={isSavingFile || !selectedFile}
                            type="button"
                            className="bg-indigo-650 hover:bg-indigo-700 disabled:opacity-45 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-md cursor-pointer transition active:scale-[0.98]"
                          >
                            {isSavingFile ? 'Salvando...' : '💾 Gravar Código no Disco'}
                          </button>
                        </div>
                      </div>

                      {saveStatus && (
                        <p className="text-xs text-yellow-400 font-mono font-bold bg-yellow-500/10 p-2.5 rounded-xl border border-yellow-500/20 text-center animate-pulse mt-2">
                          {saveStatus}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Lado Direito: IA Programadora Master AI Auto-Coder */}
                <div className="lg:col-span-5 bg-[#11111a] border border-gray-850 rounded-2xl p-5 space-y-4">
                  <div>
                    <span className="text-[9px] bg-red-650/20 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase">✦ ENGENHARIA NEURAL RECURSIVA</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display mt-1">IA Programadora Auto-Coder</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">
                      Descreva melhorias, novos botões, novos designs ou comportamentos. A IA irá reescrever, aplicar as alterações diretamente e expor as mudanças de forma automatizada.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] text-gray-400 font-mono uppercase block mb-1">O que a IA deve programar ou consertar no sistema?</label>
                      <textarea
                        value={devPrompt}
                        onChange={(e) => setDevPrompt(e.target.value)}
                        placeholder="Ex: 'Adicione um gráfico recharts para analisar o crescimento diário de vendas logo acima da lista de transações' ou 'mude a cor dos botões de saque para vermelho intenso e mude o texto para Enviar Pix'..."
                        rows={6}
                        disabled={isRewritingCode}
                        className="w-full bg-[#151522] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl p-3 text-xs text-gray-100 placeholder-gray-500 font-mono"
                      />
                    </div>

                    <button
                      onClick={handleDevAIRewrite}
                      disabled={isRewritingCode || !devPrompt.trim()}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 transition cursor-pointer text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-1.5"
                    >
                      {isRewritingCode && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {isRewritingCode ? 'Auto-Programando Sistema...' : '🚀 Disparar Escrita de Código Neural'}
                    </button>

                    {devAIOutput && (
                      <div className="p-3.5 bg-[#07070b]/90 border border-gray-900 rounded-xl space-y-2">
                        <span className="text-[10px] text-red-500 font-mono font-bold block pb-1 border-b border-gray-950">📡 RESPOSTA DO AMBIENTE NEURAL:</span>
                        <div className="text-[10.5px] text-gray-305 font-mono leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-1">
                          {devAIOutput}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL VER PROMPT COMPLETO */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4" id="view_prompt_modal">
          <div className="bg-[#0e0e16] border border-gray-850 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-1.5 font-display">🧠 Prompt Original: {activePromptTitle}</h3>
            <p className="text-[10px] text-gray-500 font-mono mb-4 border-b border-gray-900 pb-2">Governança de IA Comercial PaguSeguro Pro</p>

            <div className="p-3 bg-[#0a0a0f] border border-gray-900 rounded-2xl max-h-60 overflow-y-auto">
              <p className="text-xs text-gray-300 font-mono whitespace-pre-line leading-relaxed">{activePromptText}</p>
            </div>

            <button 
              onClick={() => setShowPromptModal(false)}
              className="mt-5 w-full py-2 bg-gray-800 hover:bg-gray-700 font-bold rounded-xl text-xs text-gray-300 transition"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}
      {/* Modal de edição de vendedor */}
      {editVendedor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e0e16] border border-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">✏️ Editar Conta</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">{editVendedor.dados.nome}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 font-mono uppercase mb-1 font-bold">Nova Senha <span className="text-gray-600 normal-case">(deixe em branco para não alterar)</span></label>
                <input
                  type="text"
                  value={editSenha}
                  onChange={e => setEditSenha(e.target.value)}
                  placeholder="Nova senha..."
                  className="w-full bg-[#12121e] border border-gray-700 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-gray-100 font-mono"
                />
              </div>
              <div className="bg-[#0a0a10] border border-gray-800/60 rounded-xl p-3 text-[10px] text-gray-500 font-mono space-y-0.5">
                <p>Chave Pix: <span className="text-yellow-400">{editVendedor.dados.chave_pix}</span></p>
                <p>Banco: {editVendedor.dados.banco}</p>
                <p>WhatsApp: {editVendedor.dados.whatsapp}</p>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setEditVendedor(null)} className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-xl transition">Cancelar</button>
              <button onClick={handleSalvarEdicaoVendedor} disabled={editSaving} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition">
                {editSaving ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
