// Улучшенная версия conflictService.js с оптимизациями

const db = require('../config/database');
const { parseCaseJsonFields } = require('../utils/jsonUtils');
const { generateSearchVariants, normalizeForComparison } = require('../utils/transliterate');
const crypto = require('crypto');

// Кеш для результатов конфликтов (TTL 5 минут)
const conflictCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Кеш для данных юристов
const lawyerCache = new Map();
const LAWYER_CACHE_TTL = 10 * 60 * 1000; // 10 минут

// Настройки конфликтов
const CONFLICT_SETTINGS = {
  enableTransliteration: true,
  similarityThreshold: {
    HIGH: 0.95,    // Для критичных совпадений
    MEDIUM: 0.85,  // Для обычных проверок
    LOW: 0.75      // Для предупреждений
  },
  checkRelatedEntities: true,
  cacheEnabled: true,
  cacheTTL: 300000, // 5 минут
  enableDetailedLogging: true
};

const checkConflicts = async (newCase) => {
  const conflicts = [];
  const conflictingCases = [];
  let conflictLevel = 'none';

  try {
    // Нормализация входных данных
    newCase = normalizeInputData(newCase);
    
    // Проверка кеша
    const cacheKey = generateCacheKey(newCase);
    const cached = getFromCache(cacheKey);
    if (cached && CONFLICT_SETTINGS.cacheEnabled) {
      global.logger.info('Returning cached conflict result');
      return cached;
    }

    // Log input data for debugging
    if (CONFLICT_SETTINGS.enableDetailedLogging) {
      global.logger.info('Checking conflicts for case:', {
        client_name: newCase.client_name,
        client_type: newCase.client_type,
        client_inn: newCase.client_inn,
        client_pinfl: newCase.client_pinfl,
        opponent_name: newCase.opponent_name,
        opponent_type: newCase.opponent_type,
        opponent_inn: newCase.opponent_inn,
        opponent_pinfl: newCase.opponent_pinfl
      });
    }

    // Увеличиваем лимит GROUP_CONCAT
    await db.execute('SET SESSION group_concat_max_len = 10000');

    // Оптимизированный запрос с подзапросами
    const [allCasesWithLawyers] = await db.execute(`
      SELECT 
        c.id, c.case_number, c.client_name, c.client_type, c.client_inn, c.client_pinfl,
        c.opponent_name, c.opponent_type, c.opponent_inn, c.opponent_pinfl,
        c.related_companies, c.related_individuals, c.founders, c.directors, c.beneficiaries,
        c.contact_persons,
        (SELECT GROUP_CONCAT(lawyer_id) 
         FROM case_lawyers 
         WHERE case_id = c.id) as lawyer_ids
      FROM cases c
      WHERE c.id != ?
      AND (
        -- Оптимизация: проверяем по индексированным полям
        c.client_inn = ? OR c.client_pinfl = ? OR
        c.opponent_inn = ? OR c.opponent_pinfl = ? OR
        c.client_inn = ? OR c.client_pinfl = ? OR
        c.opponent_inn = ? OR c.opponent_pinfl = ? OR
        -- Проверка по именам (если есть полнотекстовый индекс)
        MATCH(c.client_name, c.opponent_name) AGAINST(? IN BOOLEAN MODE) OR
        MATCH(c.client_name, c.opponent_name) AGAINST(? IN BOOLEAN MODE)
      )
    `, [
      newCase.id || 0,
      // Проверка прямых конфликтов
      newCase.client_inn, newCase.client_pinfl,
      newCase.opponent_inn, newCase.opponent_pinfl,
      // Проверка обратных конфликтов
      newCase.opponent_inn, newCase.opponent_pinfl,
      newCase.client_inn, newCase.client_pinfl,
      // Проверка по именам
      newCase.client_name || '',
      newCase.opponent_name || ''
    ]);

    global.logger.info(`Found ${allCasesWithLawyers.length} potential conflicting cases`);

    // Предзагрузка всех юристов для оптимизации
    const allLawyerIds = new Set();
    
    // Собираем ID юристов нового дела
    let newCaseLawyers = [];
    if (newCase.id) {
      const [lawyers] = await db.execute(
        'SELECT lawyer_id FROM case_lawyers WHERE case_id = ?',
        [newCase.id]
      );
      newCaseLawyers = lawyers.map(l => l.lawyer_id);
    } else if (newCase.lawyersAssigned) {
      newCaseLawyers = newCase.lawyersAssigned;
    }
    
    newCaseLawyers.forEach(id => allLawyerIds.add(id));

    // Собираем ID юристов из существующих дел
    allCasesWithLawyers.forEach(existingCase => {
      if (existingCase.lawyer_ids) {
        existingCase.lawyer_ids.split(',').forEach(id => allLawyerIds.add(parseInt(id)));
      }
    });

    // Загружаем данные всех юристов одним запросом
    const lawyersData = await loadLawyersData(Array.from(allLawyerIds));

    // Process each existing case
    for (const existingCase of allCasesWithLawyers) {
      const existingData = parseCaseJsonFields(existingCase);
      const existingLawyerIds = existingCase.lawyer_ids 
        ? existingCase.lawyer_ids.split(',').map(id => parseInt(id))
        : [];

      // Check 1: Direct conflict - representing both sides
      checkDirectConflicts(newCase, existingData, conflicts, conflictingCases);
      
      // Check 2: Lawyer conflict (с использованием предзагруженных данных)
      checkLawyerConflicts(newCase, existingData, newCaseLawyers, existingLawyerIds, lawyersData, conflicts, conflictingCases);
      
      // Check 3: Related entities conflicts
      if (CONFLICT_SETTINGS.checkRelatedEntities) {
        checkRelatedEntitiesConflicts(newCase, existingData, conflicts, conflictingCases);
      }
      
      // Check 4: Cross-entity conflicts
      checkCrossEntityConflicts(newCase, existingData, conflicts, conflictingCases);
      
      // Check 5: Position switch conflict
      checkPositionSwitchConflicts(newCase, existingData, conflicts, conflictingCases);
    }

    // Determine conflict level based on conflicts found
    conflictLevel = determineConflictLevel(conflicts);

    // Remove duplicates
    const uniqueConflicts = [...new Set(conflicts)];
    const uniqueConflictingCases = [...new Set(conflictingCases)];

    const result = {
      level: conflictLevel,
      reasons: uniqueConflicts,
      conflictingCases: uniqueConflictingCases,
      recommendations: generateRecommendations(conflictLevel, uniqueConflicts),
      checkedAt: new Date().toISOString()
    };

    // Cache the result
    if (CONFLICT_SETTINGS.cacheEnabled) {
      setToCache(cacheKey, result);
    }

    global.logger.info('Conflict check completed:', {
      level: conflictLevel,
      conflictsFound: uniqueConflicts.length,
      conflictingCases: uniqueConflictingCases
    });

    return result;
  } catch (error) {
    global.logger.error('Conflict check error:', error);
    return {
      level: 'error',
      reasons: ['Error checking conflicts: ' + error.message],
      conflictingCases: [],
      recommendations: ['Please contact system administrator']
    };
  }
};

