document.addEventListener('DOMContentLoaded', () => {
    // Referências DOM
    const els = {
        openModalBtn: document.getElementById('openModalBtn'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        modalOverlay: document.getElementById('paymentModal'),
        steps: {
            1: document.getElementById('step1'),
            2: document.getElementById('step2'),
            3: document.getElementById('step3')
        },
        inputs: {
            email: document.getElementById('emailInput')
        },
        buttons: {
            createPix: document.getElementById('createPixBtn'),
            copy: document.getElementById('copyBtn'),
            verify: document.getElementById('verifyBtn'),
            finalClose: document.getElementById('finalCloseBtn')
        },
        display: {
            errorMsg: document.getElementById('errorMsg'),
            qrImage: document.getElementById('qrImage'),
            qrPlaceholder: document.getElementById('qrPlaceholder'),
            statusMsg: document.getElementById('statusMsg'),
            btnText1: document.getElementById('btnText1'),
            loader1: document.getElementById('loader1'),
            verifyLoader: document.getElementById('verifyLoader'),
            verifyText: document.getElementById('verifyText')
        }
    };

    // Estado Local
    let state = {
        pixCode: null,
        transactionId: null,
        isPolling: false
    };

    // --- Actions ---

    const toggleModal = (show) => {
        if (show) {
            els.modalOverlay.classList.remove('hidden');
            // Timeout para permitir transição CSS
            setTimeout(() => els.modalOverlay.classList.add('active'), 10);
            resetFlow();
        } else {
            els.modalOverlay.classList.remove('active');
            setTimeout(() => els.modalOverlay.classList.add('hidden'), 300);
        }
    };

    const resetFlow = () => {
        showStep(1);
        els.inputs.email.value = '';
        els.display.errorMsg.classList.add('hidden');
        state = { pixCode: null, transactionId: null, isPolling: false };
    };

    const showStep = (stepNum) => {
        [1, 2, 3].forEach(n => els.steps[n].classList.add('hidden'));
        els.steps[stepNum].classList.remove('hidden');
    };

    const setLoading = (btnId, isLoading) => {
        if (btnId === 1) {
            els.buttons.createPix.disabled = isLoading;
            els.display.loader1.classList.toggle('hidden', !isLoading);
            els.display.btnText1.classList.toggle('hidden', isLoading);
        } else if (btnId === 'verify') {
            els.buttons.verify.disabled = isLoading;
            els.display.verifyLoader.classList.toggle('hidden', !isLoading);
            els.display.verifyText.classList.toggle('hidden', isLoading);
        }
    };

    // --- API Interactions ---

    const createPix = async () => {
        const email = els.inputs.email.value.trim();
        if (!email || !email.includes('@')) {
            showError('Por favor, insira um e-mail válido.');
            return;
        }

        setLoading(1, true);
        showError(''); // Clear error

        try {
            const res = await fetch('/api/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Erro ao criar Pix');

            // Sucesso no Backend
            state.pixCode = data.copyPaste;
            state.transactionId = data.id;

            // Renderiza QR
            if (data.qrCodeBase64) {
                els.display.qrImage.src = data.qrCodeBase64;
                els.display.qrImage.classList.remove('hidden');
                els.display.qrPlaceholder.classList.add('hidden');
            } else {
                els.display.qrImage.classList.add('hidden');
                els.display.qrPlaceholder.classList.remove('hidden');
            }

            showStep(2);

        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(1, false);
        }
    };

    const checkStatus = async () => {
        if (!state.transactionId) return;

        setLoading('verify', true);
        els.display.statusMsg.innerText = '';

        try {
            const res = await fetch(`/api/status?id=${state.transactionId}`);
            const data = await res.json();

            if (data.paid) {
                showStep(3);
                // Trigger confetti or analytics here if needed
            } else {
                els.display.statusMsg.innerText = 'Pagamento ainda não confirmado. Aguarde...';
                setTimeout(() => els.display.statusMsg.innerText = '', 3000);
            }
        } catch (err) {
            els.display.statusMsg.innerText = 'Erro de verificação. Tente novamente.';
        } finally {
            setLoading('verify', false);
        }
    };

    const copyCode = () => {
        if (state.pixCode) {
            navigator.clipboard.writeText(state.pixCode);
            const originalText = els.buttons.copy.innerHTML;
            els.buttons.copy.innerHTML = '<span class="icon">✅</span> Copiado!';
            setTimeout(() => els.buttons.copy.innerHTML = originalText, 2000);
        }
    };

    const showError = (msg) => {
        if (msg) {
            els.display.errorMsg.innerText = msg;
            els.display.errorMsg.classList.remove('hidden');
        } else {
            els.display.errorMsg.classList.add('hidden');
        }
    };

    // --- Event Listeners ---
    els.openModalBtn.addEventListener('click', () => toggleModal(true));
    els.closeModalBtn.addEventListener('click', () => toggleModal(false));
    els.buttons.finalClose.addEventListener('click', () => toggleModal(false));

    // Close on background click
    els.modalOverlay.addEventListener('click', (e) => {
        if (e.target === els.modalOverlay) toggleModal(false);
    });

    els.buttons.createPix.addEventListener('click', createPix);
    els.buttons.copy.addEventListener('click', copyCode);
    els.buttons.verify.addEventListener('click', checkStatus);

    // Enter key support
    els.inputs.email.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createPix();
    });
});
