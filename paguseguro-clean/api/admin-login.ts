import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, password } = req.body;
    if (!id || !password) {
      return res.status(400).json({ success: false, error: 'Identificação e senha são obrigatórios.' });
    }

    const expectedId = process.env.ADMIN_ID || '1085178431';
    const expectedPass = process.env.ADMIN_PASS || 'Kl20#17M$';

    if (id.toString().trim() === expectedId.toString().trim() && password === expectedPass) {
      res.json({ success: true, message: 'Autenticação de Auditoria Master concedida!' });
    } else {
      res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Erro no módulo securitário.' });
  }
}