// Загрузка данных юристов с кешированием
const loadLawyersData = async (lawyerIds) => {
  if (!lawyerIds || lawyerIds.length === 0) return new Map();
  
  const result = new Map();
  const idsToLoad = [];
  
  // Проверяем кеш
  for (const id of lawyerIds) {
    const cached = lawyerCache.get(id);
    if (cached && Date.now() - cached.timestamp < LAWYER_CACHE_TTL) {
      result.set(id, cached.data);
    } else {
      idsToLoad.push(id);
    }
  }
  
  // Загружаем отсутствующие данные
  if (idsToLoad.length > 0) {
    const placeholders = idsToLoad.map(() => '?').join(',');
    const [lawyers] = await db.execute(
      `SELECT id, full_name FROM users WHERE id IN (${placeholders})`,
      idsToLoad
    );
    
    for (const lawyer of lawyers) {
      result.set(lawyer.id, lawyer.full_name);
      lawyerCache.set(lawyer.id, {
        data: lawyer.full_name,
        timestamp: Date.now()
      });
    }
  }
  
  return result;
};

// Нормализация входных данных
const normalizeInputData = (caseData) => {
  return {
    ...caseData,
    // Удаляем пробелы и дефисы из ИНН/ПИНФЛ
    client_inn: normalizeINN(caseData.client_inn),
    client_pinfl: normalizePINFL(caseData.client_pinfl),
    opponent_inn: normalizeINN(caseData.opponent_inn),
    opponent_pinfl: normalizePINFL(caseData.opponent_pinfl),
    // Нормализуем имена
    client_name: caseData.client_name?.trim() || '',
    opponent_name: caseData.opponent_name?.trim() || ''
  };
};

