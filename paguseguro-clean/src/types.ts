export interface Vendedor {
  id: string;
  ts: number;
  dados: {
    nome: string;
    email: string;
    slug: string;
    whatsapp: string;
    documento: string;
    banco: string;
    chave_pix: string;
    taxa_comissao: number; // e.t. 10%
    saldo: number;
    saldo_pendente: number;
    aprovado: boolean;
    data_cadastro: string;
    avatar_base64?: string;
    telegram_chat_id?: string;
  };
}

export interface Produto {
  id: string;
  ts: number;
  dados: {
    vendedor_id: string;
    nome: string;
    descricao: string;
    preco: number;
    link_original: string;
    ativo: boolean;
    nicho?: string;
    foto_base64?: string;
    conteudo_interno?: string;
    tem_conteudo_proprio?: boolean;
    arquivo_base64?: string;
    arquivo_tipo?: string;
    pre_lancamento?: boolean;
    // Modo Local
    modo_local?: boolean;           // true = serviço presencial
    aceita_pagar_chegada?: boolean; // true = permite pagar na chegada
    // Catálogo PaguSeguro
    is_catalogo_paguseguro?: boolean; // true = produto do catálogo da plataforma
    taxa_plataforma_override?: number; // ex: 0.55 para produtos do catálogo
  };
}

export interface Venda {
  id: string;
  ts: number;
  dados: {
    vendedor_id: string;
    produto_id: string;
    produto_nome: string;
    valor: number;
    comprador_nome: string;
    comprador_email: string;
    comprador_telefone: string;
    status_venda: 'pendente' | 'pago' | 'cancelado';
    data_venda: string;
    metodo_pagamento: string;
    pixel_id?: string;
    chat_id?: string;
    taxa_plataforma?: number;
    valor_liquido?: number;
    entregue?: boolean;
    link_entrega?: string;
    data_entrega?: string;
    modo_local?: boolean;
    pagar_chegada?: boolean;
    data_agendamento?: string;
  };
}

export interface Saque {
  id: string;
  ts: number;
  dados: {
    vendedor_id: string;
    vendedor_nome: string;
    valor: number;
    chave_pix: string;
    banco: string;
    status: 'pendente' | 'pago' | 'recusado';
    data_solicitacao: string;
    data_processamento?: string;
    taxa_saque?: number;
    valor_liquido?: number;
  };
}

export interface ConversaLog {
  id: string;
  ts: number;
  dados: {
    chat_id: string;
    vendedor_id: string;
    comprador_nome: string;
    produto_nome: string;
    mensagens: Array<{
      remetente: 'comprador' | 'ia';
      texto: string;
      ts: number;
    }>;
    status: 'chatting' | 'abandoned' | 'paid';
    ultima_interacao: string;
  };
}

export interface Agente {
  id: string;
  ts: number;
  dados: {
    vendedor_id: string;
    nome_agente: string;
    personalidade: string;
    nicho: string;
    ativo: boolean;
  };
}

export interface ProdutoQA {
  id: string;
  ts: number;
  dados: {
    vendedor_id: string;
    produto_nome: string;
    produto_desc: string;
    perguntas_usadas: number;
    limite_perguntas: number;
    comprador_nome: string;
    comprador_contato: string;
    historico_qa: Array<{
      pergunta: string;
      resposta: string;
      ts: number;
    }>;
  };
}

export interface Entrega {
  id: string;
  ts: number;
  dados: {
    chat_id: string;
    vendedor_id: string;
    comprador_nome: string;
    produto_nome: string;
    valor: number;
    link_entrega: string;
    mensagem: string;
    metodo: 'whatsapp' | 'telegram' | 'email';
    entregue: boolean;
    data_entrega?: string;
  };
}

export interface Acesso {
  id: string;       // token único ex: "acesso_xK9mP2"
  ts: number;
  dados: {
    venda_id: string;
    vendedor_id: string;
    produto_id: string;
    produto_nome: string;
    comprador_nome: string;
    comprador_whatsapp: string;
    valor: number;
  };
}
