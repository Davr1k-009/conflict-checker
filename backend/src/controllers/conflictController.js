const db = require('../config/database');
const { checkConflicts } = require('../services/conflictService');
const { parseCaseJsonFields, safeJsonParse } = require('../utils/jsonUtils');
const { logActivity } = require('./activityLogController');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Translations for PDF report
const reportTranslations = {
  en: {
    title: 'Conflict of Interest Check Report',
    checkParameters: 'Check Parameters',
    client: 'Client',
    opponent: 'Opponent',
    notSpecified: 'Not specified',
    inn: 'INN',
    pinfl: 'PINFL',
    conflictsFound: 'Conflicts Found',
    relatedCases: 'Related Cases',
    case: 'Case',
    caseType: 'Case Type',
    createdDate: 'Created Date',
    recommendations: 'Recommendations',
    checkedBy: 'Checked by',
    approvedBy: 'Approved by',
    footer1: 'Generated automatically by Legal Conflict Management System',
    footer2: 'Confidential • For internal use only',
    conflictLevels: {
      high: 'High Risk',
      medium: 'Medium Risk',
      low: 'Low Risk',
      none: 'No Conflicts Found'
    }
  },
  ru: {
    title: 'Отчет о проверке конфликта интересов',
    checkParameters: 'Параметры проверки',
    client: 'Клиент',
    opponent: 'Оппонент',
    notSpecified: 'Не указано',
    inn: 'ИНН',
    pinfl: 'ПИНФЛ',
    conflictsFound: 'Обнаруженные конфликты',
    relatedCases: 'Связанные дела',
    case: 'Дело',
    caseType: 'Тип дела',
    createdDate: 'Дата создания',
    recommendations: 'Рекомендации',
    checkedBy: 'Проверил',
    approvedBy: 'Утвердил',
    footer1: 'Сгенерировано автоматически системой управления юридическими конфликтами',
    footer2: 'Конфиденциально • Только для внутреннего использования',
    conflictLevels: {
      high: 'Высокий риск',
      medium: 'Средний риск',
      low: 'Низкий риск',
      none: 'Конфликтов не обнаружено'
    }
  }
};

// Helper function to check if user can see all cases
const canSeeAllCases = (user) => {
  return user.role === 'admin' || user.permissions?.manageUsers === true;
};

