-- Добавление поля для контактных лиц
ALTER TABLE cases 
ADD COLUMN contact_persons JSON DEFAULT NULL AFTER related_individuals;

-- Добавляем комментарий к новому полю
ALTER TABLE cases 
MODIFY COLUMN contact_persons JSON DEFAULT NULL COMMENT 'Контактные лица (ФИО и номер телефона)';