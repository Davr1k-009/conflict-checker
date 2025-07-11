// Улучшенная версия transliterate.js с поддержкой узбекского языка

/**
 * Расширенные маппинги для кириллицы в латиницу
 * Включает узбекские специфичные буквы
 */
const cyrillicToLatinMap = {
  'а': 'a', 'А': 'A',
  'б': 'b', 'Б': 'B',
  'в': 'v', 'В': 'V',
  'г': 'g', 'Г': 'G',
  'д': 'd', 'Д': 'D',
  'е': 'e', 'Е': 'E',
  'ё': 'yo', 'Ё': 'Yo',
  'ж': 'j', 'Ж': 'J',     // В узбекском часто 'j' вместо 'zh'
  'з': 'z', 'З': 'Z',
  'и': 'i', 'И': 'I',
  'й': 'y', 'Й': 'Y',
  'к': 'k', 'К': 'K',
  'л': 'l', 'Л': 'L',
  'м': 'm', 'М': 'M',
  'н': 'n', 'Н': 'N',
  'о': 'o', 'О': 'O',
  'п': 'p', 'П': 'P',
  'р': 'r', 'Р': 'R',
  'с': 's', 'С': 'S',
  'т': 't', 'Т': 'T',
  'у': 'u', 'У': 'U',
  'ф': 'f', 'Ф': 'F',
  'х': 'x', 'Х': 'X',     // В узбекском 'x' вместо 'kh'
  'ц': 'ts', 'Ц': 'Ts',
  'ч': 'ch', 'Ч': 'Ch',
  'ш': 'sh', 'Ш': 'Sh',
  'щ': 'shch', 'Щ': 'Shch',
  'ъ': "'", 'Ъ': "'",     // Твердый знак как апостроф
  'ы': 'i', 'Ы': 'I',     // В узбекском нет 'ы', заменяем на 'i'
  'ь': '', 'Ь': '',
  'э': 'e', 'Э': 'E',
  'ю': 'yu', 'Ю': 'Yu',
  'я': 'ya', 'Я': 'Ya',
  // Узбекские специфичные буквы
  'ў': "o'", 'Ў': "O'",   // Узбекская буква ў
  'қ': 'q', 'Қ': 'Q',     // Узбекская буква қ
  'ғ': "g'", 'Ғ': "G'",   // Узбекская буква ғ
  'ҳ': 'h', 'Ҳ': 'H'      // Узбекская буква ҳ
};

/**
 * Альтернативные варианты транслитерации
 * Для генерации дополнительных вариантов поиска
 */
const alternativeTransliterations = {
  'ж': ['j', 'zh'],
  'Ж': ['J', 'Zh'],
  'х': ['x', 'kh', 'h'],
  'Х': ['X', 'Kh', 'H'],
  'ц': ['ts', 's'],
  'Ц': ['Ts', 'S'],
  'ў': ["o'", 'u'],
  'Ў': ["O'", 'U'],
  'ғ': ["g'", 'gh'],
  'Ғ': ["G'", 'Gh']
};

/**
 * Латиница в кириллицу с учетом узбекского языка
 */
const latinToCyrillicMap = {
  'a': 'а', 'A': 'А',
  'b': 'б', 'B': 'Б',
  'v': 'в', 'V': 'В',
  'g': 'г', 'G': 'Г',
  'd': 'д', 'D': 'Д',
  'e': 'е', 'E': 'Е',
  'j': 'ж', 'J': 'Ж',
  'z': 'з', 'Z': 'З',
  'i': 'и', 'I': 'И',
  'k': 'к', 'K': 'К',
  'l': 'л', 'L': 'Л',
  'm': 'м', 'M': 'М',
  'n': 'н', 'N': 'Н',
  'o': 'о', 'O': 'О',
  'p': 'п', 'P': 'П',
  'r': 'р', 'R': 'Р',
  's': 'с', 'S': 'С',
  't': 'т', 'T': 'Т',
  'u': 'у', 'U': 'У',
  'f': 'ф', 'F': 'Ф',
  'x': 'х', 'X': 'Х',
  'y': 'й', 'Y': 'Й',
  'q': 'қ', 'Q': 'Қ',
  'h': 'ҳ', 'H': 'Ҳ'
};

/**
 * Многосимвольные комбинации латиница -> кириллица
 * Порядок важен! Сначала проверяем длинные комбинации
 */
