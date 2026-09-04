// app.js (As credenciais vêm automaticamente do config.js)

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let abaAtual = "ativos"; // "ativos" ou "historico"
let etapaAtual = 1;
let fotoFrente = null;
let fotoLote = null;
let todosMedicamentos = [];
let itemSelecionado = null;
let editandoId = null;
let filtroUrgenciaAtual = "todos"; // "todos", "urgente" ou "atencao"
let ordenarPorNome = false;

// ==========================================================================
// INICIALIZAÇÃO E NAVEGAÇÃO DE ABAS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  carregarMedicamentos();
});

function trocarAba(aba) {
  abaAtual = aba;
  const btnEstoque = document.getElementById("abaEstoqueBtn");
  const btnHistorico = document.getElementById("abaHistoricoBtn");
  const btnCamera = document.getElementById("btnCameraContainer");

  if (aba === "ativos") {
    btnEstoque.className = "flex-1 py-2 rounded-lg bg-white text-emerald-700 shadow-sm transition-all";
    btnHistorico.className = "flex-1 py-2 rounded-lg text-slate-600 transition-all";
    btnCamera.classList.remove("hidden");
  } else {
    btnHistorico.className = "flex-1 py-2 rounded-lg bg-white text-emerald-700 shadow-sm transition-all";
    btnEstoque.className = "flex-1 py-2 rounded-lg text-slate-600 transition-all";
    btnCamera.classList.add("hidden");
  }

  carregarMedicamentos();
}

// ==========================================================================
// CÁLCULO DE URGÊNCIA DE VALIDADE
// ==========================================================================
function calcularUrgenciaValidade(dataValidadeStr) {
  const [ano, mes, dia] = dataValidadeStr.split("-").map(Number);
  const dataVal = new Date(ano, mes - 1, dia || 28);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const diffTempo = dataVal.getTime() - hoje.getTime();
  const diffDias = Math.ceil(diffTempo / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return {
      nivel: "vencido",
      cardBorder: "border-rose-300 bg-rose-50/30",
      badgeValidade: "bg-rose-100 text-rose-700 font-bold border border-rose-200",
      textoAlerta: "Vencido!",
      icone: "alert-circle"
    };
  } else if (diffDias <= 60) {
    return {
      nivel: "urgente",
      cardBorder: "border-rose-200 bg-rose-50/20",
      badgeValidade: "bg-rose-100 text-rose-700 font-bold border border-rose-200",
      textoAlerta: diffDias <= 30 ? "Vence em menos de 30 dias" : `Faltam ${diffDias} dias`,
      icone: "alert-triangle"
    };
  } else if (diffDias <= 90) {
    return {
      nivel: "atencao",
      cardBorder: "border-amber-200 bg-amber-50/20",
      badgeValidade: "bg-amber-100 text-amber-800 font-bold border border-amber-200",
      textoAlerta: `Faltam ${diffDias} dias`,
      icone: "clock"
    };
  } else {
    return {
      nivel: "seguro",
      cardBorder: "border-slate-100 bg-white",
      badgeValidade: "bg-slate-100 text-slate-600 font-medium",
      textoAlerta: null,
      icone: null
    };
  }
}

// ==========================================================================
// EXPORTAÇÃO E RELATÓRIOS (PDF / IMPRESSÃO & WHATSAPP)
// ==========================================================================
function abrirModalExportar() {
  document.getElementById("modalExportar").classList.remove("hidden");
  lucide.createIcons();
}

function fecharModalExportar() {
  document.getElementById("modalExportar").classList.add("hidden");
}

function agruparItensPorMes(lista) {
  const grupos = {};
  lista.forEach(item => {
    const partes = item.data_validade.split("-");
    const dataVal = new Date(partes[0], partes[1] - 1, 1);
    const chaveMes = dataVal.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
    if (!grupos[chaveMes]) grupos[chaveMes] = [];
    grupos[chaveMes].push(item);
  });
  return grupos;
}

