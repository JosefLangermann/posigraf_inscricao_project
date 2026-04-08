/**
 * ============================================================
 * SISTEMA DE RH - POSIGRAF
 * Módulo: Inscrição Pública de Candidatos (inscricao.js)
 * ============================================================
 *
 * Responsabilidade:
 *   Controla o formulário público de candidatura às vagas
 *   abertas da Posigraf. Sem necessidade de autenticação.
 *
 * Fluxo principal:
 *   1. Carrega vagas abertas ao inicializar
 *   2. Candidato preenche dados e seleciona vaga
 *   3. Sistema valida e-mail, CPF, idade e formação
 *   4. Currículo PDF é enviado ao Supabase Storage
 *   5. Registro é inserido na tabela 'candidatos'
 *   6. Indicação é registrada separadamente (se houver)
 *
 * Acessibilidade:
 *   Formulário acessível via browser padrão, sem frameworks,
 *   compatível com qualquer dispositivo moderno.
 * ============================================================
 */

/**
 * @type {SupabaseClient}
 */
const client = supabase.createClient(
    'https://zbjebceloppkbsstgwgp.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiamViY2Vsb3Bwa2Jzc3Rnd2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NjI1NDIsImV4cCI6MjA5MDEzODU0Mn0.xzLnvBUwQAvVxqZkVrehXh-gYNwB2IVQxWJ8GyplDAo'
);

/* ============================================================
   MÓDULO: CONTROLE DE ORIGEM
   ============================================================ */

/**
 * verificarOrigem()
 * Exibe os campos de indicação quando o candidato informa
 * que foi indicado por um colaborador da empresa.
 * Utiliza classe CSS .visivel para controle de exibição.
 */
function verificarOrigem() {
    const origem = document.getElementById('origem').value;
    const div = document.getElementById('indicacaoFields');
    div.classList.toggle('visivel', origem === "indicacao");
}

/* ============================================================
   MÓDULO: VAGAS
   ============================================================ */

/**
 * carregarVagas()
 * Busca e exibe apenas vagas com status "aberta".
 * Candidatos externos não devem ver vagas encerradas.
 *
 * @async
 * @returns {Promise<void>}
 */
async function carregarVagas() {
    const { data } = await client
        .from('vagas')
        .select('*')
        .eq('status', 'aberta');

    const select = document.getElementById('vaga');
    select.innerHTML = "";

    if (!data || data.length === 0) {
        select.innerHTML = '<option value="">Nenhuma vaga disponível no momento</option>';
        return;
    }

    data.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.id;
        opt.textContent = `${v.titulo} (${v.tipo_contrato || "clt"})`;
        select.appendChild(opt);
    });

    // Exibe detalhes da primeira vaga automaticamente
    mostrarInfoVaga();
}

/**
 * buscarIndicador()
 * Consulta o banco para verificar se o e-mail corporativo
 * informado corresponde a um colaborador ativo.
 * Preenche automaticamente o campo de nome do indicador.
 *
 * @async
 * @returns {Promise<void>}
 */
async function buscarIndicador() {
    const email = document.getElementById('email_indicador').value;

    if (!email) return;

    const { data, error } = await client
        .from('colaboradores')
        .select('nome')
        .eq('email_corporativo', email)
        .single();

    if (error || !data) {
        alert("Colaborador não encontrado com este e-mail corporativo.");
        document.getElementById('quem_indicou').value = "";
        return;
    }

    document.getElementById('quem_indicou').value = data.nome;
}

/* ============================================================
   MÓDULO: INFORMAÇÕES DA VAGA
   ============================================================ */

/**
 * mostrarInfoVaga()
 * Exibe os detalhes completos da vaga selecionada no select,
 * incluindo tipo de contrato, salário, benefícios, turno,
 * setor, duração (se temporária) e instituição (se aprendiz).
 *
 * @async
 * @returns {Promise<void>}
 */
async function mostrarInfoVaga() {
    const vaga_id = document.getElementById('vaga').value;

    if (!vaga_id) return;

    const { data } = await client
        .from('vagas')
        .select('*')
        .eq('id', vaga_id)
        .single();

    if (!data) return;

    document.getElementById('infoVaga').innerHTML = `
        <p><strong>Tipo:</strong> ${data.tipo_contrato}</p>
        <p><strong>Salário:</strong> ${data.salario}</p>
        <p><strong>Benefícios:</strong> ${data.beneficios || "Não informados"}</p>
        <p><strong>Turno:</strong> ${data.turno}</p>
        <p><strong>Setor:</strong> ${data.setor}</p>
        ${data.tipo_contrato !== "clt" ? `<p><strong>Duração:</strong> ${data.duracao_meses || "—"} meses</p>` : ""}
        ${data.tipo_contrato === "aprendiz" ? `<p><strong>Instituição:</strong> ${data.instituicao || "—"}</p>` : ""}
        <hr>
        <p><strong>Descrição:</strong> ${data.descricao || "Não informada"}</p>
        <p><strong>Requisitos:</strong> ${data.requisitos || "Não informados"}</p>
    `;
}

