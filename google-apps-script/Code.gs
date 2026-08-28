const CONFIG = {
  SHEET_NAME: 'RSVP',
  EVENT_TOKEN: 'TA-28082027-RSVP',
  EVENT_NAME: 'Casamento Thaís & André — 28/08/2027',
  NOTIFICATION_EMAILS: [
    'andrecpolicarpo@gmail.com',
    'thaisisaec@gmail.com'
  ]
};

const HEADERS = [
  'ID',
  'Data e hora',
  'Nome completo',
  'Presença',
  'Acompanhantes',
  'Criança',
  'Nome e idade da criança',
  'Telefone ou WhatsApp',
  'Mensagem para os noivos',
  'Página',
  'Status do e-mail'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RSVP do casamento')
    .addItem('Configurar integração', 'setup')
    .addItem('Recriar cabeçalho da aba RSVP', 'ensureRsvpSheet')
    .addToUi();
}

/**
 * Execute UMA VEZ a partir de uma planilha Google à qual este projeto
 * do Apps Script esteja vinculado. Salva o ID da planilha e prepara a aba RSVP.
 */
function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('Abra o Apps Script pela própria planilha: Extensões > Apps Script.');
  }

  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheet.getId());
  ensureRsvpSheet();

  SpreadsheetApp.getUi().alert(
    'Integração configurada',
    'A aba RSVP está pronta. Agora publique este projeto como Aplicativo da Web e copie a URL /exec para o index.html do site.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function ensureRsvpSheet() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(CONFIG.SHEET_NAME);
  }

  const currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersDiffer = HEADERS.some((header, index) => currentHeaders[index] !== header);

  if (headersDiffer) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#6b705c')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, HEADERS.length);
  sheet.setColumnWidth(9, 320);
  sheet.setColumnWidth(5, 260);
  sheet.setColumnWidth(7, 260);

  return sheet;
}

function doGet() {
  return ContentService
    .createTextOutput('RSVP Thaís & André: integração ativa.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};

    // Honeypot: robôs costumam preencher este campo invisível.
    if (normalize_(params.website)) {
      return htmlResponse_('ok', 'HONEYPOT');
    }

    if (normalize_(params.evento_token) !== CONFIG.EVENT_TOKEN) {
      return htmlResponse_('error', 'INVALID_TOKEN');
    }

    const name = normalize_(params['Nome completo']);
    const attendance = normalize_(params['Presença']);
    const phone = normalize_(params['Telefone ou WhatsApp']);

    if (!name || !attendance || !phone) {
      return htmlResponse_('error', 'MISSING_REQUIRED_FIELDS');
    }

    const payload = {
      id: Utilities.getUuid(),
      timestamp: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss'),
      name,
      attendance,
      companions: normalize_(params['Acompanhantes']),
      child: normalize_(params['Criança']),
      childDetails: normalize_(params['Nome e idade da criança']),
      phone,
      message: normalize_(params['Mensagem para os noivos']),
      page: normalize_(params['Página'])
    };

    const cache = CacheService.getScriptCache();
    const duplicateKey = createDuplicateKey_(payload);
    if (cache.get(duplicateKey)) {
      return htmlResponse_('ok', 'DUPLICATE_IGNORED');
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(15000);

    let row;
    try {
      const sheet = ensureRsvpSheet();
      row = sheet.getLastRow() + 1;
      sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
        safeForSheet_(payload.id),
        safeForSheet_(payload.timestamp),
        safeForSheet_(payload.name),
        safeForSheet_(payload.attendance),
        safeForSheet_(payload.companions),
        safeForSheet_(payload.child),
        safeForSheet_(payload.childDetails),
        safeForSheet_(payload.phone),
        safeForSheet_(payload.message),
        safeForSheet_(payload.page),
        'Pendente'
      ]]);

      const emailStatus = sendNotification_(payload);
      sheet.getRange(row, 11).setValue(emailStatus);
      SpreadsheetApp.flush();
      cache.put(duplicateKey, '1', 120);
    } finally {
      lock.releaseLock();
    }

    return htmlResponse_('ok', 'OK');
  } catch (error) {
    console.error(error);
    return htmlResponse_('error', 'ERROR');
  }
}

function sendNotification_(data) {
  const recipients = CONFIG.NOTIFICATION_EMAILS.filter(Boolean);
  const remainingQuota = MailApp.getRemainingDailyQuota();

  if (remainingQuota < recipients.length) {
    return `Não enviado: quota diária insuficiente (${remainingQuota} destinatário(s) restante(s)).`;
  }

  const attending = data.attendance.indexOf('Sim') === 0;
  const subject = attending
    ? `✅ RSVP confirmado — ${data.name}`
    : `❌ Não poderá comparecer — ${data.name}`;

  const rows = [
    ['Nome completo', data.name],
    ['Presença', data.attendance],
    ['Acompanhantes', data.companions || '—'],
    ['Criança', data.child || '—'],
    ['Nome e idade da criança', data.childDetails || '—'],
    ['Telefone / WhatsApp', data.phone],
    ['Mensagem', data.message || '—'],
    ['Data e hora', data.timestamp]
  ];

  const htmlRows = rows.map(([label, value]) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;font-weight:700;color:#4d5142;vertical-align:top;">${escapeHtml_(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#2d3028;white-space:pre-wrap;">${escapeHtml_(value)}</td>
    </tr>`).join('');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#2d3028;">
      <div style="padding:22px 26px;background:#6b705c;color:#fff;border-radius:16px 16px 0 0;">
        <div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;opacity:.88;">Casamento Thaís & André</div>
        <h2 style="margin:8px 0 0;font-size:24px;">Nova confirmação de presença</h2>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-top:0;">${htmlRows}</table>
      <div style="padding:16px 22px;background:#f7f1e8;border-radius:0 0 16px 16px;color:#6b6d65;font-size:13px;">
        Registro salvo automaticamente na aba <strong>RSVP</strong> da planilha.
      </div>
    </div>`;

  const plainBody = rows.map(([label, value]) => `${label}: ${value}`).join('\n');

  try {
    MailApp.sendEmail({
      to: recipients.join(','),
      subject,
      body: plainBody,
      htmlBody,
      name: 'RSVP Thaís & André'
    });
    return `Enviado para ${recipients.join(', ')}`;
  } catch (error) {
    console.error('Falha ao enviar e-mail:', error);
    return `Falha no e-mail: ${error.message || error}`;
  }
}

function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!spreadsheetId) {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('SPREADSHEET_ID não configurado. Execute a função setup() uma vez.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function createDuplicateKey_(data) {
  const raw = `${data.name}|${data.phone}|${data.attendance}`.toLowerCase();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  const digest = bytes.map((byte) => (byte + 256).toString(16).slice(-2)).join('');
  return `rsvp-${digest.slice(0, 40)}`;
}

function safeForSheet_(value) {
  const text = normalize_(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalize_(value) {
  return String(value == null ? '' : value).replace(/\r/g, '').trim().slice(0, 5000);
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlResponse_(status, code) {
  const payload = JSON.stringify({
    type: 'TA_RSVP_RESULT',
    token: CONFIG.EVENT_TOKEN,
    status,
    code
  });

  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body><script>' +
    'window.parent.postMessage(' + payload + ', "*");' +
    '</script></body></html>'
  );
}