// Нормализация ИНН
const normalizeINN = (inn) => {
  if (!inn) return null;
  const normalized = inn.toString().replace(/[\s-]/g, '').trim();
  // Валидация: 9 цифр для ИП, 12 для юр.лиц
  if (!/^(\d{9}|\d{12})$/.test(normalized)) {
    if (normalized.length > 0) {
      global.logger.warn(`Invalid INN format: ${inn}`);
    }
    return null;
  }
  return normalized;
};

// Нормализация ПИНФЛ
const normalizePINFL = (pinfl) => {
  if (!pinfl) return null;
  const normalized = pinfl.toString().replace(/[\s-]/g, '').trim();
  // Валидация: 14 цифр
  if (!/^\d{14}$/.test(normalized)) {
    if (normalized.length > 0) {
      global.logger.warn(`Invalid PINFL format: ${pinfl}`);
    }
    return null;
  }
  return normalized;
};

// Проверка прямых конфликтов (генерирует фразы на английском)
const checkDirectConflicts = (newCase, existingCase, conflicts, conflictingCases) => {
  // Клиент нового дела является оппонентом в существующем
  const clientAsOpponent = isEntityMatch(
    { name: newCase.client_name, inn: newCase.client_inn, pinfl: newCase.client_pinfl },
    { name: existingCase.opponent_name, inn: existingCase.opponent_inn, pinfl: existingCase.opponent_pinfl }
  );
  
  if (clientAsOpponent.matched) {
    const identifier = newCase.client_name || `INN: ${newCase.client_inn}` || `PINFL: ${newCase.client_pinfl}`;
    conflicts.push(`Direct conflict: Your client "${identifier}" is an opponent in case #${existingCase.case_number || existingCase.id}`);
    conflictingCases.push(existingCase.id);
    
    if (CONFLICT_SETTINGS.enableDetailedLogging) {
      global.logger.debug('Direct conflict detected', {
        checkType: 'clientAsOpponent',
        matchedBy: clientAsOpponent.matchedBy,
        caseId: existingCase.id
      });
    }
  }

  // Оппонент нового дела является нашим клиентом в существующем
  const opponentAsClient = isEntityMatch(
    { name: newCase.opponent_name, inn: newCase.opponent_inn, pinfl: newCase.opponent_pinfl },
    { name: existingCase.client_name, inn: existingCase.client_inn, pinfl: existingCase.client_pinfl }
  );
  
  if (opponentAsClient.matched) {
    const identifier = newCase.opponent_name || `INN: ${newCase.opponent_inn}` || `PINFL: ${newCase.opponent_pinfl}`;
    conflicts.push(`Direct conflict: Your opponent "${identifier}" is our client in case #${existingCase.case_number || existingCase.id}`);
    conflictingCases.push(existingCase.id);
    
    if (CONFLICT_SETTINGS.enableDetailedLogging) {
      global.logger.debug('Direct conflict detected', {
        checkType: 'opponentAsClient',
        matchedBy: opponentAsClient.matchedBy,
        caseId: existingCase.id
      });
    }
  }
};

// Универсальная проверка совпадения сущностей с детальной информацией
const isEntityMatch = (entity1, entity2) => {
  if (!entity1 || !entity2) return { matched: false, matchedBy: null };
  
  // Проверка по ИНН (для юр.лиц)
  if (entity1.inn && entity2.inn && entity1.inn === entity2.inn) {
    return { matched: true, matchedBy: 'inn' };
  }
  
  // Проверка по ПИНФЛ (для физ.лиц)
  if (entity1.pinfl && entity2.pinfl && entity1.pinfl === entity2.pinfl) {
    return { matched: true, matchedBy: 'pinfl' };
  }
  
  // Проверка по имени с транслитерацией
  if (entity1.name && entity2.name && CONFLICT_SETTINGS.enableTransliteration) {
    const nameMatch = normalizeStringWithTransliteration(entity1.name, entity2.name);
    if (nameMatch.matched) {
      return { matched: true, matchedBy: `name_${nameMatch.method}` };
    }
  }
  
  return { matched: false, matchedBy: null };
};

