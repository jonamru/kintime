-- MySQL初期化スクリプト
-- データベース設定の最適化

-- 文字セットの設定
ALTER DATABASE kintime CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- タイムゾーンの設定（JST）
SET GLOBAL time_zone = '+09:00';
SET time_zone = '+09:00';

-- パフォーマンス設定
SET GLOBAL innodb_buffer_pool_size = 128M;
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 32M;
SET GLOBAL query_cache_type = 1;

-- ログ設定
SET GLOBAL slow_query_log = 1;
SET GLOBAL long_query_time = 2;