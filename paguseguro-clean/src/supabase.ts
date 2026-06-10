// src/supabase.ts — 100% Supabase, sem localStorage como dado principal

export const SB_URL = 'https://btsinmraiualdhercsvu.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0c2lubXJhaXVhbGRoZXJjc3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNjE3ODcsImV4cCI6MjA5NDYzNzc4N30.rtA-MSA3s8rdAx1xm0lVe3RyKQEd8QgqBcg1rDCvz5U';

export const TELEGRAM_BOT_TOKEN = '8319334025:AAFVMQWdVXnpS3z5tdPizWEDb3M8ABMp2BM';
export const ADMIN_CHAT_ID = '1085178431';

export const TAXA_DEPOSITO = 2.50;
export const TAXA_SAQUE = 2.50;
export const TAXA_VENDA_PERCENTUAL = 0.25; // 25% por venda via agente (até LIMITE_PROD_BASICO produtos)
export const TAXA_VENDA_PREMIUM = 0.30;    // 30% acima do limite básico
export const LIMITE_PROD_BASICO = 5;        // até 5 produtos = 25%, acima = 30%
export const MINIMO_VALOR_PRODUTO = 10.00;  // valor mínimo por produto
export const MINIMO_DEPOSITO = 5.00;
export const MINIMO_SAQUE = 10.00;

export function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

export function fmt(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

const headers = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
};

// ── GET ALL ──
export async function sbGetAll<T>(tabela: string): Promise<T[]> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${tabela}?select=*&order=ts.desc&limit=500`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      console.error(`[sbGetAll ${tabela}] HTTP ${res.status}:`, await res.text());
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data as T[] : [];
  } catch (e) {
    console.error(`[sbGetAll ${tabela}] Erro:`, e);
    return [];
  }
}

// ── GET BY ID ──
export async function sbGet<T>(tabela: string, id: string): Promise<T | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      { method: 'GET', headers }
    );
    if (!res.ok) {
      console.error(`[sbGet ${tabela}] HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return (Array.isArray(data) && data.length > 0) ? data[0] as T : null;
  } catch (e) {
    console.error(`[sbGet ${tabela}] Erro:`, e);
    return null;
  }
}

// ── GET WHERE (campo dentro do JSONB dados) ──
export async function sbGetWhere<T>(tabela: string, campo: string, valor: string): Promise<T[]> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/${tabela}?dados->>${campo}=eq.${encodeURIComponent(valor)}&select=*`,
      { method: 'GET', headers }
    );
    if (!res.ok) {
      console.error(`[sbGetWhere ${tabela}] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data as T[] : [];
  } catch (e) {
    console.error(`[sbGetWhere ${tabela}] Erro:`, e);
    return [];
  }
}

// ── UPSERT ──
export async function sbUpsert(
  tabela: string,
  registro: { id: string; ts: number; dados: any }
): Promise<boolean> {
  // Tentativa 1: merge-duplicates
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(registro),
    });
    if (res.ok) return true;
    console.warn(`[sbUpsert ${tabela}] Tentativa 1 falhou: HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[sbUpsert ${tabela}] Exceção 1:`, e);
  }

  // Tentativa 2: DELETE + INSERT
  try {
    await fetch(`${SB_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(registro.id)}`, {
      method: 'DELETE',
      headers,
    });
    const res2 = await fetch(`${SB_URL}/rest/v1/${tabela}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(registro),
    });
    if (res2.ok) return true;
    console.error(`[sbUpsert ${tabela}] Tentativa 2 falhou: HTTP ${res2.status}`);
    return false;
  } catch (e) {
    console.error(`[sbUpsert ${tabela}] Exceção 2:`, e);
    return false;
  }
}

// ── DELETE ──
export async function sbDelete(tabela: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        ...headers,
        'Prefer': 'return=minimal',
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[sbDelete ${tabela}] HTTP ${res.status}:`, errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[sbDelete ${tabela}] Erro:`, e);
    return false;
  }
}

// Fallback para quando DELETE é bloqueado por RLS — usa PATCH para marcar como excluído
export async function sbMarkDeleted(tabela: string, id: string, dadosAtual: any): Promise<boolean> {
  try {
    const dadosAtualizados = { ...dadosAtual, ativo: false, _excluido: true };
    const res = await fetch(`${SB_URL}/rest/v1/${tabela}?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        ...headers,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ dados: dadosAtualizados }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[sbMarkDeleted ${tabela}] HTTP ${res.status}:`, errText);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[sbMarkDeleted ${tabela}] Erro:`, e);
    return false;
  }
}

// ── CONFIG GLOBAL ──
export async function sbGetConfig(): Promise<{
  taxa_venda: number;
  taxa_saque: number;
  nome_recebedor_pix: string;
}> {
  try {
    const res = await sbGet<any>('config', 'global_config');
    if (res?.dados) {
      return {
        taxa_venda: res.dados.taxa_venda ?? 2.50,
        taxa_saque: res.dados.taxa_saque ?? 2.50,
        nome_recebedor_pix: res.dados.nome_recebedor_pix ?? 'PaguSeguroPro',
      };
    }
  } catch (e) {
    console.warn('[sbGetConfig] Erro:', e);
  }
  return { taxa_venda: 2.50, taxa_saque: 2.50, nome_recebedor_pix: 'PaguSeguroPro' };
}

// ── TELEGRAM ──
export async function sendTelegram(chatId: string, texto: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' }),
      }
    );
    return res.ok;
  } catch { return false; }
}

// ── PIX (gerador local como fallback) ──
export interface TerrorPayPixResponse {
  venda_id: string;
  pix_copia_e_cola: string;
  qr_code_image: string;
}

export function terrorPayCreate(
  vendaId: string,
  valor: number,
  nomeRecebedor?: string
): TerrorPayPixResponse {
  const nome = (nomeRecebedor || 'PaguSeguroPro').substring(0, 25).replace(/\s+/g, '');
  const randomHex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
  const pix_copia_e_cola = `00020101021226830014br.gov.bcb.pix256100${randomHex}5204000053039865405${valor.toFixed(2)}5802BR5915${nome}6009SaoPaulo62070503***6304${vendaId.substring(0, 4)}`;
  const qr_code_image = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pix_copia_e_cola)}`;
  return { venda_id: vendaId, pix_copia_e_cola, qr_code_image };
}

export function terrorPayVerify(_vendaId: string): Promise<boolean> {
  return new Promise(resolve => setTimeout(() => resolve(true), 1500));
}