// Проверка конфликтов юристов (генерирует фразы на английском)
const checkLawyerConflicts = (newCase, existingCase, newCaseLawyers, existingLawyerIds, lawyersData, conflicts, conflictingCases) => {
  // Найдем общих юристов
  const commonLawyers = newCaseLawyers.filter(id => existingLawyerIds.includes(id));
  
  if (commonLawyers.length === 0) return;
  
  // Проверяем конфликты для каждого общего юриста
  for (const lawyerId of commonLawyers) {
    const lawyerName = lawyersData.get(lawyerId) || `ID: ${lawyerId}`;
    
    // Юрист представляет оппонента в другом деле
    const opponentMatch = isEntityMatch(
      { name: newCase.opponent_name, inn: newCase.opponent_inn, pinfl: newCase.opponent_pinfl },
      { name: existingCase.client_name, inn: existingCase.client_inn, pinfl: existingCase.client_pinfl }
    );
    
    if (opponentMatch.matched) {
      conflicts.push(`Lawyer conflict: ${lawyerName} previously represented opponent "${newCase.opponent_name || 'unnamed'}" in case #${existingCase.case_number || existingCase.id}`);
      conflictingCases.push(existingCase.id);
    }
    
    // Юрист представляет обе стороны
    const bothSidesMatch = isEntityMatch(
      { name: newCase.client_name, inn: newCase.client_inn, pinfl: newCase.client_pinfl },
      { name: existingCase.opponent_name, inn: existingCase.opponent_inn, pinfl: existingCase.opponent_pinfl }
    );
    
    if (bothSidesMatch.matched) {
      conflicts.push(`Lawyer conflict: ${lawyerName} cannot represent both sides - already representing opponent "${newCase.client_name || 'unnamed'}" in case #${existingCase.case_number || existingCase.id}`);
      conflictingCases.push(existingCase.id);
    }
  }
};

// Проверка конфликтов связанных лиц (генерирует фразы на английском)
const checkRelatedEntitiesConflicts = (newCase, existingCase, conflicts, conflictingCases) => {
  const entityTypes = [
    { key: 'related_companies', name: 'company', checkINN: true, checkPINFL: false },
    { key: 'related_individuals', name: 'individual', checkINN: false, checkPINFL: true },
    { key: 'founders', name: 'founder', checkINN: true, checkPINFL: true },
    { key: 'directors', name: 'director', checkINN: false, checkPINFL: true },
    { key: 'beneficiaries', name: 'beneficiary', checkINN: false, checkPINFL: true }
  ];
  
  for (const entityType of entityTypes) {
    const newEntities = newCase[entityType.key] || [];
    const existingEntities = existingCase[entityType.key] || [];
    
    for (const newEntity of newEntities) {
      for (const existingEntity of existingEntities) {
        const matchResult = isRelatedEntityMatch(newEntity, existingEntity, entityType);
        if (matchResult.matched) {
          const entityName = normalizeRelatedEntity(newEntity).name || newEntity;
          conflicts.push(`Related party conflict (${entityType.name}): "${entityName}" is present in case #${existingCase.case_number || existingCase.id}`);
          conflictingCases.push(existingCase.id);
        }
      }
      
      // Проверка, является ли связанное лицо стороной в другом деле
      if (entityType.key === 'related_individuals' || entityType.key === 'founders') {
        const entity = normalizeRelatedEntity(newEntity);
        const clientMatch = isEntityMatch(entity, { 
          name: existingCase.client_name, 
          inn: existingCase.client_inn, 
          pinfl: existingCase.client_pinfl 
        });
        const opponentMatch = isEntityMatch(entity, { 
          name: existingCase.opponent_name, 
          inn: existingCase.opponent_inn, 
          pinfl: existingCase.opponent_pinfl 
        });
        
        if (clientMatch.matched || opponentMatch.matched) {
          conflicts.push(`Conflict: ${entityType.name} "${entity.name}" is a party in case #${existingCase.case_number || existingCase.id}`);
          conflictingCases.push(existingCase.id);
        }
      }
    }
  }
};

