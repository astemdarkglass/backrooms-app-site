import os
import re
from flask import Flask, render_template, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager, UserMixin, login_user, login_required,
    logout_user, current_user
)
from werkzeug.security import generate_password_hash, check_password_hash

# ---------- КОНФИГ ----------
app = Flask(__name__)
app.config['SECRET_KEY'] = 'dev-secret-key-change-me'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///backrooms.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'index'

PAGES_DIR = os.path.join(app.root_path, 'templates', 'pages')

# ---- ВКЛЮЧАЕМ ПОДРОБНЫЕ ЛОГИ ----
DEBUG_ACCESS = True   # ← переключите в False, когда всё заработает


def log(*args):
    if DEBUG_ACCESS:
        print('[ACCESS]', *args)


# ---------- МОДЕЛИ ----------
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    rank = db.Column(db.String(50), default='Начинающий')
    score = db.Column(db.Integer, default=0)
    access_level = db.Column(db.Integer, default=0)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'rank': self.rank,
            'score': self.score,
            'access_level': self.access_level,
        }


class Page(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(80), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    html = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    def to_dict(self):
        return {
            'id': self.id,
            'slug': self.slug,
            'title': self.title,
            'html': self.html,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ---------- ПАРСЕР ----------
_pages_cache = {}


def parse_pages_file(filename):
    path = os.path.join(PAGES_DIR, filename)
    if not os.path.exists(path):
        return {}

    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()

    pages = {}
    pattern = re.compile(
        r'<!--\s*#page:\s*([\w\-\.]+)([^>]*?)-->(.*?)<!--\s*/#page\s*-->',
        re.DOTALL
    )

    for m in pattern.finditer(raw):
        slug = m.group(1).strip()
        attrs_raw = m.group(2).strip()
        body = m.group(3).strip()

        attrs = {}
        for pair in attrs_raw.split():
            if ':' in pair:
                k, v = pair.split(':', 1)
                attrs[k.strip()] = v.strip()

        access = int(attrs.get('access', 0))

        style_tags = re.findall(r'<style[^>]*>.*?</style>', body, re.DOTALL)
        link_tags = re.findall(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', body)
        style_block = '\n'.join(style_tags + link_tags)

        body_clean = re.sub(r'<style[^>]*>.*?</style>', '', body, flags=re.DOTALL)
        body_clean = re.sub(r'<link[^>]+rel=["\']stylesheet["\'][^>]*>', '', body_clean)

        pages[slug] = {
            'html': body_clean.strip(),
            'style': style_block.strip(),
            'access': access,
        }
        log(f'parsed: {filename} -> {slug} (access={access})')

    if not pages:
        log(f'WARNING: no pages found in {filename}. '
            f'Check markers <!-- #page: slug --> ... <!-- /#page -->')

    return pages


def find_page_in_files(slug):
    if not os.path.isdir(PAGES_DIR):
        log(f'PAGES_DIR not found: {PAGES_DIR}')
        return None

    for filename in sorted(os.listdir(PAGES_DIR)):
        if not filename.endswith('.html'):
            continue

        if filename not in _pages_cache:
            _pages_cache[filename] = parse_pages_file(filename)

        pages = _pages_cache.get(filename, {})
        if slug in pages:
            data = pages[slug]
            return {
                'slug': slug,
                'html': data['html'],
                'style': data['style'],
                'access': data['access'],
                'source': filename,
            }
    return None


# ---------- ОБОЛОЧКА ----------
@app.route('/')
@app.route('/<path:path>')
def index(path=''):
    return render_template('index.html')


# ---------- API КОНТЕНТА ----------
@app.route('/api/content/<path:slug>')
def api_content(slug):
    found = find_page_in_files(slug)

    if found:
        required = found.get('access', 0)
        user_level = current_user.access_level if current_user.is_authenticated else 0
        user_name = current_user.username if current_user.is_authenticated else 'гость'

        log(f'request "{slug}" | user={user_name} level={user_level} '
            f'required={required} source={found["source"]}')

        if required > user_level:
            log(f'  -> DENIED')
            return jsonify({
                'slug': slug,
                'html': (
                    '<div class="access-denied">'
                    '<h2>Доступ закрыт</h2>'
                    f'<p>Эта страница требует уровень доступа <b>{required}</b>, '
                    f'у вас — <b>{user_level}</b>.</p>'
                    '</div>'
                ),
                'style': '',
                'access_denied': True,
                'required': required,
                'user_level': user_level,
            }), 403

        log(f'  -> OK')
        return jsonify(found)

    p = Page.query.filter_by(slug=slug).first()
    if p:
        return jsonify({'slug': p.slug, 'html': p.html, 'style': '', 'source': 'database'})

    log(f'  -> NOT FOUND')
    return jsonify({
        'slug': slug,
        'html': '<p>Страница не найдена</p>',
        'style': '',
    }), 404


@app.route('/api/reload-pages', methods=['POST'])
def api_reload_pages():
    _pages_cache.clear()
    log('cache cleared')
    return jsonify({'ok': True})


# ---------- ДИАГНОСТИКА ----------
@app.route('/api/debug/pages')
def debug_pages():
    """Показывает, какие страницы найдены и с каким access."""
    result = {}
    for filename in sorted(os.listdir(PAGES_DIR)):
        if filename.endswith('.html'):
            _pages_cache[filename] = parse_pages_file(filename)
            result[filename] = {
                slug: {'access': d['access'], 'html_len': len(d['html'])}
                for slug, d in _pages_cache[filename].items()
            }
    return jsonify(result)


@app.route('/api/debug/me')
def debug_me():
    """Показывает, кто вы и какой у вас access_level."""
    if current_user.is_authenticated:
        return jsonify({
            'authenticated': True,
            'username': current_user.username,
            'rank': current_user.rank,
            'access_level': current_user.access_level,
        })
    return jsonify({'authenticated': False, 'access_level': 0})


@app.route('/api/debug/user/<username>')
def debug_user(username):
    """Показывает access_level конкретного пользователя (для отладки)."""
    u = User.query.filter_by(username=username).first()
    if not u:
        return jsonify({'error': 'not found'}), 404
    return jsonify(u.to_dict())


@app.route('/api/debug/set-access/<username>/<int:level>')
def debug_set_access(username, level):
    """Быстрая установка access_level — только для отладки."""
    u = User.query.filter_by(username=username).first()
    if not u:
        return jsonify({'error': 'not found'}), 404
    u.access_level = level
    db.session.commit()
    return jsonify({'ok': True, 'user': u.to_dict()})


# ---------- АВТОРИЗАЦИЯ (как было) ----------
@app.route('/api/me')
def api_me():
    if current_user.is_authenticated:
        return jsonify({'authenticated': True, **current_user.to_dict()})
    return jsonify({'authenticated': False})


@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    if len(username) < 3:
        return jsonify({'error': 'Имя слишком короткое'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Пароль слишком короткий'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Пользователь уже существует'}), 400

    user = User(username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify({'ok': True, **user.to_dict()})


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    user = User.query.filter_by(username=username).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Неверный логин или пароль'}), 401

    login_user(user)
    log(f'login: {username} (access_level={user.access_level})')
    return jsonify({'ok': True, **user.to_dict()})


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'ok': True})


@app.route('/api/stats')
def api_stats():
    return jsonify({
        'levels': 42, 'entities': 17, 'objects': 8, 'records': 156,
        'users': User.query.count(),
    })


@app.route('/api/rating')
def api_rating():
    limit = request.args.get('limit', default=5, type=int)
    limit = max(1, min(limit, 50))
    users = User.query.order_by(User.score.desc()).limit(limit).all()
    return jsonify([u.to_dict() for u in users])


# ---------- ЗАПУСК ----------
if __name__ == '__main__':
    with app.app_context():
        # ВАЖНО: если в БД нет колонки access_level — пересоздаём её
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        if 'user' in inspector.get_table_names():
            cols = [c['name'] for c in inspector.get_columns('user')]
            if 'access_level' not in cols:
                print('!!! В таблице user нет access_level. Пересоздаю БД...')
                db.drop_all()
        db.create_all()

        os.makedirs(PAGES_DIR, exist_ok=True)

    app.run(debug=True)