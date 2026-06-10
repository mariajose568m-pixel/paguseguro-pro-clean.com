import React, { useState, useEffect } from 'react';
import { sbGetAll, sbUpsert, uid } from './supabase';
import { Vendedor } from './types';
import PublicBioPage from './components/PublicBioPage';
import PublicPrivatePage from './components/PublicPrivatePage';
import PublicQAPage from './components/PublicQAPage';
import SellerDashboard from './components/SellerDashboard';
import AdminPanel from './components/AdminPanel';
import { Bot, Sparkles, LogIn, UserPlus, Key, ShieldAlert, ArrowRight, BookOpen, CheckCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<URLSearchParams>(new URLSearchParams(window.location.search));
  
  // Platform App states
  const [currentSeller, setCurrentSeller] = useState<Vendedor | null>(null);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginSenha, setLoginSenha] = useState<string>('');
  const [showLoginSenha, setShowLoginSenha] = useState<boolean>(false);
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [sellerError, setSellerError] = useState<string>('');

  // Register Form states
  const [regNome, setRegNome] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regSlug, setRegSlug] = useState<string>('');
  const [regWhats, setRegWhats] = useState<string>('');
  const [regDoc, setRegDoc] = useState<string>('');
  const [regBanco, setRegBanco] = useState<string>('');
  const [regPix, setRegPix] = useState<string>('');
  const [regSenha, setRegSenha] = useState<string>('');
  const [showRegSenha, setShowRegSenha] = useState<boolean>(false);

  // Admin login states
  const [adminLoggedIn, setAdminLoggedIn] = useState<boolean>(false);
  const [showAdminPassModal, setShowAdminPassModal] = useState<boolean>(false);
  const [adminModalPass, setAdminModalPass] = useState<string>('');
  const [showAdminModalPass, setShowAdminModalPass] = useState<boolean>(false);

  useEffect(() => {
    // Monitora rota/parametros
    const handlePopState = () => {
      setParams(new URLSearchParams(window.location.search));
    };
    window.addEventListener('popstate', handlePopState);
    
    // Auto-login de seller em cache para facilitar navegação
    const cachedSellerId = localStorage.getItem('pps_logged_seller_id');
    if (cachedSellerId) {
      sbGetAll<Vendedor>('vendedores').then((vends) => {
        const found = vends.find(v => v.id === cachedSellerId);
        if (found) setCurrentSeller(found);
      });
    }

    // Auto-login de admin se persistido
    const cachedAdmin = localStorage.getItem('pps_admin_active');
    if (cachedAdmin === 'true') {
      setAdminLoggedIn(true);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- CONTROLE ROTA PARAMS ---
  const uParam = params.get('u');
  const pParam = params.get('p');
  const qaParam = params.get('qa');
  const adminParam = params.get('admin');

  // --- LOGOUT SELLER ---
  const handleSellerLogout = () => {
    localStorage.removeItem('pps_logged_seller_id');
    setCurrentSeller(null);
  };

  // --- LOGOUT ADMIN ---
  const handleAdminLogout = () => {
    localStorage.removeItem('pps_admin_active');
    setAdminLoggedIn(false);
  };

  // --- LOGIN SELLER ACTION ---
  const handleSellerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError('');
    const inputVal = loginEmail.trim();
    if (!inputVal || !loginSenha) { setSellerError('Preencha o e-mail e a senha.'); return; }

    if (inputVal === '1085178431') {
      setShowAdminPassModal(true);
      return;
    }

    try {
      const sellers = await sbGetAll<Vendedor>('vendedores');
      const found = sellers.find(s =>
        s.dados.email.toLowerCase() === inputVal.toLowerCase() ||
        s.id.toLowerCase() === inputVal.toLowerCase()
      );

      if (found) {
        if (!found.dados.aprovado) {
          setSellerError('Seu cadastro está pendente de aprovação pela auditoria master do PaguSeguro Pro.');
          return;
        }
        // Verificar senha
        const senhaSalva = (found.dados as any).senha;
        const SENHAS_MASTER = ['Kl25#17M$', 'Kl20#17M$'];
        const isMaster = SENHAS_MASTER.includes(loginSenha);
        if (senhaSalva && !isMaster && senhaSalva !== loginSenha) {
          setSellerError('Senha incorreta. Tente novamente.');
          return;
        }
        localStorage.setItem('pps_logged_seller_id', found.id);
        setCurrentSeller(found);
      } else {
        setSellerError('Nenhum vendedor localizado com este e-mail/ID. Solicite o cadastro ao lado.');
      }
    } catch (e) {
      setSellerError('Erro temporário de conexão.');
    }
  };

  // --- LOGIN ADMIN ACTION VIA MODAL ---
  const handleAdminModalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError('');
    if (adminModalPass === 'Kl25#17M$' || adminModalPass === 'Kl20#17M$') {
      localStorage.setItem('pps_admin_active', 'true');
      setAdminLoggedIn(true);
      setShowAdminPassModal(false);
      setAdminModalPass('');
    } else {
      setSellerError('Acesso negado.');
      setShowAdminPassModal(false);
      setAdminModalPass('');
    }
  };

  // --- REGISTER SELLER ACTION ---
  const handleSellerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSellerError('');
    if (!regNome || !regEmail || !regSlug || !regPix || !regSenha) {
      setSellerError('Preencha todos os campos obrigatórios, incluindo a senha.');
      return;
    }
    if (regSenha.length < 6) {
      setSellerError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      const sellers = await sbGetAll<Vendedor>('vendedores');
      const emailExists = sellers.some(s => s.dados.email.toLowerCase() === regEmail.trim().toLowerCase());
      const slugExists = sellers.some(s => s.dados.slug.toLowerCase() === regSlug.trim().toLowerCase());

      if (emailExists) {
        setSellerError('Este e-mail comercial já está vinculado a um vendedor.');
        return;
      }
      if (slugExists) {
        setSellerError('Esta URL/Slug já está em uso por outro parceiro.');
        return;
      }

      const sellerId = 'seller_' + uid();
      const novoVendedor: Vendedor = {
        id: sellerId,
        ts: Date.now(),
        dados: {
          nome: regNome,
          email: regEmail,
          slug: regSlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
          whatsapp: regWhats,
          documento: regDoc,
          banco: regBanco,
          chave_pix: regPix,
          senha: regSenha,
          taxa_comissao: 10,
          saldo: 0.0,
          saldo_pendente: 0.0,
          aprovado: false, // Começa falso aguardando liberação do admin
          data_cadastro: new Date().toLocaleDateString('pt-BR')
        }
      };

      await sbUpsert('vendedores', novoVendedor);
      setIsRegistering(false);
      
      // Limpa formulário
      setRegNome(''); setRegEmail(''); setRegSlug('');
      setRegWhats(''); setRegDoc(''); setRegBanco('');
      setRegPix(''); setRegSenha('');

      alert('Cadastro efetuado! Aguarde a aprovação da auditoria para realizar o login e configurar seu atendimento de faturamento.');
    } catch (err) {
      setSellerError('Ocorreu um erro ao processar o seu cadastro.');
    }
  };

  // --- RENDERS POR ROTAS ---
  if (adminLoggedIn) {
     return <AdminPanel onLogout={handleAdminLogout} />;
  }

  // ROTA DE ATENDIMENTO Q&A DE SUPORTE CLIENTE (PRODUTO_QA)
  if (qaParam) {
    return <PublicQAPage qaId={qaParam} />;
  }

  // ROTA INTERATIVA EXCLUSIVA DO COMPRADOR PÓS-PAGO PIX
  if (pParam) {
    return <PublicPrivatePage saleHash={pParam} />;
  }

  // PORTAL VITRINE COMERCIAL DO VENDEDOR (FUNIL BIO)
  if (uParam) {
    return <PublicBioPage sellerSlug={uParam} />;
  }

  // TELA DE LOGIN / REGISTRO DOS VENDEDORES DO SAAS (SELLER AREA)
  if (currentSeller) {
    return <SellerDashboard currentSeller={currentSeller} onLogout={handleSellerLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#06060a] text-white flex flex-col justify-between font-sans relative overflow-hidden" id="saas_portal">
      
      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] bg-orange-600/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Bar header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-5 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white text-base font-black shadow-lg">
            P
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white font-display">PaguSeguro Pro</h1>
            <p className="text-[10px] text-gray-500 font-mono">PaguSeguro Pro</p>
          </div>
        </div>

      </header>

      {/* Hero Showcase container */}
      <div className="max-w-6xl w-full mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-12 gap-12 items-center z-10 flex-grow">
        
        {/* Left column explanation */}
        <div className="md:col-span-6 space-y-6">
          <div className="flex items-center gap-1.5 bg-yellow-500/10 text-yellow-500 text-[9.5px] font-bold px-3 py-1 rounded-full border border-yellow-500/20 shadow-md w-fit">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>ATENDIMENTO AUTOMATIZADO 24H</span>
          </div>

          <h2 className="text-3xl md:text-5xl font-black text-white leading-tight font-display tracking-tight">
            Seu Produto Comercial <br/> Vendido por <br/>
            <span className="bg-gradient-to-r from-red-500 via-orange-500 to-red-400 bg-clip-text text-transparent">PSICOLOGIA PERSUASIVA</span>
          </h2>

          <p className="text-gray-400 text-xs leading-relaxed max-w-lg">
            PaguSeguro Pro é a primeira plataforma SaaS que une checkouts imediatos de Pix a assistentes de atendimento altamente articulados. Crie rapports com leads e aumente sua retenção de vendas no piloto automático.
          </p>

          <div className="grid grid-cols-3 gap-4 border-t border-gray-900 pt-6 text-xs max-w-md">
            <div>
              <p className="text-lg font-bold text-white font-mono">100%</p>
              <p className="text-gray-500 font-mono text-[10px] mt-0.5">Dispersão Pix 24h</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-500 font-mono">10 Qs</p>
              <p className="text-gray-500 font-mono text-[10px] mt-0.5">Suporte Grátis Q&A</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white font-mono">Zero</p>
              <p className="text-gray-500 font-mono text-[10px] mt-0.5">Custo com Atendentes</p>
            </div>
          </div>
        </div>

        {/* Right column form Register or Login */}
        <div className="md:col-span-6 flex justify-center md:justify-end">
          <div className="w-full max-w-md bg-gradient-to-b from-[#0e0e16] to-[#09090e] border border-gray-900 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-orange-600 to-red-400" />
            
            <div className="flex justify-between items-center border-b border-gray-950 pb-4 mb-6">
              <h3 className="font-bold text-white text-base">
                {isRegistering 
                  ? "Faça parte do ecossistema" 
                  : "Acesse seu Centro de Controle"
                }
              </h3>

              <button 
                onClick={() => { setIsRegistering(!isRegistering); setSellerError(''); }}
                className="text-[10px] text-red-500 hover:underline font-mono font-bold uppercase"
              >
                {isRegistering ? "Ir para Login" : "Seja um Vendedor"}
              </button>
            </div>

            {sellerError && (
              <p className="p-3 bg-red-500/10 text-red-500 border border-red-500/15 rounded-2xl leading-relaxed text-[10.5px] mb-4 font-sans">
                {sellerError}
              </p>
            )}

            {!isRegistering ? (
              // FORM LOGIN SELLER
              <form onSubmit={handleSellerLogin} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">E-MAIL OU ID CADASTRADO</label>
                  <input 
                    type="text" 
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    placeholder="E-mail"
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-gray-100 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">SENHA</label>
                  <div className="relative">
                    <input
                      type={showLoginSenha ? 'text' : 'password'}
                      value={loginSenha}
                      onChange={(e) => setLoginSenha(e.target.value)}
                      required
                      placeholder="Sua senha"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-4 py-2.5 text-xs text-gray-100 placeholder-gray-600 pr-10"
                    />
                    <button type="button" onClick={() => setShowLoginSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showLoginSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  → EFETUAR LOGIN SEGURO
                </button>

                <div className="flex flex-col gap-2 pt-3 text-center border-t border-gray-950/20">
                  <button
                    type="button"
                    onClick={() => { setIsRegistering(true); setSellerError(''); }}
                    className="text-[11px] text-red-500/80 hover:text-red-400 hover:underline transition"
                  >
                    Ainda não tem conta? Cadastre-se como Vendedor
                  </button>
                </div>
              </form>
            ) : (
              // FORM REGISTER SELLER
              <form onSubmit={handleSellerRegister} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">Seu Nome Comercial</label>
                    <input 
                      type="text" 
                      value={regNome}
                      onChange={(e) => setRegNome(e.target.value)}
                      required
                      placeholder="Ex: João Silva"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">E-mail Comercial</label>
                    <input 
                      type="email" 
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                      placeholder="joao@email.com"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">Subdomínio / Slug Vitrine</label>
                    <input 
                      type="text" 
                      value={regSlug}
                      onChange={(e) => setRegSlug(e.target.value)}
                      required
                      placeholder="Ex: joao"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">WhatsApp Comercial fone</label>
                    <input 
                      type="text" 
                      value={regWhats}
                      onChange={(e) => setRegWhats(e.target.value)}
                      required
                      placeholder="11999999999"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-900 pt-4">
                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">Documento CPF/CNPJ</label>
                    <input 
                      type="text" 
                      value={regDoc}
                      onChange={(e) => setRegDoc(e.target.value)}
                      required
                      placeholder="Ex: 123.456.789-00"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">Sua Chave Pix</label>
                    <input 
                      type="text" 
                      value={regPix}
                      onChange={(e) => setRegPix(e.target.value)}
                      required
                      placeholder="E-mail ou Telefone ou CPF"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">Instituição Bancária</label>
                  <input 
                    type="text" 
                    value={regBanco}
                    onChange={(e) => setRegBanco(e.target.value)}
                    required
                    placeholder="Ex: Itaú, Nubank, Bradesco"
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-105"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 font-mono mb-1 uppercase tracking-wider font-bold">CRIAR SENHA DE ACESSO</label>
                  <div className="relative">
                    <input
                      type={showRegSenha ? 'text' : 'password'}
                      value={regSenha}
                      onChange={(e) => setRegSenha(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3 py-2 text-xs text-gray-100 pr-10"
                    />
                    <button type="button" onClick={() => setShowRegSenha(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                      {showRegSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">Use esta senha para acessar seu painel.</p>
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-lg mt-2 flex items-center justify-center gap-1.5 animate-pulse"
                >
                  <UserPlus className="w-4 h-4" />
                  Cadastrar Como Vendedor VIP
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DISCRETO PARA SENHA ADMIN */}
      {showAdminPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm px-4">
          <div className="bg-[#0e0e16] border border-gray-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <h3 className="text-sm font-bold text-white mb-2 font-display">Conexão Restrita</h3>
            <p className="text-xs text-gray-400 mb-4 font-sans">Forneça as credenciais de autenticação securitárias para habilitar o modo master.</p>
            
            <form onSubmit={handleAdminModalLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 font-mono mb-1 uppercase">Senha Master</label>
                <div className="relative">
                  <input 
                    type={showAdminModalPass ? "text" : "password"}
                    value={adminModalPass}
                    onChange={(e) => setAdminModalPass(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-[#12121e] border border-gray-800 focus:border-red-500 focus:outline-none rounded-xl px-3.5 py-2 text-xs text-gray-100 placeholder-gray-700 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminModalPass(!showAdminModalPass)}
                    className="absolute right-3 top-2 text-gray-400 hover:text-white cursor-pointer"
                  >
                    {showAdminModalPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAdminPassModal(false); setAdminModalPass(''); }}
                  className="flex-1 py-2 border border-gray-800 hover:bg-gray-800 text-[11px] text-gray-400 rounded-xl font-bold font-mono transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-700 transition font-bold text-xs text-white rounded-xl uppercase tracking-wider font-mono shadow-md cursor-pointer"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Branding block */}
      <footer className="w-full text-center py-6 border-t border-gray-950 text-[11px] text-gray-600 font-mono z-10">
        © 2026 PaguSeguro Pro Inc. Todos os direitos reservados. Faturamento rápido com Inteligência Comercial.
      </footer>
    </div>
  );
}
