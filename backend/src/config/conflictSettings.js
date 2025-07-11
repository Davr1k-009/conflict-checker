// backend/src/config/conflictSettings.js

// Глобальные настройки для проверки конфликтов
const CONFLICT_SETTINGS = {
  // Включить транслитерацию при сравнении имен
  enableTransliteration: true,
  
  // Пороги схожести для разных уровней проверки
  similarityThreshold: {
    HIGH: 0.95,    // Для критичных совпадений (95%)
    MEDIUM: 0.85,  // Для обычных проверок (85%)
    LOW: 0.75      // Для предупреждений (75%)
  },
  
  // Проверять связанные сущности (учредители, директора и т.д.)
  checkRelatedEntities: true,
  
  // Настройки кеширования
  cache: {
    enabled: true,
    ttl: 300000, // 5 минут в миллисекундах
    maxSize: 1000 // Максимальное количество записей в кеше
  },
  
  // Настройки производительности
  performance: {
    maxCasesToCheck: 10000, // Максимальное количество дел для проверки
    batchSize: 100, // Размер пакета для обработки
    enableParallelProcessing: false // Параллельная обработка (будущая функция)
  },
  
  // Настройки логирования
  logging: {
    enableDetailedLogging: true,
    logMatchDetails: true,
    logPerformanceMetrics: true
  },
  
  // Настройки базы данных
  database: {
    groupConcatMaxLen: 32768, // 32KB для GROUP_CONCAT
    queryTimeout: 30000 // 30 секунд таймаут для запросов
  },
  
  // Правила конфликтов
  conflictRules: {
    // Прямые конфликты всегда высокий уровень
    directConflictLevel: 'high',
    
    // Конфликты юристов
    lawyerConflictLevel: 'medium',
    
    // Конфликты связанных лиц
    relatedEntityConflictLevel: 'low',
    
    // Минимальная длина строки для сравнения схожести
    minStringLengthForSimilarity: 10
  }
};

// Функция для обновления настроек (может использоваться из админ-панели)
const updateSettings = (newSettings) => {
  Object.assign(CONFLICT_SETTINGS, newSettings);
};

// Функция для получения текущих настроек
const getSettings = () => {
  return { ...CONFLICT_SETTINGS };
};

module.exports = {
  CONFLICT_SETTINGS,
  updateSettings,
  getSettings
};