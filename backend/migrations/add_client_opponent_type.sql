-- Добавление полей для типа клиента и оппонента (юр.лицо/физ.лицо)
ALTER TABLE cases 
ADD COLUMN client_type ENUM('legal', 'individual') DEFAULT 'legal' AFTER client_inn,
ADD COLUMN client_pinfl VARCHAR(20) DEFAULT NULL AFTER client_type,
ADD COLUMN opponent_type ENUM('legal', 'individual') DEFAULT 'legal' AFTER opponent_inn,
ADD COLUMN opponent_pinfl VARCHAR(20) DEFAULT NULL AFTER opponent_type;

-- Добавляем индексы для ПИНФЛ
ALTER TABLE cases 
ADD INDEX idx_client_pinfl (client_pinfl),
ADD INDEX idx_opponent_pinfl (opponent_pinfl);

-- Обновляем существующие записи - устанавливаем тип based on наличии ИНН
UPDATE cases 
SET client_type = CASE 
    WHEN client_inn IS NOT NULL AND client_inn != '' THEN 'legal'
    ELSE 'individual'
END,
opponent_type = CASE
    WHEN opponent_inn IS NOT NULL AND opponent_inn != '' THEN 'legal'
    ELSE 'individual'
END;