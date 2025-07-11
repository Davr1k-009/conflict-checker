-- Оптимизация полнотекстового поиска для конфликтов

-- Изменяем минимальную длину слова для полнотекстового поиска
SET GLOBAL innodb_ft_min_token_size = 3;

-- Пересоздаем полнотекстовые индексы с новыми настройками
ALTER TABLE cases DROP INDEX idx_fulltext_names;
ALTER TABLE cases ADD FULLTEXT idx_fulltext_names (client_name, opponent_name) WITH PARSER ngram;

-- Добавляем полнотекстовый индекс для описания
ALTER TABLE cases ADD FULLTEXT idx_fulltext_description (description);

-- Оптимизация таблицы после добавления индексов
OPTIMIZE TABLE cases;

-- Создание индекса для JSON полей (MySQL 5.7+)
ALTER TABLE cases ADD INDEX idx_client_type (client_type);
ALTER TABLE cases ADD INDEX idx_opponent_type (opponent_type);

-- Составной индекс для типичных запросов
ALTER TABLE cases ADD INDEX idx_type_created (case_type, created_at);