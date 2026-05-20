import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// 1. Загружаем переменные окружения из файла .env (не публикуется на GitHub)
dotenv.config();

// 2. Инициализируем приложение
const app = express();
const PORT = process.env.PORT || 3000;

// 3. Настраиваем middleware
app.use(cors());
app.use(express.json());

// 4. Указываем папку, откуда будут отдаваться статические файлы (наш index.html, стили, скрипты)
//    Render будет искать ее в корне репозитория.
app.use(express.static('.'));

// 5. Получаем API-ключ из окружения. Очень важно не хранить его прямо в коде!
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 6. Глобальная проверка: если ключа нет, сервер все равно запустится, но AI-функция не будет работать.
if (!OPENROUTER_API_KEY) {
  console.error('❌ ОШИБКА: OPENROUTER_API_KEY не найден в переменных окружения!');
} else {
  console.log('✅ API-ключ OpenRouter загружен');
}

// 7. Создаем эндпоинт /api/price, который будет слушать POST-запросы
app.post('/api/price', async (req, res) => {
  // Если ключ отсутствует, сразу возвращаем ошибку
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'API-ключ не настроен на сервере' });
  }

  // Получаем от фронтенда название муки и имя продавца
  const { flourName, vendorName } = req.body;
  console.log(`📥 Запрос цен: ${flourName}, ${vendorName}`);

  // Формируем промпт для AI
  const prompt = `Ты — помощник, который предоставляет актуальные розничные цены на муку в России.
Сейчас ${new Date().toLocaleDateString('ru-RU')}.
Название муки: ${flourName}.
Продавец: ${vendorName}.
Укажи только текущую цену в рублях за килограмм (целое число). Не добавляй никаких пояснений, только число.`;

  try {
    // Отправляем запрос к OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini', // Используем модель gpt-4o-mini
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Ставим низкую температуру, чтобы ответ был более детерминированным
        max_tokens: 20
      })
    });

    const data = await response.json();

    // Проверяем, есть ли ошибки в ответе OpenRouter
    if (data.error) {
      console.error('Ошибка OpenRouter:', data.error);
      return res.status(500).json({ error: 'Ошибка от OpenRouter API' });
    }

    // Извлекаем цену из ответа AI
    const aiReply = data.choices[0].message.content.trim();
    const price = parseInt(aiReply, 10);

    // Проверяем, что AI вернул корректное число
    if (isNaN(price) || price <= 0) {
      console.warn(`⚠️ AI вернул неверный формат: ${aiReply}`);
      return res.status(500).json({ error: 'Неверный формат цены от AI' });
    }

    console.log(`✅ Получена цена: ${price} ₽/кг`);
    res.json({ price: price });

  } catch (error) {
    console.error('Ошибка при запросе к OpenRouter:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// 8. Запускаем сервер
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});