/* ============================================================
   MÓDULO: FORMAÇÃO ACADÊMICA DINÂMICA
   ============================================================ */

/**
 * Referências DOM para elementos de formação.
 */
const tipoFormacaoSelect    = document.getElementById('tipo_formacao');
const tipoInstituicaoSelect = document.getElementById('tipo_instituicao');

/**
 * Mapeamento de nível de formação → tipos de instituição válidos.
 * Define compatibilidades permitidas para validação no envio.
 *
 * @type {Object.<string, string[]>}
 */
const opcoesInstituicao = {
    "ensino_medio":          ["escola_tecnica", "tecnico"],
    "ensino_medio_integrado":["escola_tecnica", "tecnico"],
    "curso_tecnico":         ["escola_tecnica", "tecnico"],
    "graduacao":             ["faculdade"],
    "pos_graduacao":         ["faculdade"]
};

/**
 * Event listener para mudança de formação.
 * Reconstrói o select de tipo de instituição com as opções
 * válidas para o nível selecionado e controla visibilidade
 * dos campos de detalhes.
 */
tipoFormacaoSelect.addEventListener('change', () => {
    const tipo   = tipoFormacaoSelect.value;
    const opcoes = opcoesInstituicao[tipo] || [];

    tipoInstituicaoSelect.innerHTML = '<option value="">Selecione</option>';

    opcoes.forEach(o => {
        const textos = {
            faculdade:     "Faculdade",
            tecnico:       "Curso Técnico",
            escola_tecnica:"Escola Integrada"
        };
        tipoInstituicaoSelect.innerHTML += `<option value="${o}">${textos[o]}</option>`;
    });

    document.getElementById('camposFormacaoDetalhes')
        .classList.toggle('visivel', tipo !== "sem_formacao");
});

/* ============================================================
   MÓDULO: UTILITÁRIOS
   ============================================================ */

/**
 * calcularIdade(data)
 * Retorna a idade em anos completos com base na data de
 * nascimento. Considera se o aniversário já ocorreu no ano.
 *
 * @param {string} data - Data no formato YYYY-MM-DD
 * @returns {number} Idade em anos completos
 */
function calcularIdade(data) {
    const hoje = new Date();
    const nasc = new Date(data);

    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();

    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
    }

    return idade;
}

/* ============================================================
   MÓDULO: ENVIO DA INSCRIÇÃO
   ============================================================ */

/**
 * inscrever()
 * Executa o fluxo completo de inscrição de candidato:
 *
 * Etapa 1 - Coleta: lê todos os campos do formulário
 * Etapa 2 - Validação: verifica obrigatoriedade, idade,
 *           formato do PDF, indicação e compatibilidade
 *           da formação com o tipo de instituição
 * Etapa 3 - CPF: verifica unicidade no banco de dados
 * Etapa 4 - Upload: envia o PDF ao Supabase Storage e
 *           obtém a URL pública do arquivo
 * Etapa 5 - Inserção: cria o registro na tabela candidatos
 * Etapa 6 - Indicação: registra na tabela indicacoes
 *
 * @async
 * @returns {Promise<void>}
 */