// Проверка совпадения связанных лиц
const isRelatedEntityMatch = (entity1, entity2, entityType) => {
  const e1 = normalizeRelatedEntity(entity1);
  const e2 = normalizeRelatedEntity(entity2);
  
  // Проверка по ИНН
  if (entityType.checkINN && e1.inn && e2.inn && e1.inn === e2.inn) {
    return { matched: true, matchedBy: 'inn' };
  }
  
  // Проверка по ПИНФЛ
  if (entityType.checkPINFL && e1.pinfl && e2.pinfl && e1.pinfl === e2.pinfl) {
    return { matched: true, matchedBy: 'pinfl' };
  }
  
  // Проверка по имени
  if (e1.name && e2.name && CONFLICT_SETTINGS.enableTransliteration) {
    const nameMatch = normalizeStringWithTransliteration(e1.name, e2.name);
    if (nameMatch.matched) {
      return { matched: true, matchedBy: `name_${nameMatch.method}` };
    }
  }
  
  return { matched: false, matchedBy: null };
};

// Нормализация связанного лица
const normalizeRelatedEntity = (entity) => {
  if (typeof entity === 'string') {
    return { name: entity, inn: null, pinfl: null };
  }
  return {
    name: entity.name || '',
    inn: normalizeINN(entity.inn),
    pinfl: normalizePINFL(entity.pinfl),
    type: entity.type
  };
};

// Проверка кросс-конфликтов (генерирует фразы на английском)
const checkCrossEntityConflicts = (newCase, existingCase, conflicts, conflictingCases) => {
  const clientEntities = [
    ...(newCase.founders || []),
    ...(newCase.directors || []),
    ...(newCase.beneficiaries || []),
    ...(newCase.related_individuals || [])
  ];
  
  for (const entity of clientEntities) {
    const normalizedEntity = normalizeRelatedEntity(entity);
    const match = isEntityMatch(normalizedEntity, {
      name: existingCase.opponent_name,
      inn: existingCase.opponent_inn,
      pinfl: existingCase.opponent_pinfl
    });
    
    if (match.matched) {
      conflicts.push(`Cross-conflict: Client's affiliated person "${normalizedEntity.name}" is an opponent in case #${existingCase.case_number || existingCase.id}`);
      conflictingCases.push(existingCase.id);
    }
  }
};

// Проверка конфликта при смене позиций (генерирует фразы на английском)
const checkPositionSwitchConflicts = (newCase, existingCase, conflicts, conflictingCases) => {
  const clientMatch = isEntityMatch(
    { name: newCase.client_name, inn: newCase.client_inn, pinfl: newCase.client_pinfl },
    { name: existingCase.opponent_name, inn: existingCase.opponent_inn, pinfl: existingCase.opponent_pinfl }
  );
  
  const opponentMatch = isEntityMatch(
    { name: newCase.opponent_name, inn: newCase.opponent_inn, pinfl: newCase.opponent_pinfl },
    { name: existingCase.client_name, inn: existingCase.client_inn, pinfl: existingCase.client_pinfl }
  );
  
  if (clientMatch.matched && opponentMatch.matched) {
    conflicts.push(`Position switch conflict: Parties have switched positions compared to case #${existingCase.case_number || existingCase.id}`);
    conflictingCases.push(existingCase.id);
  }
};

// Определение уровня конфликта
const determineConflictLevel = (conflicts) => {
  if (conflicts.length === 0) return 'none';
  
  const hasHighConflict = conflicts.some(c => 
    c.includes('Direct conflict') || 
    c.includes('cannot represent both sides')
  );
  
  if (hasHighConflict) return 'high';
  
  const hasMediumConflict = conflicts.some(c =>
    c.includes('Lawyer conflict') ||
    c.includes('Cross-conflict') ||
    c.includes('Position switch')
  );
  
  if (hasMediumConflict) return 'medium';
  
  return 'low';
};

