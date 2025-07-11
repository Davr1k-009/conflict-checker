-- Миграция для оптимизации поиска конфликтов

-- Составной индекс для быстрого поиска по ИНН и ПИНФЛ
ALTER TABLE cases 
ADD INDEX idx_conflict_check (client_inn, opponent_inn, client_pinfl, opponent_pinfl);

-- Полнотекстовый индекс для поиска по именам
ALTER TABLE cases 
ADD FULLTEXT idx_fulltext_names (client_name, opponent_name);

-- Индекс для сортировки по дате создания
ALTER TABLE cases 
ADD INDEX idx_created_at (created_at);

-- Индексы для таблицы conflict_checks
ALTER TABLE conflict_checks 
ADD INDEX idx_case_level (case_id, conflict_level),
ADD INDEX idx_checked_at (checked_at);

-- Индекс для поиска по контактным лицам (JSON поиск)
ALTER TABLE cases
ADD INDEX idx_contact_persons ((CAST(contact_persons AS CHAR(255))));

-- Оптимизация таблицы case_lawyers
ALTER TABLE case_lawyers
ADD INDEX idx_lawyer_case (lawyer_id, case_id);