const latinMultiCharMap = {
  // Стандартные комбинации
  'shch': 'щ', 'SHCH': 'Щ', 'Shch': 'Щ',
  'sh': 'ш', 'SH': 'Ш', 'Sh': 'Ш',
  'ch': 'ч', 'CH': 'Ч', 'Ch': 'Ч',
  'zh': 'ж', 'ZH': 'Ж', 'Zh': 'Ж',
  'kh': 'х', 'KH': 'Х', 'Kh': 'Х',
  'ts': 'ц', 'TS': 'Ц', 'Ts': 'Ц',
  'yo': 'ё', 'YO': 'Ё', 'Yo': 'Ё',
  'yu': 'ю', 'YU': 'Ю', 'Yu': 'Ю',
  'ya': 'я', 'YA': 'Я', 'Ya': 'Я',
  // Узбекские комбинации
  "o'": 'ў', "O'": 'Ў',
  "g'": 'ғ', "G'": 'Ғ',
  'gh': 'ғ', 'GH': 'Ғ', 'Gh': 'Ғ'
};

/**
 * Общие сокращения и их варианты
 */
const commonAbbreviations = {
  'ооо': ['ooo', 'ООО', 'OOO'],
  'мчж': ['mchj', 'МЧЖ', 'MCHJ'],
  'ип': ['ip', 'ИП', 'IP'],
  'ао': ['ao', 'АО', 'AO'],
  'зао': ['zao', 'ЗАО', 'ZAO']
};

/**
 * Конвертация кириллицы в латиницу
 */
const cyrillicToLatin = (text) => {
  if (!text) return text;
  
  return text.split('').map(char => {
    return cyrillicToLatinMap[char] || char;
  }).join('');
};

/**
 * Конвертация латиницы в кириллицу
 */
const latinToCyrillic = (text) => {
  if (!text) return text;
  
  let result = text;
  
  // Сначала заменяем многосимвольные комбинации
  for (const [latin, cyrillic] of Object.entries(latinMultiCharMap)) {
    const regex = new RegExp(latin, 'g');
    result = result.replace(regex, cyrillic);
  }
  
  // Затем заменяем одиночные символы
  result = result.split('').map(char => {
    return latinToCyrillicMap[char] || char;
  }).join('');
  
  return result;
};

/**
 * Проверка наличия кириллицы (включая узбекские буквы)
 */
const containsCyrillic = (text) => {
  if (!text) return false;
  return /[а-яА-ЯёЁўЎқҚғҒҳҲ]/.test(text);
};

/**
 * Проверка наличия латиницы
 */
const containsLatin = (text) => {
  if (!text) return false;
  return /[a-zA-Z]/.test(text);
};

/**
 * Генерация всех возможных вариантов для поиска
 * Создает варианты с учетом разных систем транслитерации
 */
const generateSearchVariants = (text) => {
  if (!text) return [];
  
  const variants = new Set([text]); // Используем Set для уникальности
  
  // Если текст содержит кириллицу
  if (containsCyrillic(text)) {
    // Основной вариант транслитерации
    const latinVariant = cyrillicToLatin(text);
    variants.add(latinVariant);
    
    // Генерируем альтернативные варианты
    generateAlternativeVariants(text, variants);
  }
  
  // Если текст содержит латиницу
  if (containsLatin(text) && !containsCyrillic(text)) {
    const cyrillicVariant = latinToCyrillic(text);
    variants.add(cyrillicVariant);
    
    // Дополнительные варианты для латиницы
    generateLatinVariants(text, variants);
  }
  
  // Обработка смешанного текста (кириллица + латиница)
  if (containsCyrillic(text) && containsLatin(text)) {
    // Конвертируем только кириллическую часть
    const partialLatin = convertMixedToLatin(text);
    variants.add(partialLatin);
    
    // Конвертируем только латинскую часть
    const partialCyrillic = convertMixedToCyrillic(text);
    variants.add(partialCyrillic);
  }
  
  // Добавляем варианты с заменой общих сокращений
  addAbbreviationVariants(Array.from(variants), variants);
  
  return Array.from(variants);
};

/**
 * Генерация альтернативных вариантов транслитерации
 */
const generateAlternativeVariants = (text, variants) => {
  let currentVariants = [text];
  
  // Проходим по каждому символу и генерируем варианты
  for (const [cyrillic, alternatives] of Object.entries(alternativeTransliterations)) {
    if (text.includes(cyrillic)) {
      const newVariants = [];
      
      for (const variant of currentVariants) {
        for (const alt of alternatives) {
          newVariants.push(variant.replace(new RegExp(cyrillic, 'g'), alt));
        }
      }
      
      currentVariants = [...currentVariants, ...newVariants];
    }
  }
  
  currentVariants.forEach(v => variants.add(v));
};