// Улучшенная нормализация названий компаний
const normalizeCompanyName = (str) => {
  if (!str) return '';
  
  // Расширенный список префиксов (включая узбекские)
  const prefixes = [
    'ооо', 'оао', 'зао', 'пао', 'ип', 'ао', 'нао', 'одо', 'тоо',
    'ooo', 'oao', 'zao', 'pao', 'ip', 'ao', 'llc', 'ltd', 'inc',
    'мчж', 'mchj', 'хк', 'xk', 'qmj', 'қмж', 'aj', 'аж'
  ];
  
  let normalized = str.toLowerCase()
    .trim()
    // Удаляем все виды кавычек
    .replace(/['"«»""''„"‚']/g, '')
    // Нормализуем пробелы
    .replace(/\s+/g, ' ');
  
  // Удаляем префиксы более точно
  const prefixRegex = new RegExp(`^(${prefixes.join('|')})\\s+`, 'i');
  normalized = normalized.replace(prefixRegex, '');
  
  return normalized.trim();
};

// Сравнение строк с транслитерацией и определением метода совпадения
const normalizeStringWithTransliteration = (str1, str2) => {
  if (!str1 || !str2) return { matched: false, method: null };
  
  const normalized1 = normalizeCompanyName(str1);
  const normalized2 = normalizeCompanyName(str2);
  
  // Прямое совпадение
  if (normalized1 === normalized2) {
    return { matched: true, method: 'exact' };
  }
  
  // Генерируем варианты для обеих строк
  const variants1 = generateSearchVariants(str1).map(v => normalizeCompanyName(v));
  const variants2 = generateSearchVariants(str2).map(v => normalizeCompanyName(v));
  
  // Проверяем совпадение вариантов
  for (const v1 of variants1) {
    for (const v2 of variants2) {
      if (v1 === v2) {
        return { matched: true, method: 'transliteration' };
      }
      
      // Дополнительная проверка на частичное совпадение (для длинных названий)
      if (v1.length > 10 && v2.length > 10) {
        const similarity = calculateSimilarity(v1, v2);
        if (similarity > CONFLICT_SETTINGS.similarityThreshold.MEDIUM) {
          return { matched: true, method: `similarity_${Math.round(similarity * 100)}` };
        }
      }
    }
  }
  
  return { matched: false, method: null };
};

// Расчет схожести строк (коэффициент Жаккара)
const calculateSimilarity = (str1, str2) => {
  const tokens1 = new Set(str1.split(' '));
  const tokens2 = new Set(str2.split(' '));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
};

// Генерация рекомендаций (на английском языке)
const generateRecommendations = (level, conflicts) => {
  const recommendations = [];

  switch (level) {
    case 'high':
      recommendations.push('IMMEDIATE ACTION REQUIRED: High conflict detected');
      recommendations.push('Do not proceed with this case without senior partner approval');
      recommendations.push('Consider declining representation or obtaining conflict waiver');
      break;
    case 'medium':
      recommendations.push('Review conflict details carefully');
      recommendations.push('Consult with compliance department');
      recommendations.push('Document any mitigation measures taken');
      break;
    case 'low':
      recommendations.push('Minor conflicts detected - review for potential issues');
      recommendations.push('Ensure proper information barriers if proceeding');
      break;
    case 'none':
      recommendations.push('No conflicts detected');
      recommendations.push('Case can proceed normally');
      break;
  }

  return recommendations;
};

// Улучшенная генерация ключа кеша
const generateCacheKey = (caseData) => {
  const parts = [
    caseData.client_inn || '',
    caseData.client_pinfl || '',
    caseData.opponent_inn || '',
    caseData.opponent_pinfl || '',
    normalizeCompanyName(caseData.client_name || ''),
    normalizeCompanyName(caseData.opponent_name || ''),
    (caseData.lawyersAssigned || []).sort().join(',')
  ];
  
  return crypto.createHash('md5').update(parts.join('_')).digest('hex');
};

const getFromCache = (key) => {
  const cached = conflictCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  conflictCache.delete(key);
  return null;
};

const setToCache = (key, data) => {
  conflictCache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Очистка старых записей
  if (conflictCache.size > 1000) {
    const entries = Array.from(conflictCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 100; i++) {
      conflictCache.delete(entries[i][0]);
    }
  }
};

// Очистка кеша юристов периодически
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of lawyerCache.entries()) {
    if (now - value.timestamp > LAWYER_CACHE_TTL) {
      lawyerCache.delete(key);
    }
  }
}, 60000); // Каждую минуту

module.exports = {
  checkConflicts,
  CONFLICT_SETTINGS
};