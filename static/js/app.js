const contentEl = document.getElementById('pageContent');

// Удаляем ранее подключённые стили страницы
function clearPageStyles() {
    document.querySelectorAll('[data-page-style]').forEach(el => el.remove());
}

// Добавляем стили страницы (тег <style> или <link>)
function applyPageStyles(styleHtml) {
    clearPageStyles();
    if (!styleHtml) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = styleHtml;

    [...wrapper.children].forEach(node => {
        node.setAttribute('data-page-style', '1');
        document.head.appendChild(node);
    });
}

async function loadContent(slug) {
    contentEl.innerHTML = '<p>Загрузка…</p>';
    try {
        const res = await fetch(`/api/content/${encodeURIComponent(slug)}`);
        const data = await res.json();

        contentEl.innerHTML = data.html || '<p>Пустая страница</p>';
        applyPageStyles(data.style);

        if (typeof initCarousels === 'function') initCarousels();
    } catch (e) {
        contentEl.innerHTML = '<p>Ошибка загрузки.</p>';
        clearPageStyles();
    }
}

// ---------- Роутинг ----------
function handleRoute() {
    const hash = location.hash.replace('#', '') || 'home';
    const page = hash.split('/')[0];

    document.querySelectorAll('#navbar_link li').forEach(li => {
        li.classList.toggle('currentpage', li.dataset.route === page);
    });
    document.querySelectorAll('.sidebar-menu a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + page);
    });

    if (typeof window.renderAd === 'function') window.renderAd();

    if (page === 'login') { /* ... */ return; }

    // Передаём весь hash как slug — так можно адресовать /#levels-0
    loadContent(hash);
}

window.addEventListener('hashchange', handleRoute);
document.addEventListener('DOMContentLoaded', () => {
    // ...
    handleRoute();
});

// ---------- Страница авторизации ----------
function renderLoginPage() {
    contentEl.innerHTML = `
        <div class="auth-wrapper">
            <div class="auth-title">Вход в Архив</div>
            <div class="auth-subtitle">Только авторизованные странники могут оставлять записи</div>

            <div class="auth-tabs">
                <button class="auth-tab active" data-form="login">Вход</button>
                <button class="auth-tab" data-form="register">Регистрация</button>
            </div>

            <div class="auth-error" id="authError"></div>

            <!-- Форма входа -->
            <form class="auth-form active" id="loginForm">
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" name="username" autocomplete="username" required>
                </div>
                <div class="form-group">
                    <label>Пароль</label>
                    <input type="password" name="password" autocomplete="current-password" required>
                </div>
                <button type="submit" class="auth-btn">Войти</button>
                <p class="auth-hint">Тестовый аккаунт: <b>user38054 / 12345</b></p>
            </form>

            <!-- Форма регистрации -->
            <form class="auth-form" id="registerForm">
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" name="username" autocomplete="username" required minlength="3">
                </div>
                <div class="form-group">
                    <label>Пароль</label>
                    <input type="password" name="password" autocomplete="new-password" required minlength="4">
                </div>
                <div class="form-group">
                    <label>Повтор пароля</label>
                    <input type="password" name="password2" autocomplete="new-password" required minlength="4">
                </div>
                <button type="submit" class="auth-btn">Создать аккаунт</button>
            </form>
        </div>
    `;

    // Переключение вкладок
    contentEl.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            contentEl.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            contentEl.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
            tab.classList.add('active');
            const form = contentEl.querySelector('#' + tab.dataset.form + 'Form');
            if (form) form.classList.add('active');
            hideAuthError();
        });
    });

    // Форма входа
    contentEl.querySelector('#loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError();
        const fd = new FormData(e.target);
        try {
            await Auth.login(fd.get('username'), fd.get('password'));
            location.hash = '#home';
        } catch (err) {
            showAuthError(err.message);
        }
    });

    // Форма регистрации
    contentEl.querySelector('#registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAuthError();
        const fd = new FormData(e.target);
        if (fd.get('password') !== fd.get('password2')) {
            return showAuthError('Пароли не совпадают');
        }
        try {
            await Auth.register(fd.get('username'), fd.get('password'));
            location.hash = '#home';
        } catch (err) {
            showAuthError(err.message);
        }
    });
}

function showAuthError(msg) {
    const el = document.getElementById('authError');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visible');
}
function hideAuthError() {
    const el = document.getElementById('authError');
    if (el) el.classList.remove('visible');
}

// ---------- Загрузка статистики / рейтинга ----------
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const stats = await res.json();
        document.querySelectorAll('[data-stat]').forEach(el => {
            const key = el.dataset.stat;
            if (stats[key] !== undefined) el.textContent = stats[key];
        });
    } catch (e) {}
}

async function loadRating() {
    try {
        const res = await fetch('/api/rating');
        const users = await res.json();
        const rows = users.map((u, i) => {
            const cls = i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : '';
            return `<tr class="${cls}">
                <td class="rank-col">${i + 1}</td>
                <td class="user-col">
                    <a class="user-link" href="#user/${u.id}">${u.username}</a>
                    <span class="user-rank">${u.rank}</span>
                </td>
                <td class="score-col">${u.score}</td>
            </tr>`;
        }).join('');
        document.getElementById('ratingContainer').innerHTML = `
            <table class="rating-table">
                <thead>
                    <tr>
                        <th class="rank-col">#</th>
                        <th>Странник</th>
                        <th class="score-col">Очки</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>`;
    } catch (e) {}
}

// ---------- Роутинг ----------
function handleRoute() {
    const hash = location.hash.replace('#', '') || 'home';
    const page = hash.split('/')[0];

    // Подсветка меню
    document.querySelectorAll('#navbar_link li').forEach(li => {
        li.classList.toggle('currentpage', li.dataset.route === page);
    });
    document.querySelectorAll('.sidebar-menu a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + page);
    });
    if (typeof window.renderAd === 'function') window.renderAd();

    // Специальные страницы
    if (page === 'login') {
        if (Auth.isAuthenticated()) {
            location.hash = '#home';
            return;
        }
        renderLoginPage();
        return;
    }

    // Обычные страницы
    loadContent(page);
}

window.addEventListener('hashchange', handleRoute);

// ---------- Инициализация ----------
document.addEventListener('DOMContentLoaded', async () => {
    await Auth.refresh();     // сначала узнаём, кто мы
    loadStats();
    loadRating();
    handleRoute();
});