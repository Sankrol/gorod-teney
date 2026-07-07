const Ably = require('ably');

const ABLY_KEY = '5WEVUw.Hu41oA:LkbFLRC4TTLJSxF1ZL1xsOSGHBeyR8ar-L4Ml7u1rTE';

let cachedState = null;
let ablyClient = null;

function getAbly() {
    if (!ablyClient) {
        ablyClient = new Ably.Realtime({ key: ABLY_KEY });
    }
    return ablyClient;
}

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // GET запрос — получение состояния (исправлен на async/await)
        if (event.httpMethod === 'GET') {
            const ably = getAbly();
            const channel = ably.channels.get('gorod-teney');

            try {
                // Используем Promise вместо callback
                const result = await channel.history({ limit: 1, direction: 'backwards' });
                let state = null;
                if (result && result.items && result.items.length > 0) {
                    state = result.items[0].data;
                    cachedState = state;
                } else if (cachedState) {
                    state = cachedState;
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ state: state || null })
                };
            } catch (err) {
                console.error('Ошибка получения истории:', err);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ state: cachedState || null })
                };
            }
        }

        // POST запрос — отправка состояния (исправлен на async/await)
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

            cachedState = state;

            const ably = getAbly();
            const channel = ably.channels.get('gorod-teney');

            try {
                // Используем Promise вместо callback
                await channel.publish('state-update', state);
                console.log('📤 Состояние опубликовано');
            } catch (err) {
                console.error('Ошибка публикации:', err);
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true })
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