import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // раздача статики (index.html)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ Ошибка: OPENROUTER_API_KEY не задан');
} else {
  console.log('✅ API-ключ OpenRouter загружен');
}

// Эндпоинт для получения цены от AI
app.post('/api/price', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'API-ключ не настроен' });
  }

  const { flourName, vendorName } = req.body;
  console.log(`📥 Запрос цены: ${flourName}, ${vendorName}`);

  const prompt = `Ты — помощник. Название муки: ${flourName}. Продавец: ${vendorName}. Укажи только текущую розничную цену в рублях за килограмм (целое число). Без пояснений.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 20
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const aiReply = data.choices[0].message.content.trim();
    const price = parseInt(aiReply, 10);
    if (isNaN(price) || price <= 0) throw new Error('Неверный формат цены');

    console.log(`✅ Цена получена: ${price} ₽/кг`);
    res.json({ price });
  } catch (err) {
    console.error('Ошибка OpenRouter:', err);
    res.status(500).json({ error: 'Не удалось получить цену' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});