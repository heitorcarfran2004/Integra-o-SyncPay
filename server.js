const express = require('express');
const axios = require('axios');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = 3001; // Usamos 3001 para evitar conflitos

// Configuração CRÍTICA da API SyncPay
const SYNC_CONFIG = {
    BASE_URL: 'https://api.syncpayments.com.br',
    CLIENT_ID: 'a921fd87-97d8-47f7-a83b-7602038b1cc9',
    CLIENT_SECRET: '811dbfc7-9ff1-48d0-810e-e13e6ecb587b'
};

// Cache de Token (Singleton Pattern simplificado)
let tokenCache = {
    value: null,
    expiresAt: 0
};

// Middleware
app.use(express.json());
app.use(express.static('public')); // Serve o HTML/CSS/JS estático

// --- LÓGICA DE BACKEND (Refatorada do Next.js) ---

async function getAuthToken() {
    // Retorna cache se válido
    if (tokenCache.value && Date.now() < tokenCache.expiresAt) {
        return tokenCache.value;
    }

    try {
        const response = await axios.post(`${SYNC_CONFIG.BASE_URL}/api/partner/v1/auth-token`, {
            client_id: SYNC_CONFIG.CLIENT_ID,
            client_secret: SYNC_CONFIG.CLIENT_SECRET,
        });

        const token = response.data.access_token || response.data.token;
        tokenCache.value = token;
        tokenCache.expiresAt = Date.now() + 3500 * 1000; // ~58 minutos

        return token;
    } catch (error) {
        console.error('Falha na Autenticação:', error.response?.data || error.message);
        throw new Error('Erro de Autenticação na API');
    }
}

// Rota 1: Criar Pix (Preservando lógica de Depósito sem CPF)
app.post('/api/create', async (req, res) => {
    try {
        const { email } = req.body;
        const amount = 10.00; // Valor fixo conforme projeto original

        const token = await getAuthToken();

        // Endpoint Partner API (Cash-in)
        const response = await axios.post(
            `${SYNC_CONFIG.BASE_URL}/api/partner/v1/cash-in`,
            {
                amount: amount,
                description: email ? `Depósito: ${email}` : "Depósito RapidPay"
                // Importante: omitimos objeto 'client' para evitar validação de CPF
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = response.data;
        const pixCode = data.pix_code; // String "Copia e Cola"
        let qrCodeBase64 = '';

        // Geração robusta do QR Code (Já que a API às vezes não manda)
        if (pixCode) {
            try {
                qrCodeBase64 = await QRCode.toDataURL(pixCode);
            } catch (err) {
                console.error('Erro ao gerar QR local:', err);
            }
        }

        res.json({
            copyPaste: pixCode,
            qrCodeBase64: qrCodeBase64,
            id: data.identifier || data.transaction_id
        });

    } catch (error) {
        console.error('Erro Criar Pix:', error.response?.data || error.message);
        res.status(500).json({ error: 'Falha ao processar depósito' });
    }
});

// Rota 2: Verificar Status
app.get('/api/status', async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'ID obrigatório' });

        const token = await getAuthToken();

        const response = await axios.get(
            `${SYNC_CONFIG.BASE_URL}/api/partner/v1/transaction/${id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        // Retorna booleano simples para o frontend
        const isPaid = response.data.status === 'PAID';
        res.json({ paid: isPaid });

    } catch (error) {
        console.error('Erro Status Pix:', error.response?.data || error.message);
        res.status(500).json({ error: 'Erro ao verificar pagamento' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Pix Lite rodando em http://localhost:${PORT}`);
});
