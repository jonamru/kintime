type LogLevel = 'INFO' | 'WARN' | 'ERROR';
type LogCategory = 'AUTH' | 'SECURITY' | 'ACCESS' | 'SYSTEM';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    category: LogCategory;
    message: string;
    metadata?: Record<string, unknown>;
}

export const logger = {
    log: (level: LogLevel, category: LogCategory, message: string, metadata?: Record<string, unknown>) => {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            metadata,
        };

        // 本番環境では構造化ログとして出力（CloudWatch, Datadog等での解析用）
        console.log(JSON.stringify(entry));
    },

    info: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => {
        logger.log('INFO', category, message, metadata);
    },

    warn: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => {
        logger.log('WARN', category, message, metadata);
    },

    error: (category: LogCategory, message: string, metadata?: Record<string, unknown>) => {
        logger.log('ERROR', category, message, metadata);
    },
};