async function inscrever() {

    // --- Etapa 1: Coleta de dados ---
    const nome            = document.getElementById('nome').value.trim();
    const cpf             = document.getElementById('cpf').value.trim();
    const email           = document.getElementById('email').value.trim();
    const data_nascimento = document.getElementById('data_nascimento').value;
    const origem          = document.getElementById('origem').value;
    const vaga_id         = document.getElementById('vaga').value;
    const email_indicador = document.getElementById('email_indicador')?.value;
    const quem_indicou    = document.getElementById('quem_indicou').value.trim();
    const instituicao     = document.getElementById('instituicao').value;
    const tipo_instituicao= document.getElementById('tipo_instituicao').value;
    const curso           = document.getElementById('curso').value;
    const tipo_formacao   = document.getElementById('tipo_formacao').value || "sem_formacao";
    const file            = document.getElementById('curriculo').files[0];

    // --- Etapa 2a: Campos obrigatórios ---
    if (!nome || !cpf || !email || !vaga_id || !data_nascimento) {
        alert("Preencha todos os campos obrigatórios!");
        return;
    }

    // --- Etapa 2b: Validação de idade mínima ---
    const idade = calcularIdade(data_nascimento);
    if (idade < 14) {
        alert("A idade mínima para se candidatar é 14 anos!");
        return;
    }

    // --- Etapa 2c: Validação do arquivo de currículo ---
    if (file) {
        const tipo = file.type;
        const nomeArquivo = file.name.toLowerCase();

        if (tipo !== "application/pdf" && !nomeArquivo.endsWith(".pdf")) {
            alert("O currículo deve estar no formato PDF!");
            return;
        }

        const tamanhoMax = 5 * 1024 * 1024; // 5MB
        if (file.size > tamanhoMax) {
            alert("O arquivo de currículo deve ter no máximo 5MB!");
            return;
        }
    }

    // --- Etapa 2d: Validação de indicação ---
    if (origem === "indicacao" && (!email_indicador || !quem_indicou)) {
        alert("Informe um e-mail corporativo válido para registrar a indicação!");
        return;
    }

    // --- Etapa 2e: Busca e validação da vaga ---
    const { data: vaga } = await client
        .from('vagas')
        .select('tipo_contrato, titulo')
        .eq('id', vaga_id)
        .single();

    if (!vaga) {
        alert("Vaga não encontrada. Por favor, recarregue a página.");
        return;
    }

    // --- Etapa 2f: Compatibilidade da formação com instituição ---
    if (tipo_formacao !== "sem_formacao") {
        if (!instituicao || !tipo_instituicao || !curso) {
            alert("Preencha todos os dados de formação ou selecione 'Sem Formação'!");
            return;
        }

        if (!opcoesInstituicao[tipo_formacao].includes(tipo_instituicao)) {
            alert("Tipo de instituição incompatível com o nível de formação selecionado!");
            return;
        }
    }

    // --- Etapa 3: Verificação de CPF duplicado ---
    const { data: existente } = await client
        .from('candidatos')
        .select('id')
        .eq('cpf', cpf)
        .single();

    if (existente) {
        alert("Este CPF já possui uma inscrição no sistema!");
        return;
    }

    // --- Etapa 4: Upload do currículo ---
    let urlCurriculo = null;

    if (file) {
        const fileName = Date.now() + "_" + file.name;

        const { error: uploadError } = await client.storage
            .from('curriculos')
            .upload(fileName, file);

        if (uploadError) {
            alert("Erro ao enviar o currículo. Tente novamente.");
            return;
        }

        const { data: urlData } = client.storage
            .from('curriculos')
            .getPublicUrl(fileName);

        urlCurriculo = urlData.publicUrl;
    }

    // --- Etapa 5: Inserção do candidato ---
    const { data: candidatoCriado, error } = await client
        .from('candidatos')
        .insert([{
            nome, cpf, email, origem, vaga_id,
            vaga_nome:        vaga.titulo,
            status:           'em_processo',
            curriculo_url:    urlCurriculo,
            data_nascimento,
            tipo_formacao,
            instituicao:      tipo_formacao !== "sem_formacao" ? instituicao : null,
            tipo_instituicao: tipo_formacao !== "sem_formacao" ? tipo_instituicao : null,
            curso:            tipo_formacao !== "sem_formacao" ? curso : null
        }])
        .select()
        .single();

    // --- Etapa 6: Registro de indicação ---
    if (origem === "indicacao" && candidatoCriado) {
        const { error: erroIndicacao } = await client
            .from('indicacoes')
            .insert([{
                nome_indicado:   nome,
                quem_indicou:    quem_indicou,
                email_indicador: email_indicador,
                candidato_id:    candidatoCriado.id
            }]);

        if (erroIndicacao) {
            console.warn("Inscrição salva, mas erro ao registrar indicação:", erroIndicacao);
        }
    }

    // --- Resultado final ---
    if (error) {
        console.error("Erro ao cadastrar:", error);
        alert("Erro ao enviar inscrição. Verifique os dados e tente novamente.");
        return;
    }

    alert("Inscrição enviada com sucesso! 🚀 Em breve o RH entrará em contato.");
    location.reload();
}

/* ============================================================
   INICIALIZAÇÃO
   ============================================================ */
carregarVagas();