/**
 * Генерация вариантов для латинского текста
 */
const generateLatinVariants = (text, variants) => {
  // Варианты с апострофами
  if (text.includes("'")) {
    variants.add(text.replace(/'/g, ''));
    variants.add(text.replace(/'/g, '`'));
  }
  
  // Варианты написания x/kh/h
  if (text.includes('x')) {
    variants.add(text.replace(/x/gi, 'kh'));
    variants.add(text.replace(/x/gi, 'h'));
  }
  if (text.includes('kh')) {
    variants.add(text.replace(/kh/gi, 'x'));
    variants.add(text.replace(/kh/gi, 'h'));
  }
};

/**
 * Конвертация смешанного текста - только кириллица в латиницу
 */
const convertMixedToLatin = (text) => {
  return text.split('').map(char => {
    if (containsCyrillic(char)) {
      return cyrillicToLatinMap[char] || char;
    }
    return char;
  }).join('');
};

/**
 * Конвертация смешанного текста - только латиница в кириллицу
 */
const convertMixedToCyrillic = (text) => {
  let result = text;
  
  // Заменяем многосимвольные комбинации только если они не смешаны с кириллицей
  for (const [latin, cyrillic] of Object.entries(latinMultiCharMap)) {
    const regex = new RegExp(`(?<![а-яА-ЯёЁўЎқҚғҒҳҲ])${latin}(?![а-яА-ЯёЁўЎқҚғҒҳҲ])`, 'g');
    result = result.replace(regex, cyrillic);
  }
  
  return result;
};

/**
 * Добавление вариантов с заменой сокращений
 */
const addAbbreviationVariants = (existingVariants, variants) => {
  for (const variant of existingVariants) {
    const lowerVariant = variant.toLowerCase();
    
    for (const [cyrillic, latinOptions] of Object.entries(commonAbbreviations)) {
      if (lowerVariant.includes(cyrillic)) {
        for (const latin of latinOptions) {
          const newVariant = variant.replace(new RegExp(cyrillic, 'gi'), latin);
          variants.add(newVariant);
        }
      }
      
      // Обратная замена
      for (const latin of latinOptions) {
        if (lowerVariant.includes(latin.toLowerCase())) {
          const newVariant = variant.replace(new RegExp(latin, 'gi'), cyrillic.toUpperCase());
          variants.add(newVariant);
        }
      }
    }
  }
};

/**
 * Нормализация текста для сравнения
 * Удаляет лишние символы и приводит к единому формату
 */
const normalizeForComparison = (text) => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .replace(/['"«»`']/g, '') // Удаляем кавычки
    .replace(/\s+/g, ' ')      // Нормализуем пробелы
    .replace(/[.,;:!?]/g, '')  // Удаляем пунктуацию
    .trim();
};

/**
 * Интеллектуальное сравнение текстов
 * Учитывает все варианты транслитерации
 */
const smartCompare = (text1, text2, threshold = 0.85) => {
  if (!text1 || !text2) return false;
  
  // Прямое сравнение нормализованных версий
  const norm1 = normalizeForComparison(text1);
  const norm2 = normalizeForComparison(text2);
  
  if (norm1 === norm2) return true;
  
  // Генерируем все варианты
  const variants1 = generateSearchVariants(text1).map(normalizeForComparison);
  const variants2 = generateSearchVariants(text2).map(normalizeForComparison);
  
  // Проверяем точное совпадение вариантов
  for (const v1 of variants1) {
    for (const v2 of variants2) {
      if (v1 === v2) return true;
      
      // Для длинных текстов проверяем схожесть
      if (v1.length > 10 && v2.length > 10) {
        const similarity = calculateStringSimilarity(v1, v2);
        if (similarity >= threshold) return true;
      }
    }
  }
  
  return false;
};

/**
 * Расчет схожести строк (коэффициент Жаккара)
 */
const calculateStringSimilarity = (str1, str2) => {
  const tokens1 = new Set(str1.split(' '));
  const tokens2 = new Set(str2.split(' '));
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
};

module.exports = {
  cyrillicToLatin,
  latinToCyrillic,
  containsCyrillic,
  containsLatin,
  generateSearchVariants,
  normalizeForComparison,
  smartCompare
};