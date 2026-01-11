const https = require('https');

const BASE_URL = 'https://api.syncpayments.com.br';
const CLIENT_ID = 'a921fd87-97d8-47f7-a83b-7602038b1cc9';
const CLIENT_SECRET = '811dbfc7-9ff1-48d0-810e-e13e6ecb587b';

// Helper for requests
function request(method, path, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.syncpayments.com.br',
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

(async () => {
    try {
        console.log('1. Getting Auth Token...');
        const authRes = await request('POST', '/api/partner/v1/auth-token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET
        });

        console.log('Auth Response:', JSON.stringify(authRes, null, 2));
        const token = authRes.access_token || authRes.token;

        if (!token) throw new Error('No token found');

        console.log('\n2. Creating Pix Charge...');
        const pixRes = await request('POST', '/api/partner/v1/cash-in', {
            amount: 10.00,
            description: 'Debug Test',
            // omitting client as per logic
        }, {
            'Authorization': `Bearer ${token}`
        });

        console.log('Pix Response:', JSON.stringify(pixRes, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
})();
