const Auth = {
    user: null,

    async refresh() {
        try {
            const res = await fetch('/api/me');
            const data = await res.json();
            this.user = data.authenticated ? data : null;
        } catch (e) {
            this.user = null;
        }
        this.renderUserBox();
    },

    isAuthenticated() {
        return this.user !== null;
    },

    renderUserBox() {
        const box = document.getElementById('userBox');
        if (!box) return;

        if (this.user) {
            // ============================================================
            //  ССЫЛКА НА ПРОФИЛЬ ИЗ БД
            // ============================================================
            const profileUrl = `/pages/users/${this.user.username}.html`;

            box.innerHTML = `
                <div class="user-line">
                    <a href="${profileUrl}" class="username">${this.user.username}</a>
                    <a href="#" class="logout-link" id="logoutBtn">Выйти</a>
                </div>
                <span class="user-rank">${this.user.rank} · ${this.user.score} очков</span>
            `;

            document.getElementById('logoutBtn').addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        } else {
            box.innerHTML = `
                <a href="#login" class="login-link">Войти</a>
            `;
        }
    },

    async login(username, password) {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка входа');
        await this.refresh();
        return data;
    },

    async register(username, password) {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
        await this.refresh();
        return data;
    },

    async logout() {
        await fetch('/api/logout', { method: 'POST' });
        this.user = null;
        this.renderUserBox();
        location.hash = '#home';
    }
};

// Автоматический запрос при загрузке
document.addEventListener('DOMContentLoaded', () => {
    Auth.refresh();
});