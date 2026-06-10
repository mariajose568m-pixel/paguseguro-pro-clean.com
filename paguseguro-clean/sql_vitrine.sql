-- =====================================================
-- PaguSeguro Pro - SQL de Atualização da Vitrine
-- Rode no SQL Editor do Supabase (projeto btsinmraiualdhercsvu)
-- =====================================================

-- 1. Adicionar campos de perfil estendido na tabela vendedores
-- (Os dados ficam dentro do JSONB "dados", então não precisamos ALTER TABLE)
-- Basta garantir que a tabela existe:
CREATE TABLE IF NOT EXISTS vendedores (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);
CREATE TABLE IF NOT EXISTS produtos (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);
CREATE TABLE IF NOT EXISTS agentes (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);
CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);
CREATE TABLE IF NOT EXISTS pix_solicitacoes (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);
CREATE TABLE IF NOT EXISTS conversas_log (id TEXT PRIMARY KEY, ts BIGINT, dados JSONB);

-- 2. Desabilitar RLS em todas
ALTER TABLE vendedores DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE agentes DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE pix_solicitacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversas_log DISABLE ROW LEVEL SECURITY;

-- 3. Índices para performance nas buscas JSONB
CREATE INDEX IF NOT EXISTS idx_vendedores_slug ON vendedores ((dados->>'slug'));
CREATE INDEX IF NOT EXISTS idx_produtos_vendedor ON produtos ((dados->>'vendedor_id'));
CREATE INDEX IF NOT EXISTS idx_agentes_vendedor ON agentes ((dados->>'vendedor_id'));
CREATE INDEX IF NOT EXISTS idx_leads_vendedor ON leads ((dados->>'vendedor_id'));
CREATE INDEX IF NOT EXISTS idx_leads_slug ON leads ((dados->>'vendedor_slug'));
CREATE INDEX IF NOT EXISTS idx_pix_sol_vendedor ON pix_solicitacoes ((dados->>'vendedor_id'));

-- =====================================================
-- EXEMPLO: como cadastrar um vendedor com perfil completo
-- (só pra referência, não precisa rodar)
-- =====================================================
/*
INSERT INTO vendedores (id, ts, dados) VALUES (
  'vend_exemplo',
  extract(epoch from now())::bigint * 1000,
  '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "slug": "joaosilva",
    "whatsapp": "11999999999",
    "chave_pix": "joao@email.com",
    "saldo": 0,
    "saldo_pendente": 0,
    "aprovado": true,
    "taxa_comissao": 10,
    "bio": "Especialista em...",
    "nicho": "fitness",
    "instagram": "joaosilva",
    "twitter": "joaosilva",
    "tiktok": "joaosilva",
    "total_conteudo": 5,
    "total_midias": 48,
    "total_curtidas": 1200,
    "nome_agente_publico": "Max Pro"
  }'
) ON CONFLICT (id) DO NOTHING;
*/
