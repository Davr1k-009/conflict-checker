-- Добавление поля для связанных физических лиц
ALTER TABLE cases 
ADD COLUMN related_individuals JSON DEFAULT NULL AFTER beneficiaries;

-- Добавляем комментарий к новому полю
ALTER TABLE cases 
MODIFY COLUMN related_individuals JSON DEFAULT NULL COMMENT 'Связанные физические лица (ФИО и ПИНФЛ)';