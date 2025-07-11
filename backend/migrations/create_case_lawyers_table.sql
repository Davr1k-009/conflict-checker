-- Создание таблицы для связи дел и юристов (many-to-many)
CREATE TABLE IF NOT EXISTS case_lawyers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    case_id INT NOT NULL,
    lawyer_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT NOT NULL,
    
    -- Индексы для производительности
    INDEX idx_case_id (case_id),
    INDEX idx_lawyer_id (lawyer_id),
    INDEX idx_assigned_by (assigned_by),
    
    -- Уникальный ключ для предотвращения дублирования
    UNIQUE KEY unique_case_lawyer (case_id, lawyer_id),
    
    -- Внешние ключи
    CONSTRAINT fk_case_lawyers_case 
        FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_case_lawyers_lawyer 
        FOREIGN KEY (lawyer_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_case_lawyers_assigned_by 
        FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Миграция существующих данных из таблицы cases
INSERT INTO case_lawyers (case_id, lawyer_id, assigned_by, assigned_at)
SELECT 
    c.id as case_id,
    c.lawyer_assigned as lawyer_id,
    c.created_by as assigned_by,
    c.created_at as assigned_at
FROM cases c
WHERE c.lawyer_assigned IS NOT NULL;

-- После миграции данных можно будет удалить колонку lawyer_assigned из таблицы cases
-- ALTER TABLE cases DROP FOREIGN KEY cases_ibfk_1;
-- ALTER TABLE cases DROP COLUMN lawyer_assigned;
-- Но сначала нужно обновить весь код