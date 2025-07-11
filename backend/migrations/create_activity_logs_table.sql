-- Создание таблицы для логирования активности пользователей
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    entity_name VARCHAR(255),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Примеры действий:
-- user.login - Вход в систему
-- user.logout - Выход из системы
-- user.create - Создание пользователя
-- user.update - Обновление пользователя
-- user.delete - Удаление пользователя
-- user.password_reset - Сброс пароля
-- case.create - Создание дела
-- case.update - Обновление дела
-- case.delete - Удаление дела
-- case.view - Просмотр дела
-- conflict.check - Проверка конфликтов
-- document.upload - Загрузка документа
-- document.download - Скачивание документа
-- document.delete - Удаление документа