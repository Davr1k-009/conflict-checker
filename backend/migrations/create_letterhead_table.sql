-- Создание таблицы для хранения фирменного бланка
CREATE TABLE IF NOT EXISTS letterheads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  uploaded_by INT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Индексы
  INDEX idx_active (is_active),
  INDEX idx_uploaded_by (uploaded_by),
  
  -- Внешний ключ
  CONSTRAINT fk_letterhead_user 
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Добавим таблицу для истории проверок конфликтов с деталями для отчета
CREATE TABLE IF NOT EXISTS conflict_check_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT,
  search_params JSON,
  conflict_level VARCHAR(20),
  conflict_reasons JSON,
  conflicting_cases JSON,
  recommendations JSON,
  detailed_cases JSON,
  checked_by INT NOT NULL,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  report_generated BOOLEAN DEFAULT FALSE,
  
  INDEX idx_case_id (case_id),
  INDEX idx_checked_by (checked_by),
  INDEX idx_checked_at (checked_at),
  
  CONSTRAINT fk_report_case 
    FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_user 
    FOREIGN KEY (checked_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;