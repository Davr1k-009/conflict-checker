-- Создание таблицы для нормализованного хранения связанных сущностей

CREATE TABLE IF NOT EXISTS case_related_entities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  entity_type ENUM('company', 'individual', 'founder', 'director', 'beneficiary', 'contact_person') NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  entity_inn VARCHAR(20) DEFAULT NULL,
  entity_pinfl VARCHAR(20) DEFAULT NULL,
  entity_phone VARCHAR(50) DEFAULT NULL,
  entity_data JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Индексы для оптимизации поиска
  INDEX idx_case_entity (case_id, entity_type),
  INDEX idx_entity_inn (entity_inn),
  INDEX idx_entity_pinfl (entity_pinfl),
  INDEX idx_entity_name (entity_name),
  FULLTEXT idx_fulltext_entity_name (entity_name),
  
  -- Внешний ключ
  CONSTRAINT fk_related_entity_case 
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Миграция существующих данных из JSON полей
-- Эта часть будет выполнена в отдельном скрипте из-за сложности