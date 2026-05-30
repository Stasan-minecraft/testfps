# SocialNet — Соціальна мережа 🌐

Повноцінна соціальна мережа, побудована з нуля.

## Можливості

- 📝 Реєстрація та авторизація (JWT)
- 👤 Профілі користувачів (аватар, біо)
- 📰 Створення постів
- ❤️ Лайки
- 💬 Коментарі
- 👥 Підписки (follow/unfollow)
- 📡 Персональна стрічка
- 🔍 Пошук користувачів

## Стек технологій

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite, JWT
- **Frontend**: Vanilla HTML/CSS/JavaScript (SPA)
- **Deploy**: Fly.io (backend) + devinapps.com (frontend)

## Запуск локально

### Backend

```bash
cd backend
pip install -e .
uvicorn main:app --reload
```

API доступне на `http://localhost:8000`

### Frontend

Відкрийте `frontend/index.html` у браузері або запустіть:

```bash
cd frontend
python -m http.server 3000
```

Фронтенд доступний на `http://localhost:3000`

## API Endpoints

| Method | Endpoint | Опис |
|--------|----------|------|
| POST | `/api/auth/register` | Реєстрація |
| POST | `/api/auth/login` | Вхід |
| GET | `/api/auth/me` | Поточний користувач |
| GET | `/api/users` | Пошук користувачів |
| GET | `/api/users/{username}` | Профіль |
| PUT | `/api/users/me` | Оновити профіль |
| POST | `/api/users/{username}/follow` | Підписатися |
| DELETE | `/api/users/{username}/follow` | Відписатися |
| GET | `/api/feed` | Персональна стрічка |
| GET/POST | `/api/posts` | Пости |
| POST/DELETE | `/api/posts/{id}/like` | Лайки |
| GET/POST | `/api/posts/{id}/comments` | Коментарі |

## Ліцензія

MIT