const runConflictCheck = async (req, res) => {
  try {
    const caseId = req.params.caseId;

    // Get case details
    const [cases] = await db.execute(
      'SELECT * FROM cases WHERE id = ?',
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Check if user has access to this case
    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const caseData = parseCaseJsonFields(cases[0]);

    // Get lawyers assigned to the case
    const [lawyers] = await db.execute(
      'SELECT lawyer_id FROM case_lawyers WHERE case_id = ?',
      [caseId]
    );
    const lawyerIds = lawyers.map(l => l.lawyer_id);

    // Add lawyers to case data for conflict checking
    caseData.lawyersAssigned = lawyerIds;
    caseData.id = caseId;

    // Run conflict check (this searches ALL cases, not just visible ones)
    const conflictResult = await checkConflicts(caseData);

    // Save conflict check result
    await db.execute(
      `INSERT INTO conflict_checks (
        case_id, conflict_level, conflict_reason, conflicting_cases, checked_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        caseId,
        conflictResult.level,
        conflictResult.reasons.join('; '),
        JSON.stringify(conflictResult.conflictingCases || []),
        req.user.id
      ]
    );

    global.logger.info('Manual conflict check', { 
      caseId, 
      level: conflictResult.level,
      checkedBy: req.user.id 
    });

    // Log activity
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'conflict.check',
      entityType: 'case',
      entityId: caseId,
      entityName: caseData.client_name,
      details: {
        caseNumber: caseData.case_number,
        clientName: caseData.client_name,
        conflictLevel: conflictResult.level,
        conflictReason: conflictResult.reasons.join('; '),
        conflictingCases: conflictResult.conflictingCases || []
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Send notification if conflict found
    if (conflictResult.level !== 'none') {
      global.io.emit('conflict-detected', {
        caseId,
        level: conflictResult.level,
        message: `Conflict detected in case #${cases[0].case_number || caseId}`
      });
    }

    res.json(conflictResult);
  } catch (error) {
    global.logger.error('Run conflict check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const searchConflicts = async (req, res) => {
  try {
    const { 
      clientType, 
      clientName, 
      clientInn, 
      clientPinfl,
      opponentType,
      opponentName, 
      opponentInn,
      opponentPinfl,
      includeRelated 
    } = req.body;

    // Create a temporary case object for conflict checking
    const searchCase = {
      id: 0, // Temporary ID
      client_type: clientType || 'legal',
      client_name: clientName || '',
      client_inn: clientType === 'legal' ? (clientInn || '') : '',
      client_pinfl: clientType === 'individual' ? (clientPinfl || '') : '',
      opponent_type: opponentType || 'legal',
      opponent_name: opponentName || '',
      opponent_inn: opponentType === 'legal' ? (opponentInn || '') : '',
      opponent_pinfl: opponentType === 'individual' ? (opponentPinfl || '') : '',
      lawyersAssigned: [], // Empty array for search
      related_companies: [],
      related_individuals: [],
      founders: [],
      directors: [],
      beneficiaries: []
    };

    // Note: This searches ALL cases in the database, not just visible ones
    const conflictResult = await checkConflicts(searchCase);

    // If conflicts found, get detailed information about conflicting cases
    if (conflictResult.conflictingCases.length > 0) {
      const [conflictingCases] = await db.execute(
        `SELECT 
          id, case_number, client_name, opponent_name, case_type, created_at
         FROM cases 
         WHERE id IN (${conflictResult.conflictingCases.map(() => '?').join(',')})`,
        conflictResult.conflictingCases
      );

      conflictResult.detailedCases = conflictingCases;
    }

    // Save conflict check report for later PDF generation
    const [reportResult] = await db.execute(
      `INSERT INTO conflict_check_reports (
        case_id, search_params, conflict_level, conflict_reasons, 
        conflicting_cases, recommendations, detailed_cases, checked_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        null, // No case ID for search
        JSON.stringify({
          clientType, clientName, clientInn, clientPinfl,
          opponentType, opponentName, opponentInn, opponentPinfl
        }),
        conflictResult.level,
        JSON.stringify(conflictResult.reasons || []),
        JSON.stringify(conflictResult.conflictingCases || []),
        JSON.stringify(conflictResult.recommendations || []),
        JSON.stringify(conflictResult.detailedCases || []),
        req.user.id
      ]
    );

    // Add report ID to response
    conflictResult.reportId = reportResult.insertId;

    // Log activity for conflict search
    await logActivity({
      userId: req.user.id,
      userName: req.user.full_name || req.user.username,
      action: 'conflict.check',
      entityType: 'conflict_check',
      entityId: null,
      entityName: null,
      details: {
        searchType: 'manual_search',
        clientType: clientType || 'legal',
        clientName: clientName || null,
        clientInn: clientType === 'legal' ? (clientInn || null) : null,
        clientPinfl: clientType === 'individual' ? (clientPinfl || null) : null,
        opponentType: opponentType || 'legal',
        opponentName: opponentName || null,
        opponentInn: opponentType === 'legal' ? (opponentInn || null) : null,
        opponentPinfl: opponentType === 'individual' ? (opponentPinfl || null) : null,
        conflictLevel: conflictResult.level,
        conflictingCaseCount: conflictResult.conflictingCases.length
      },
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    res.json(conflictResult);
  } catch (error) {
    global.logger.error('Search conflicts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const generateConflictReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    // Get language from query params, default to 'en'
    const language = req.query.lang || 'en';

    // Get report data
    const [reports] = await db.execute(
      `SELECT r.*, u.full_name as checked_by_name 
       FROM conflict_check_reports r
       LEFT JOIN users u ON r.checked_by = u.id
       WHERE r.id = ?`,
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reports[0];
    
    // Safely parse JSON fields
    const searchParams = typeof report.search_params === 'string' 
      ? JSON.parse(report.search_params) 
      : report.search_params;
    
    const reasons = typeof report.conflict_reasons === 'string'
      ? JSON.parse(report.conflict_reasons || '[]')
      : (report.conflict_reasons || []);
    
    const recommendations = typeof report.recommendations === 'string'
      ? JSON.parse(report.recommendations || '[]')
      : (report.recommendations || []);
    
    const detailedCases = typeof report.detailed_cases === 'string'
      ? JSON.parse(report.detailed_cases || '[]')
      : (report.detailed_cases || []);

    // Get active letterhead
    const [letterheads] = await db.execute(
      'SELECT * FROM letterheads WHERE is_active = TRUE LIMIT 1'
    );
    const letterhead = letterheads[0];

    // Generate HTML content with language support
    const htmlContent = await generateReportHTML({
      report,
      searchParams,
      reasons,
      recommendations,
      detailedCases,
      letterhead,
      user: req.user,
      language // Pass language to HTML generator
    });

    // Generate PDF using puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // ВАЖНО: Установка размера страницы A4
    await page.setViewport({
      width: 794,  // A4 width at 96 DPI
      height: 1123, // A4 height at 96 DPI
      deviceScaleFactor: 1,
    });

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Ждем загрузки изображений
    await page.evaluateHandle('document.fonts.ready');
    
    // Используем обычный setTimeout вместо waitForTimeout
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true, // Использовать CSS @page размеры
      margin: {
        top: '0',    // Убираем margin чтобы бланк занимал всю страницу
        right: '0',
        bottom: '0',
        left: '0'
      },
      displayHeaderFooter: false // Отключаем стандартные header/footer
    });

    await browser.close();

    // Send PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="conflict-report-${reportId}.pdf"`,
      'Content-Length': pdf.length,
      'Cache-Control': 'no-cache'
    });
    res.end(pdf, 'binary');

    // Update report status
    await db.execute(
      'UPDATE conflict_check_reports SET report_generated = TRUE WHERE id = ?',
      [reportId]
    );

  } catch (error) {
    global.logger.error('Generate report error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const generateReportHTML = async ({ report, searchParams, reasons, recommendations, detailedCases, letterhead, user, language = 'en' }) => {
  // Get translations for the specified language
  const t = reportTranslations[language] || reportTranslations.en;
  
  const formatDate = (date) => {
    const locale = language === 'ru' ? 'ru-RU' : 'en-US';
    return new Date(date).toLocaleString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConflictLevelText = (level) => {
    return t.conflictLevels[level] || level;
  };

  const getConflictLevelColor = (level) => {
    const colors = {
      'high': '#FF3B30',
      'medium': '#FF9500',
      'low': '#007AFF',
      'none': '#34C759'
    };
    return colors[level] || '#8E8E93';
  };

  let letterheadHTML = '';
  if (letterhead) {
    const letterheadPath = path.join(__dirname, '../../', letterhead.file_path);
    try {
      const imageData = await fs.readFile(letterheadPath);
      const base64Image = imageData.toString('base64');
      letterheadHTML = `
        <div class="letterhead-bg">
          <img src="data:${letterhead.mime_type};base64,${base64Image}" alt="Letterhead" />
        </div>
      `;
    } catch (error) {
      global.logger.error('Failed to load letterhead:', error);
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Ultra-compact Apple-inspired design for single page A4 */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        * {
          box-sizing: border-box;
        }
        
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', 'Helvetica Neue', sans-serif;
          font-size: 11px;
          line-height: 1.3;
          color: #1C1C1E;
          font-weight: 400;
          letter-spacing: -0.011em;
          position: relative;
          background-color: #FFFFFF;
        }
        
        /* Letterhead background */
        .letterhead-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          overflow: hidden;
        }
        
        .letterhead-bg img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          opacity: 1;
        }
        
        /* Ultra-compact container with top padding for logo */
        .container {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 0 auto;
          padding: 180px 20px 20px 20px; /* УВЕЛИЧЕН верхний отступ до 180px */
          min-height: 100vh;
        }
        
        /* Ultra-compact header */
        .header {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .title {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1;
          margin-bottom: 3px;
          color: #000000;
        }
        
        .subtitle {
          font-size: 11px;
          font-weight: 400;
          color: #86868B;
          letter-spacing: -0.022em;
        }
        
        /* Compact result badge */
        .result-section {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .conflict-level {
          display: inline-flex;
          align-items: center;
          padding: 6px 16px;
          border-radius: 30px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: -0.022em;
          color: white;
          background-color: ${getConflictLevelColor(report.conflict_level)};
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
        }
        
        /* Ultra-compact sections */
        .section {
          margin-bottom: 12px;
          background-color: rgba(255, 255, 255, 0.98);
          border-radius: 10px;
          padding: 12px 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        
        .section-title {
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.028em;
          margin-bottom: 8px;
          color: #000000;
        }
        
        /* Ultra-compact info grid */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        
        .info-item {
          background-color: #F5F5F7;
          padding: 8px 10px;
          border-radius: 6px;
        }
        
        .info-label {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: -0.008em;
          color: #86868B;
          margin-bottom: 1px;
          text-transform: uppercase;
        }
        
        .info-value {
          font-size: 11px;
          font-weight: 500;
          letter-spacing: -0.022em;
          color: #000000;
          line-height: 1.2;
        }
        
        /* Ultra-compact alerts */
        .alert-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        
        .alert-item {
          padding: 8px 12px;
          margin-bottom: 6px;
          border-radius: 6px;
          font-size: 10px;
          line-height: 1.3;
          letter-spacing: -0.016em;
        }
        
        .alert-warning {
          background-color: #FFF3CD;
          color: #856404;
          border-left: 3px solid #FF9500;
        }
        
        .alert-info {
          background-color: #E3F2FD;
          color: #0C5192;
          border-left: 3px solid #007AFF;
        }
        
        /* Ultra-compact case cards */
        .case-card {
          background-color: #F5F5F7;
          padding: 8px 12px;
          margin-bottom: 6px;
          border-radius: 6px;
          font-size: 10px;
        }
        
        .case-number {
          font-size: 11px;
          font-weight: 600;
          color: #007AFF;
          margin-bottom: 4px;
          letter-spacing: -0.022em;
        }
        
        .case-details {
          font-size: 10px;
          line-height: 1.3;
          color: #3C3C43;
        }
        
        .case-details strong {
          font-weight: 600;
          color: #000000;
        }
        
        /* Ultra-compact signature section */
        .signature-section {
          margin-top: 15px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          background-color: rgba(255, 255, 255, 0.98);
          padding: 12px 16px;
          border-radius: 10px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          font-size: 10px;
        }
        
        .signature-box {
          text-align: center;
        }
        
        .signature-line {
          border-bottom: 1px solid #C6C6C8;
          margin-bottom: 6px;
          width: 100%;
        }
        
        .signature-text {
          font-size: 10px;
          color: #3C3C43;
          line-height: 1.2;
        }
        
        /* Ultra-compact footer */
        .footer {
          margin-top: 12px;
          padding: 8px 10px;
          background-color: rgba(247, 247, 247, 0.95);
          border-radius: 6px;
          text-align: center;
        }
        
        .footer p {
          font-size: 9px;
          color: #86868B;
          margin: 1px 0;
          letter-spacing: -0.008em;
        }
        
        /* Print styles */
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .letterhead-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 210mm;
            height: 297mm;
          }
          
          .container {
            max-width: 100%;
            padding: 180px 15px 15px 15px; /* Сохраняем большой отступ сверху и для печати */
          }
          
          .section {
            box-shadow: none;
            border: 0.5px solid #E5E5E7;
            page-break-inside: avoid;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        }
      </style>
    </head>
    <body>
      ${letterheadHTML}
      <div class="container">
        <div class="header">
          <h1 class="title">${t.title}</h1>
          <p class="subtitle">${formatDate(report.checked_at)}</p>
        </div>

        <div class="result-section">
          <span class="conflict-level">${getConflictLevelText(report.conflict_level)}</span>
        </div>

        <div class="section">
          <h2 class="section-title">${t.checkParameters}</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">${t.client}</div>
              <div class="info-value">
                ${searchParams.clientName || t.notSpecified}
                ${searchParams.clientInn ? `<br><span style="font-size: 9px; color: #86868B;">${t.inn}: ${searchParams.clientInn}</span>` : ''}
                ${searchParams.clientPinfl ? `<br><span style="font-size: 9px; color: #86868B;">${t.pinfl}: ${searchParams.clientPinfl}</span>` : ''}
              </div>
            </div>
            <div class="info-item">
              <div class="info-label">${t.opponent}</div>
              <div class="info-value">
                ${searchParams.opponentName || t.notSpecified}
                ${searchParams.opponentInn ? `<br><span style="font-size: 9px; color: #86868B;">${t.inn}: ${searchParams.opponentInn}</span>` : ''}
                ${searchParams.opponentPinfl ? `<br><span style="font-size: 9px; color: #86868B;">${t.pinfl}: ${searchParams.opponentPinfl}</span>` : ''}
              </div>
            </div>
          </div>
        </div>

        ${reasons.length > 0 ? `
          <div class="section">
            <h2 class="section-title">${t.conflictsFound}</h2>
            <ul class="alert-list">
              ${reasons.map(reason => `<li class="alert-item alert-warning">${reason}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${detailedCases.length > 0 ? `
          <div class="section">
            <h2 class="section-title">${t.relatedCases}</h2>
            ${detailedCases.map(caseItem => `
              <div class="case-card">
                <div class="case-number">${t.case} #${caseItem.case_number || caseItem.id}</div>
                <div class="case-details">
                  <strong>${t.client}:</strong> ${caseItem.client_name}<br>
                  <strong>${t.opponent}:</strong> ${caseItem.opponent_name || t.notSpecified}<br>
                  <strong>${t.caseType}:</strong> ${caseItem.case_type}<br>
                  <strong>${t.createdDate}:</strong> ${formatDate(caseItem.created_at)}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${recommendations.length > 0 ? `
          <div class="section">
            <h2 class="section-title">${t.recommendations}</h2>
            <ul class="alert-list">
              ${recommendations.map(rec => `<li class="alert-item alert-info">${rec}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-text">
              <strong>${report.checked_by_name}</strong><br>
              ${t.checkedBy}<br>
              ${formatDate(report.checked_at)}
            </div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-text">
              <strong>_____________________</strong><br>
              ${t.approvedBy}<br>
              _____________________
            </div>
          </div>
        </div>

        <div class="footer">
          <p>${t.footer1}</p>
          <p>${t.footer2}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getConflictHistory = async (req, res) => {
  try {
    const caseId = req.params.caseId;

    // Check if user has access to this case
    const [cases] = await db.execute(
      'SELECT created_by FROM cases WHERE id = ?',
      [caseId]
    );

    if (cases.length === 0) {
      return res.status(404).json({ error: 'Case not found' });
    }

    if (!canSeeAllCases(req.user) && cases[0].created_by !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [history] = await db.execute(
      `SELECT 
        cc.*,
        u.full_name as checked_by_name
       FROM conflict_checks cc
       LEFT JOIN users u ON cc.checked_by = u.id
       WHERE cc.case_id = ?
       ORDER BY cc.checked_at DESC`,
      [caseId]
    );

    const formattedHistory = history.map(record => ({
      ...record,
      conflicting_cases: safeJsonParse(record.conflicting_cases, [])
    }));

    res.json(formattedHistory);
  } catch (error) {
    global.logger.error('Get conflict history error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getHighRiskConflicts = async (req, res) => {
  try {
    // Build query based on user access
    let query = `
      SELECT 
        cc.*,
        c.case_number,
        c.client_name,
        c.opponent_name,
        u.full_name as checked_by_name
      FROM conflict_checks cc
      JOIN cases c ON cc.case_id = c.id
      LEFT JOIN users u ON cc.checked_by = u.id
      WHERE cc.conflict_level IN ('high', 'medium')
    `;
    
    const params = [];
    
    // Filter by access rights
    if (!canSeeAllCases(req.user)) {
      query += ` AND c.created_by = ?`;
      params.push(req.user.id);
    }
    
    query += `
      ORDER BY 
        CASE cc.conflict_level 
          WHEN 'high' THEN 1 
          WHEN 'medium' THEN 2 
          ELSE 3 
        END,
        cc.checked_at DESC
      LIMIT 50
    `;

    const [conflicts] = await db.execute(query, params);

    const formattedConflicts = conflicts.map(record => ({
      ...record,
      conflicting_cases: safeJsonParse(record.conflicting_cases, [])
    }));

    res.json(formattedConflicts);
  } catch (error) {
    global.logger.error('Get high risk conflicts error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

const getConflictStats = async (req, res) => {
  try {
    // Base query parts that will be modified based on access
    const baseWhereClause = canSeeAllCases(req.user) 
      ? '' 
      : ' AND c.created_by = ?';
    
    const params = canSeeAllCases(req.user) ? [] : [req.user.id];

    // Get conflict counts by level (filtered by access)
    const [levelCounts] = await db.execute(
      `SELECT 
        cc.conflict_level,
        COUNT(*) as count
       FROM conflict_checks cc
       JOIN cases c ON cc.case_id = c.id
       WHERE cc.checked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ${baseWhereClause}
       GROUP BY cc.conflict_level`,
      params
    );

    // Get total conflict checks (filtered by access)
    const [totalChecks] = await db.execute(
      `SELECT COUNT(*) as total 
       FROM conflict_checks cc
       JOIN cases c ON cc.case_id = c.id
       WHERE cc.checked_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ${baseWhereClause}`,
      params
    );

    // Get most conflicted clients (filtered by access)
    const topConflictsQuery = `
      SELECT 
        c.client_name,
        COUNT(DISTINCT cc.id) as conflict_count,
        MAX(cc.conflict_level) as highest_level
      FROM cases c
      JOIN conflict_checks cc ON c.id = cc.case_id
      WHERE cc.conflict_level != 'none'
      ${baseWhereClause}
      GROUP BY c.client_name
      ORDER BY conflict_count DESC
      LIMIT 10
    `;

    const [topConflicts] = await db.execute(topConflictsQuery, params);

    res.json({
      levelDistribution: levelCounts,
      totalChecksLast30Days: totalChecks[0]?.total || 0,
      topConflictedClients: topConflicts
    });
  } catch (error) {
    global.logger.error('Get conflict stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  runConflictCheck,
  searchConflicts,
  generateConflictReport,
  getConflictHistory,
  getHighRiskConflicts,
  getConflictStats
};