const Ably = require('ably');

// Ваш ключ Ably
const ABLY_KEY = '5WEVUw.Hu41oA:LkbFLRC4TTLJSxF1ZL1xsOSGHBeyR8ar-L4Ml7u1rTE';

// Хранилище состояния в памяти (для простоты)
// В реальном проекте лучше использовать базу данных
let cachedState = null;
let ablyClient = null;

// Инициализация Ably клиента
function getAbly() {
    if (!ablyClient) {
        ablyClient = new Ably.Realtime({ key: ABLY_KEY });
    }
    return ablyClient;
}

// Основная функция Netlify
exports.handler = async function(event, context) {
    // CORS заголовки
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    // Предварительный запрос CORS
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // GET запрос — получение состояния
        if (event.httpMethod === 'GET') {
            // Пытаемся получить последнее сообщение из Ably
            const ably = getAbly();
            const channel = ably.channels.get('gorod-teney');

            return new Promise((resolve) => {
                channel.history({ limit: 1, direction: 'backwards' }, function(err, result) {
                    if (err) {
                        console.error('Ошибка получения истории:', err);
                        resolve({
                            statusCode: 200,
                            headers,
                            body: JSON.stringify({ 
                                state: cachedState || null,
                                error: err.message 
                            })
                        });
                        return;
                    }

                    let state = null;
                    if (result && result.items && result.items.length > 0) {
                        state = result.items[0].data;
                        cachedState = state;
                        console.log('📩 Получено состояние из Ably');
                    } else if (cachedState) {
                        state = cachedState;
                        console.log('📩 Использован кэшированный состояние');
                    }

                    resolve({
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ state: state || null })
                    });
                });
            });
        }

        // POST запрос — отправка состояния
        if (event.httpMethod === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const state = body.data;

            if (!state) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No data provided' })
                };
            }

            // Сохраняем в кэш
            cachedState = state;

            // Отправляем в Ably
            const ably = getAbly();
            const channel = ably.channels.get('gorod-teney');

            channel.publish('state-update', state, function(err) {
                if (err) {
                    console.error('Ошибка публикации:', err);
                } else {
                    console.log('📤 Состояние опубликовано в Ably');
                }
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    success: true,
                    message: 'State published'
                })
            };
        }

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };

    } catch (error) {
        console.error('Ошибка:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};