function imprimirRelatorio() {
  fecharModalExportar();
  const itensAtivos = todosMedicamentos.filter(m => m.status === 'ativo' || !m.status);

  if (itensAtivos.length === 0) {
    alert("Não há itens ativos para gerar relatório.");
    return;
  }

  const grupos = agruparItensPorMes(itensAtivos);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  let tabelaHtml = "";
  for (const [mes, meds] of Object.entries(grupos)) {
    tabelaHtml += `
      <div style="margin-bottom: 20px;">
        <h3 style="background:#f1f5f9; padding: 6px 10px; margin: 15px 0 8px; font-size: 13px; border-left: 4px solid #059669; text-transform: uppercase;">
          ${mes} (${meds.length} ${meds.length === 1 ? 'item' : 'itens'})
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #475569;">
              <th style="padding: 6px; width: 35px;">Conf.</th>
              <th style="padding: 6px;">Medicamento</th>
              <th style="padding: 6px;">Laboratório</th>
              <th style="padding: 6px;">Lote</th>
              <th style="padding: 6px;">Validade</th>
              <th style="padding: 6px; text-align: center;">Qtd</th>
            </tr>
          </thead>
          <tbody>
            ${meds.map(m => {
              const partes = m.data_validade.split("-");
              const mesAno = `${partes[1]}/${partes[0]}`;
              return `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 6px; text-align: center;"><input type="checkbox" style="width: 14px; height: 14px;" /></td>
                  <td style="padding: 6px; font-weight: bold; color: #0f172a;">${m.nome} <span style="font-weight: normal; color: #64748b;">${m.dosagem || ''}</span></td>
                  <td style="padding: 6px; color: #334155;">${m.laboratorio || '-'}</td>
                  <td style="padding: 6px; font-family: monospace;">${m.lote}</td>
                  <td style="padding: 6px; color: #e11d48; font-weight: bold;">${mesAno}</td>
                  <td style="padding: 6px; text-align: center; font-weight: bold;">${m.quantidade_estoque} cx</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  const janelaImpressao = window.open("", "_blank");
  janelaImpressao.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>ChronoMed - Relatório de Validades</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 10px; margin-bottom: 15px;">
        <div>
          <h1 style="margin: 0; font-size: 20px; color: #059669;">ChronoMed - Controle de Validades</h1>
          <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;">Relatório físico para conferência de prateleiras</p>
        </div>
        <div style="text-align: right; font-size: 11px; color: #64748b;">
          Emitido em: <strong>${dataHoje}</strong><br />
          Total de itens: <strong>${itensAtivos.length}</strong>
        </div>
      </div>

      ${tabelaHtml}

      <script>
        window.onload = function() {
          window.print();
        }
      <\/script>
    </body>
    </html>
  `);
  janelaImpressao.document.close();
}

function copiarRelatorioWhatsApp() {
  fecharModalExportar();
  const itensAtivos = todosMedicamentos.filter(m => m.status === 'ativo' || !m.status);

  if (itensAtivos.length === 0) {
    alert("Não há itens ativos para exportar.");
    return;
  }

  const grupos = agruparItensPorMes(itensAtivos);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  let texto = `📋 *CHRONOMED - RELATÓRIO DE VALIDADES*\n`;
  texto += `🗓️ Data: ${dataHoje}\n`;
  texto += `📦 Total de itens: ${itensAtivos.length}\n`;
  texto += `──────────────────────\n\n`;

  for (const [mes, meds] of Object.entries(grupos)) {
    texto += `📅 *${mes}* (${meds.length} ${meds.length === 1 ? 'item' : 'itens'}):\n`;
    meds.forEach(m => {
      const partes = m.data_validade.split("-");
      const mesAno = `${partes[1]}/${partes[0]}`;
      const lab = m.laboratorio ? ` [${m.laboratorio}]` : '';
      texto += `• ${m.nome} ${m.dosagem || ''}${lab}\n`;
      texto += `  Lote: ${m.lote} | Val: *${mesAno}* | Qtd: *${m.quantidade_estoque} cx*\n`;
    });
    texto += `\n`;
  }

  texto += `──────────────────────\n`;
  texto += `_Relatório emitido para conferência de prateleiras_`;

  copiarTextoUniversal(texto);
}

function copiarTextoUniversal(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(texto)
      .then(() => perguntarAbrirWhatsApp(texto))
      .catch(() => fallbackCopiar(texto));
  } else {
    fallbackCopiar(texto);
  }
}

function fallbackCopiar(texto) {
  const textArea = document.createElement("textarea");
  textArea.value = texto;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const copiado = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (copiado) {
      perguntarAbrirWhatsApp(texto);
    } else {
      abrirWhatsAppDireto(texto);
    }
  } catch (err) {
    document.body.removeChild(textArea);
    abrirWhatsAppDireto(texto);
  }
}

function perguntarAbrirWhatsApp(texto) {
  const querAbrir = confirm("✅ Relatório copiado para a área de transferência!\n\nDeseja abrir o WhatsApp agora com o texto pronto?");
  if (querAbrir) {
    abrirWhatsAppDireto(texto);
  }
}

function abrirWhatsAppDireto(texto) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

// ==========================================================================
// CAPTURA DE FOTOS E IA
// ==========================================================================
function iniciarCaptura() {
  etapaAtual = 1;
  fotoFrente = null;
  fotoLote = null;
  atualizarModalPasso();
  document.getElementById("modalPassos").classList.remove("hidden");
}

function fecharModalPassos() {
  document.getElementById("modalPassos").classList.add("hidden");
}

function abrirCamera() {
  document.getElementById("cameraInput").click();
}

function atualizarModalPasso() {
  const titulo = document.getElementById("passoTitulo");
  const desc = document.getElementById("passoDescricao");
  if (etapaAtual === 1) {
    titulo.innerText = "Foto 1 de 2: Frente da Caixa";
    desc.innerText = "Enquadre o nome do remédio, laboratório e dosagem.";
  } else {
    titulo.innerText = "Foto 2 de 2: Lote e Validade";
    desc.innerText = "Enquadre o carimbo do lote e validade (mês/ano).";
  }
}

document.getElementById("cameraInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const base64 = await fileToBase64(file);

  if (etapaAtual === 1) {
    fotoFrente = base64;
    etapaAtual = 2;
    atualizarModalPasso();
  } else {
    fotoLote = base64;
    fecharModalPassos();
    processarImagensCompostas();
  }
  e.target.value = "";
});

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processarImagensCompostas() {
  document.getElementById("modalLoading").classList.remove("hidden");

  try {
    const fotoComposta = await fundirImagens(fotoFrente, fotoLote);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foto_composta: fotoComposta })
    });

    const rawRes = await response.json();
    const res = Array.isArray(rawRes) ? rawRes[0] : rawRes;

    document.getElementById("modalLoading").classList.add("hidden");

    if (res && res.sucesso && res.dados) {
      editandoId = null;
      abrirFormulario(res.dados, false);
    } else {
      alert("Não foi possível identificar todos os campos. Preencha manualmente.");
      abrirFormulario({}, false);
    }
  } catch (err) {
    document.getElementById("modalLoading").classList.add("hidden");
    alert("Erro na esteira de IA: " + err.message);
    abrirFormulario({}, false);
  }
}

function fundirImagens(src1, src2) {
  return new Promise((resolve) => {
    const img1 = new Image();
    const img2 = new Image();

    img1.onload = () => {
      img2.onload = () => {
        const canvas = document.getElementById("fusionCanvas");
        const ctx = canvas.getContext("2d");

        const maxW = 800;
        const ratio1 = maxW / img1.width;
        const h1 = img1.height * ratio1;

        const ratio2 = maxW / img2.width;
        const h2 = img2.height * ratio2;

        canvas.width = maxW;
        canvas.height = h1 + h2;

        ctx.drawImage(img1, 0, 0, maxW, h1);
        ctx.drawImage(img2, 0, h1, maxW, h2);

        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img2.src = src2;
    };
    img1.src = src1;
  });
}

// ==========================================================================
// FORMULÁRIO (CRIAR E EDITAR)
// ==========================================================================
function abrirFormulario(dados, isEdicao = false) {
  document.getElementById("formTituloModal").innerText = isEdicao ? "Editar Medicamento" : "Conferir Dados";
  document.getElementById("formSubtituloModal").innerText = isEdicao ? "Atualize as informações cadastradas" : "Verifique antes de registrar";
  document.getElementById("btnSalvar").innerText = isEdicao ? "Atualizar Dados" : "Confirmar e Salvar no ChronoMed";

  document.getElementById("campoNome").value = dados.nome || "";
  document.getElementById("campoLaboratorio").value = dados.laboratorio || "";
  document.getElementById("campoDosagem").value = dados.dosagem || "";
  document.getElementById("campoQtd").value = dados.quantidade_comprimidos || "";
  document.getElementById("campoLote").value = dados.lote || "";
  document.getElementById("campoEstoque").value = dados.quantidade_estoque || 1;

  if (dados.data_validade) {
    const partes = dados.data_validade.split("-");
    if (partes.length >= 2) {
      document.getElementById("campoValidade").value = `${partes[0]}-${partes[1]}`;
    }
  } else {
    document.getElementById("campoValidade").value = "";
  }

  document.getElementById("modalFormulario").classList.remove("hidden");
}

function fecharFormulario() {
  document.getElementById("modalFormulario").classList.add("hidden");
  editandoId = null;
}

async function salvarMedicamento(e) {
  e.preventDefault();
  const btn = document.getElementById("btnSalvar");
  btn.disabled = true;
  btn.innerText = "Salvando...";

  const valMesAno = document.getElementById("campoValidade").value;
  const [ano, mes] = valMesAno.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFormatadaBanco = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const payload = {
    nome: document.getElementById("campoNome").value,
    laboratorio: document.getElementById("campoLaboratorio").value,
    dosagem: document.getElementById("campoDosagem").value,
    quantidade_comprimidos: document.getElementById("campoQtd").value,
    lote: document.getElementById("campoLote").value,
    data_validade: dataFormatadaBanco,
    quantidade_estoque: parseInt(document.getElementById("campoEstoque").value) || 1
  };

  let error = null;

  if (editandoId) {
    const res = await supabaseClient
      .from("medicamentos_validade")
      .update(payload)
      .eq("id", editandoId);
    error = res.error;
  } else {
    payload.status = 'ativo';
    const res = await supabaseClient
      .from("medicamentos_validade")
      .insert([payload]);
    error = res.error;
  }

  btn.disabled = false;
  btn.innerText = editandoId ? "Atualizar Dados" : "Confirmar e Salvar no ChronoMed";

  if (error) {
    alert("Erro ao salvar: " + error.message);
  } else {
    fecharFormulario();
    carregarMedicamentos();
  }
}

// ==========================================================================
// GERENCIAMENTO: MENU DE AÇÕES, BAIXA FRACIONADA E EXCLUSÃO
// ==========================================================================
function abrirAcoes(id) {
  itemSelecionado = todosMedicamentos.find(m => String(m.id) === String(id));
  if (!itemSelecionado) return;

  document.getElementById("modalAcoesTitulo").innerText = `${itemSelecionado.nome} (Lote: ${itemSelecionado.lote})`;
  const container = document.getElementById("modalAcoesBotoes");

  if (abaAtual === "ativos") {
    container.innerHTML = `
      <button onclick="executarAcao('editar', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-slate-700 hover:bg-slate-50 rounded-xl border border-slate-200">
        <i data-lucide="edit-3" class="w-5 h-5 text-blue-600"></i>
        <div>
          <p class="text-xs font-bold text-slate-800">Editar Cadastro</p>
          <p class="text-[11px] text-slate-400 font-normal">Alterar nome, lote, validade ou estoque total</p>
        </div>
      </button>

      <button onclick="executarAcao('vendido', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-slate-700 hover:bg-emerald-50 rounded-xl border border-emerald-200">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-600"></i>
        <div>
          <p class="text-xs font-bold text-emerald-800">Dar Baixa (Vendido)</p>
          <p class="text-[11px] text-slate-400 font-normal">Vender 1 ou mais caixas e registrar histórico</p>
        </div>
      </button>

      <button onclick="executarAcao('vencido', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-slate-700 hover:bg-amber-50 rounded-xl border border-amber-200">
        <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600"></i>
        <div>
          <p class="text-xs font-bold text-amber-800">Marcar como Vencido / Perda</p>
          <p class="text-[11px] text-slate-400 font-normal">Recolher caixas para descarte/troca</p>
        </div>
      </button>

      <button onclick="executarAcao('excluir', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200">
        <i data-lucide="trash-2" class="w-5 h-5 text-rose-600"></i>
        <div>
          <p class="text-xs font-bold text-rose-800">Excluir Registro</p>
          <p class="text-[11px] text-slate-400 font-normal">Remover definitivamente do sistema</p>
        </div>
      </button>
    `;
  } else {
    container.innerHTML = `
      <button onclick="executarAcao('reativar', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-slate-700 hover:bg-emerald-50 rounded-xl border border-slate-200">
        <i data-lucide="rotate-ccw" class="w-5 h-5 text-emerald-600"></i>
        <div>
          <p class="text-xs font-bold text-slate-800">Reativar para o Estoque</p>
          <p class="text-[11px] text-slate-400 font-normal">Mover de volta para os itens ativos</p>
        </div>
      </button>

      <button onclick="executarAcao('excluir', '${itemSelecionado.id}')" class="w-full flex items-center gap-3 p-3 text-left font-semibold text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200">
        <i data-lucide="trash-2" class="w-5 h-5 text-rose-600"></i>
        <div>
          <p class="text-xs font-bold text-rose-800">Excluir do Histórico</p>
          <p class="text-[11px] text-slate-400 font-normal">Apagar permanentemente</p>
        </div>
      </button>
    `;
  }

  lucide.createIcons();
  document.getElementById("modalAcoes").classList.remove("hidden");
}

function fecharModalAcoes() {
  document.getElementById("modalAcoes").classList.add("hidden");
}

async function executarAcao(tipo, id) {
  const item = todosMedicamentos.find(m => String(m.id) === String(id));
  if (!item) return;

  fecharModalAcoes();

  if (tipo === "editar") {
    editandoId = id;
    abrirFormulario(item, true);
    return;
  }

  if (tipo === "vendido" || tipo === "vencido") {
    const estoqueAtual = parseInt(item.quantidade_estoque) || 1;
    let qtdBaixa = 1;

    if (estoqueAtual > 1) {
      const labelAcao = tipo === "vendido" ? "vendidas" : "descartadas/vencidas";
      const resposta = prompt(
        `Quantas caixas de "${item.nome}" foram ${labelAcao}?\n(Total em estoque: ${estoqueAtual} cx)`,
        "1"
      );

      if (resposta === null) return;

      qtdBaixa = parseInt(resposta);
      if (isNaN(qtdBaixa) || qtdBaixa <= 0 || qtdBaixa > estoqueAtual) {
        alert(`Quantidade inválida. Digite um número entre 1 e ${estoqueAtual}.`);
        return;
      }
    }

    if (qtdBaixa < estoqueAtual) {
      const novoEstoqueAtivo = estoqueAtual - qtdBaixa;

      const { error: errUpdate } = await supabaseClient
        .from("medicamentos_validade")
        .update({ quantidade_estoque: novoEstoqueAtivo })
        .eq("id", id);

      if (errUpdate) {
        alert("Erro ao atualizar estoque restante: " + errUpdate.message);
        return;
      }

      const itemHistorico = {
        nome: item.nome,
        laboratorio: item.laboratorio,
        dosagem: item.dosagem,
        quantidade_comprimidos: item.quantidade_comprimidos,
        lote: item.lote,
        data_validade: item.data_validade,
        quantidade_estoque: qtdBaixa,
        status: tipo,
        data_baixa: new Date().toISOString()
      };

      const { error: errInsert } = await supabaseClient
        .from("medicamentos_validade")
        .insert([itemHistorico]);

      if (errInsert) alert("Erro ao registrar baixa no histórico: " + errInsert.message);
      else carregarMedicamentos();

    } else {
      const { error } = await supabaseClient
        .from("medicamentos_validade")
        .update({
          status: tipo,
          data_baixa: new Date().toISOString()
        })
        .eq("id", id);

      if (error) alert("Erro ao dar baixa total: " + error.message);
      else carregarMedicamentos();
    }
    return;
  }

  if (tipo === "reativar") {
    const { error } = await supabaseClient
      .from("medicamentos_validade")
      .update({
        status: 'ativo',
        data_baixa: null
      })
      .eq("id", id);

    if (error) alert("Erro ao reativar: " + error.message);
    else carregarMedicamentos();
    return;
  }

  if (tipo === "excluir") {
    if (confirm(`Deseja realmente excluir permanentemente "${item.nome}"?`)) {
      const { error } = await supabaseClient
        .from("medicamentos_validade")
        .delete()
        .eq("id", id);

      if (error) alert("Erro ao excluir: " + error.message);
      else carregarMedicamentos();
    }
  }
}

// ==========================================================================
// LISTAGEM E RENDERIZAÇÃO
// ==========================================================================
async function carregarMedicamentos() {
  let query = supabaseClient
    .from("medicamentos_validade")
    .select("*");

  if (abaAtual === "ativos") {
    query = query
      .neq("status", "vendido")
      .neq("status", "vencido")
      .order("data_validade", { ascending: true })
      .order("nome", { ascending: true });
  } else {
    query = query
      .in("status", ["vendido", "vencido"])
      .order("data_baixa", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    document.getElementById("medicamentosContainer").innerHTML = `
      <div class="text-center py-10 text-rose-500 text-xs font-semibold">
        Erro ao carregar dados do Supabase: ${error.message}
      </div>`;
    return;
  }

  todosMedicamentos = data || [];
  aplicarFiltros();
}

function renderizarMedicamentos(lista) {
  const container = document.getElementById("medicamentosContainer");
  document.getElementById("totalBadge").innerText = `${lista.length} itens`;

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="text-center py-16 text-slate-400 text-sm">
        ${abaAtual === "ativos" ? "Nenhum medicamento ativo no momento." : "Nenhum histórico de baixas registrado."}
      </div>`;
    return;
  }

  if (abaAtual === "ativos") {
    const grupos = agruparItensPorMes(lista);

    let html = "";
    for (const [mes, meds] of Object.entries(grupos)) {
      html += `
        <div>
          <div class="flex items-center gap-2 mb-2">
            <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider">${mes}</h2>
            <span class="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">${meds.length}</span>
          </div>
          <div class="space-y-2">
            ${meds.map(m => {
              const partes = m.data_validade.split("-");
              const mesAnoFormatado = `${partes[1]}/${partes[0]}`;
              const urgencia = calcularUrgenciaValidade(m.data_validade);

              return `
                <div class="p-3.5 rounded-2xl border ${urgencia.cardBorder} shadow-sm flex items-center justify-between transition-all">
                  <div class="space-y-1 flex-1 pr-2">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <h4 class="font-bold text-slate-800 text-sm leading-snug">
                        ${m.nome} <span class="text-slate-500 font-normal text-xs">${m.dosagem || ''}</span>
                      </h4>
                      ${m.laboratorio ? `<span class="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">${m.laboratorio}</span>` : ''}
                    </div>

                    <div class="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Lote: <strong class="font-mono text-slate-600 font-semibold">${m.lote}</strong></span>
                      <span>•</span>
                      <span>Val: <strong class="px-1.5 py-0.5 rounded text-[10px] ${urgencia.badgeValidade}">${mesAnoFormatado}</strong></span>
                      <span>•</span>
                      <span class="font-bold text-slate-600">${m.quantidade_estoque} cx</span>
                    </div>

                    ${urgencia.textoAlerta ? `
                      <div class="flex items-center gap-1 text-[10px] font-bold ${urgencia.nivel === 'atencao' ? 'text-amber-600' : 'text-rose-600'} pt-0.5">
                        <i data-lucide="${urgencia.icone}" class="w-3 h-3"></i>
                        <span>${urgencia.textoAlerta}</span>
                      </div>
                    ` : ''}
                  </div>

                  <button onclick="abrirAcoes('${m.id}')" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
                    <i data-lucide="more-vertical" class="w-5 h-5"></i>
                  </button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  } else {
    let html = `<div class="space-y-2">`;
    html += lista.map(m => {
      const partes = m.data_validade.split("-");
      const mesAnoFormatado = `${partes[1]}/${partes[0]}`;
      const isVendido = m.status === "vendido";
      const badgeClass = isVendido ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800";
      const statusLabel = isVendido ? "Vendido" : "Vencido / Perda";

      return `
        <div class="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between opacity-85">
          <div class="space-y-1 flex-1 pr-2">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeClass}">${statusLabel}</span>
              <span class="text-[11px] text-slate-400">Lote: <strong class="font-mono text-slate-600">${m.lote}</strong></span>
            </div>
            <h4 class="font-bold text-slate-800 text-sm leading-snug">
              ${m.nome} <span class="text-slate-500 font-normal text-xs">${m.dosagem || ''}</span>
              ${m.laboratorio ? `<span class="text-[11px] text-slate-500">(${m.laboratorio})</span>` : ''}
            </h4>
            <p class="text-[11px] text-slate-400">Validade original: ${mesAnoFormatado} • <strong>${m.quantidade_estoque} cx baixadas</strong></p>
          </div>
          <button onclick="abrirAcoes('${m.id}')" class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
            <i data-lucide="more-vertical" class="w-5 h-5"></i>
          </button>
        </div>
      `;
    }).join("");
    html += `</div>`;
    container.innerHTML = html;
  }

  lucide.createIcons();
}

// ==========================================================================
// MODAL DE FILTROS E ORDENAÇÃO
// ==========================================================================
function abrirModalFiltros() {
  document.getElementById("modalFiltros").classList.remove("hidden");
  atualizarEstilosModalFiltros();
  lucide.createIcons();
}

function fecharModalFiltros() {
  document.getElementById("modalFiltros").classList.add("hidden");
}

function selecionarFiltroModal(tipo) {
  filtroUrgenciaAtual = tipo;
  atualizarEstilosModalFiltros();
  aplicarFiltros();
}

function selecionarOrdemModal(porNome) {
  ordenarPorNome = porNome;
  atualizarEstilosModalFiltros();
  aplicarFiltros();
}

function limparFiltrosModal() {
  filtroUrgenciaAtual = "todos";
  ordenarPorNome = false;
  document.getElementById("searchInput").value = "";
  atualizarEstilosModalFiltros();
  aplicarFiltros();
  fecharModalFiltros();
}

function atualizarEstilosModalFiltros() {
  const opcoes = ["todos", "urgente", "atencao"];
  opcoes.forEach(opt => {
    const btn = document.getElementById(`opt-${opt}`);
    const check = btn.querySelector(".icone-check");
    if (filtroUrgenciaAtual === opt) {
      btn.className = "w-full flex items-center justify-between p-2.5 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold text-xs transition-all";
      check.classList.remove("hidden");
    } else {
      btn.className = "w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs transition-all";
      check.classList.add("hidden");
    }
  });

  const btnVal = document.getElementById("ordem-validade");
  const btnAlfa = document.getElementById("ordem-alfa");
  if (ordenarPorNome) {
    btnAlfa.className = "p-2.5 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all";
    btnVal.className = "p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs flex items-center justify-center gap-1.5 transition-all";
  } else {
    btnVal.className = "p-2.5 rounded-xl border border-emerald-500 bg-emerald-50 text-emerald-800 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all";
    btnAlfa.className = "p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs flex items-center justify-center gap-1.5 transition-all";
  }

  const indicador = document.getElementById("indicadorFiltroAtivo");
  const btnAbrir = document.getElementById("btnAbrirFiltro");
  const temFiltroAtivo = filtroUrgenciaAtual !== "todos" || ordenarPorNome;

  if (temFiltroAtivo) {
    indicador.classList.remove("hidden");
    btnAbrir.classList.add("border-emerald-300", "bg-emerald-50/50", "text-emerald-700");
  } else {
    indicador.classList.add("hidden");
    btnAbrir.classList.remove("border-emerald-300", "bg-emerald-50/50", "text-emerald-700");
  }

  lucide.createIcons();
}

function aplicarFiltros() {
  const termo = (document.getElementById("searchInput")?.value || "").toLowerCase();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let filtrados = todosMedicamentos.filter(m => {
    const matchTexto = 
      m.nome.toLowerCase().includes(termo) || 
      (m.laboratorio && m.laboratorio.toLowerCase().includes(termo)) ||
      (m.lote && m.lote.toLowerCase().includes(termo));

    if (!matchTexto) return false;

    if (abaAtual === "ativos" && filtroUrgenciaAtual !== "todos") {
      const [ano, mes, dia] = m.data_validade.split("-").map(Number);
      const dataVal = new Date(ano, mes - 1, dia || 28);
      const diffDias = Math.ceil((dataVal.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      if (filtroUrgenciaAtual === "urgente") return diffDias <= 60;
      if (filtroUrgenciaAtual === "atencao") return diffDias <= 90;
    }

    return true;
  });

  if (ordenarPorNome) {
    filtrados.sort((a, b) => a.nome.localeCompare(b.nome));
  }

  renderizarMedicamentos(filtrados);
}