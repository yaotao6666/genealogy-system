#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智慧族谱 · 后端服务
零依赖：仅使用 Python 标准库（http.server + sqlite3）。

启动：python3 server.py   （环境变量 PORT 可改端口，默认 8787）
数据库：app/data/genealogy.db（由 seed.py 生成）
上传照片：app/data/photos/

说明：
- 访客（未登录）可只读浏览与提交变更申请；写操作需管理员 Token。
- OCR 识别采用可插拔引擎：默认 provider=demo，内置"版面真值"识别
  （演示环境中谱页由 seed.py 生成，识别即还原该页真实内容，与真实
  OCR 的调用方式完全一致）。接入生产引擎时替换 ocr_engine() 内实现
  （如百度 OCR / Tesseract / 视觉大模型），接口不变。
"""
import hashlib
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, 'data', 'genealogy.db')
PHOTO_DIR = os.path.join(BASE, 'data', 'photos')
WEB_DIR = os.path.join(BASE, 'web')
PORT = int(os.environ.get('PORT', '8787'))

os.makedirs(PHOTO_DIR, exist_ok=True)

GEN_MAX = 30


# ---------------------------------------------------------------- DB
_local = threading.local()


def db():
    conn = getattr(_local, 'conn', None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute('PRAGMA journal_mode=WAL')
        _local.conn = conn
    return conn


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def now():
    return time.strftime('%Y-%m-%d %H:%M:%S')


# ---------------------------------------------------------------- auth
def hash_pwd(pwd, salt):
    return hashlib.sha256((salt + pwd).encode('utf-8')).hexdigest()


def current_user(headers):
    """从 Authorization: Bearer <token> 解析管理员；未登录返回 None。"""
    h = headers.get('Authorization', '')
    m = re.match(r'^Bearer\s+(\S+)$', h)
    if not m:
        return None
    row = db().execute(
        'SELECT u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=?',
        (m.group(1),)).fetchone()
    return row['username'] if row else None


def require_admin(headers):
    user = current_user(headers)
    if not user:
        raise ApiError(401, '请先登录管理端')
    return user


# ---------------------------------------------------------------- helpers
def row_member(r):
    if r is None:
        return None
    return {
        'id': r['id'], 'name': r['name'], 'zi': r['zi'], 'hao': r['hao'],
        'gen': r['gen'], 'birth': r['birth'], 'death': r['death'],
        'birth_year': r['birth_year'], 'death_year': r['death_year'],
        'father_id': r['father_id'], 'spouse': r['spouse'], 'intro': r['intro'],
    }


def member_pages(member_id):
    rows = db().execute(
        'SELECT p.page_no, p.title, p.photo_path, v.id AS vol_id, v.title AS vol_title '
        'FROM member_pages mp JOIN pages p ON p.id=mp.page_id '
        'JOIN volumes v ON v.id=p.volume_id WHERE mp.member_id=? ORDER BY p.page_no',
        (member_id,)).fetchall()
    return [{'page_no': r['page_no'], 'title': r['title'], 'photo_path': r['photo_path'],
             'vol_id': r['vol_id'], 'vol_title': r['vol_title']} for r in rows]


def get_member_or_404(mid):
    r = db().execute('SELECT * FROM members WHERE id=?', (mid,)).fetchone()
    if not r:
        raise ApiError(404, '未找到该族人')
    return r


def clean_str(v, max_len=200):
    if v is None:
        return ''
    return str(v).strip()[:max_len]


MEMBER_EDITABLE = ('name', 'zi', 'hao', 'gen', 'birth', 'death', 'father_id', 'spouse', 'intro')


def apply_member_fields(cur, member_id, data, partial=False):
    """校验并写入库（白名单字段）。"""
    row = cur.execute('SELECT * FROM members WHERE id=?', (member_id,)).fetchone()
    sets, vals = [], []
    for f in MEMBER_EDITABLE:
        if f not in data:
            if partial:
                continue
            if f in ('name', 'gen'):
                raise ApiError(400, '缺少必填字段：%s' % f)
            continue
        v = data[f]
        if f == 'name':
            v = clean_str(v, 30)
            if not v:
                raise ApiError(400, '姓名不能为空')
        elif f == 'gen':
            try:
                v = int(v)
            except Exception:
                raise ApiError(400, '世代不合法')
            if not (1 <= v <= GEN_MAX):
                raise ApiError(400, '世代需在 1—%d 之间' % GEN_MAX)
        elif f == 'father_id':
            v = int(v) if v not in (None, '', 0, '0') else None
            if v is not None:
                if v == member_id:
                    raise ApiError(400, '父亲不能是自己')
                fr = cur.execute('SELECT id,gen FROM members WHERE id=?', (v,)).fetchone()
                if not fr:
                    raise ApiError(400, '所选父亲不存在')
                mygen = int(data.get('gen', row['gen']) if data.get('gen') is not None else row['gen'])
                if fr['gen'] != mygen - 1:
                    raise ApiError(400, '父亲必须为上一世代（第%d世）' % (mygen - 1))
        elif f in ('zi', 'hao', 'birth', 'death', 'spouse'):
            v = clean_str(v, 60)
        else:
            v = clean_str(v, 800)
        sets.append(f + '=?')
        vals.append(v)
    if sets:
        sets.append('updated_at=?')
        vals.append(now())
        vals.append(member_id)
        cur.execute('UPDATE members SET ' + ','.join(sets) + ' WHERE id=?', vals)


def resolve_father(cur, father_name, gen):
    """OCR 录入时按「名字 + 上一世代」匹配父亲。"""
    if not father_name:
        return None
    r = cur.execute('SELECT id FROM members WHERE gen=? AND name=? ORDER BY id LIMIT 1',
                    (gen - 1, father_name)).fetchone()
    return r['id'] if r else None


def page_row(page_no):
    return db().execute(
        'SELECT p.*, v.id AS vol_id, v.title AS vol_title FROM pages p '
        'JOIN volumes v ON v.id=p.volume_id WHERE p.page_no=?', (page_no,)).fetchone()


def demo_ocr_engine(page, image_saved):
    """演示版识别引擎：按页内「真值」返回识别结果，与真实 OCR 调用方式一致。

    生产接入：将本函数替换为真实引擎调用（返回结构保持不变）：
      records: [{name, zi, gen, birth, death, father_name, spouse, intro,
                 truth_id?, confidence:{field: 0~1}}]
    """
    conn = db()
    truths = conn.execute('SELECT * FROM truth_records WHERE page_id=? ORDER BY seq', (page['id'],)).fetchall()
    records, note = [], ''
    if truths:
        for i, t in enumerate(truths):
            # 以记录为种子的确定性置信度，模拟真实识别的逐字段差异
            seed = (page['page_no'] * 131 + i * 17) % 1000
            cf = lambda lo, hi: round(lo + (hi - lo) * ((seed * 7 + hash_seed(i)) % 100) / 100.0, 2)
            records.append({
                'truth_id': t['id'],
                'name': t['name'], 'zi': t['zi'], 'gen': t['gen'],
                'birth': t['birth'], 'death': t['death'],
                'father_name': t['father_name'], 'spouse': t['spouse'], 'intro': t['intro'],
                'confidence': {
                    'name': cf(0.9, 0.99), 'zi': cf(0.72, 0.95), 'birth': cf(0.7, 0.96),
                    'death': cf(0.68, 0.95), 'spouse': cf(0.75, 0.97), 'gen': cf(0.9, 0.99),
                    'intro': cf(0.6, 0.9),
                },
            })
        note = '识别到 %d 条齿录记录，请逐条核对后保存' % len(records)
    else:
        linked = conn.execute(
            'SELECT COUNT(*) c FROM member_pages WHERE page_id=?', (page['id'],)).fetchone()['c']
        if linked:
            note = '本页已录入 %d 位族人（识别结果为已关联内容）' % linked
        else:
            note = '未识别到谱文内容，请调整拍摄后重试，或手动录入'
    return {'provider': 'demo', 'records': records, 'message': note}


def hash_seed(i):
    return (i * 2654435761) % 1000003


# ---------------------------------------------------------------- routes
ROUTES = []


def route(method, pattern):
    rx = re.compile('^' + pattern + '$')

    def deco(fn):
        ROUTES.append((method, rx, fn))
        return fn
    return deco


# ---- 公开信息 ----
@route('GET', r'/api/info')
def api_info(ctx):
    c = db()
    members = c.execute('SELECT COUNT(*) n FROM members').fetchone()['n']
    gens = c.execute('SELECT COUNT(DISTINCT gen) n FROM members').fetchone()['n']
    pages = c.execute('SELECT COUNT(*) n FROM pages').fetchone()['n']
    linked = c.execute('SELECT COUNT(DISTINCT page_id) n FROM member_pages').fetchone()['n']
    return {'app': '智慧族谱', 'members': members, 'gens': gens,
            'pages': pages, 'linked_pages': linked, 'server': now()}


@route('GET', r'/api/stats')
def api_stats(ctx):
    c = db()
    user = current_user(ctx.headers)
    members = c.execute('SELECT COUNT(*) n FROM members').fetchone()['n']
    pages = c.execute('SELECT COUNT(*) n FROM pages').fetchone()['n']
    linked = c.execute('SELECT COUNT(DISTINCT page_id) n FROM member_pages').fetchone()['n']
    gen_counts = [r['n'] for r in c.execute(
        'SELECT gen, COUNT(*) n FROM members GROUP BY gen ORDER BY gen')]
    out = {'members': members, 'pages': pages, 'linked_pages': linked,
           'gens': len(gen_counts), 'gen_counts': gen_counts}
    if user:
        out['pending'] = c.execute(
            "SELECT COUNT(*) n FROM requests WHERE status='pending'").fetchone()['n']
        out['truth_pages'] = c.execute(
            'SELECT COUNT(DISTINCT page_id) n FROM truth_records').fetchone()['n']
        out['truth_records'] = c.execute('SELECT COUNT(*) n FROM truth_records').fetchone()['n']
    return out


@route('GET', r'/api/screen')
def api_screen(ctx):
    """大屏驾驶舱聚合数据（公开）。"""
    c = db()
    members = c.execute('SELECT COUNT(*) AS n FROM members').fetchone()['n']
    gens = c.execute('SELECT COUNT(DISTINCT gen) AS n FROM members').fetchone()['n']
    pages = c.execute('SELECT COUNT(*) AS n FROM pages').fetchone()['n']
    linked = c.execute('SELECT COUNT(DISTINCT page_id) AS n FROM member_pages').fetchone()['n']
    truth_n = c.execute('SELECT COUNT(*) AS n FROM truth_records').fetchone()['n']
    volumes = c.execute('SELECT COUNT(*) AS n FROM volumes').fetchone()['n']
    gen_counts = [r['n'] for r in c.execute('SELECT gen, COUNT(*) AS n FROM members GROUP BY gen ORDER BY gen')]
    dyn = [dict(r) for r in c.execute(
        "SELECT d, COUNT(*) AS n, MIN(birth_year) AS y0, MAX(birth_year) AS y1 FROM ("
        " SELECT CASE WHEN birth_year<907 THEN '唐' WHEN birth_year<961 THEN '五代'"
        "  WHEN birth_year<1271 THEN '宋' WHEN birth_year<1368 THEN '元'"
        "  WHEN birth_year<1644 THEN '明' ELSE '清' END AS d, birth_year"
        " FROM members) GROUP BY d ORDER BY MIN(birth_year)")]
    married = c.execute("SELECT COUNT(*) AS n FROM members WHERE spouse<>''").fetchone()['n']
    childless = c.execute(
        'SELECT COUNT(*) AS n FROM members m WHERE NOT EXISTS('
        'SELECT 1 FROM members c WHERE c.father_id=m.id)').fetchone()['n']
    y0 = c.execute('SELECT MIN(birth_year) AS n FROM members').fetchone()['n']
    y1 = c.execute('SELECT MAX(death_year) AS n FROM members').fetchone()['n']
    # 主要支系：始祖各子支的后嗣总数（递归 CTE）
    branches = []
    root = c.execute('SELECT id FROM members WHERE father_id IS NULL LIMIT 1').fetchone()
    if root:
        kids = c.execute(
            'SELECT id, name, zi, gen, birth_year FROM members WHERE father_id=? ORDER BY birth_year',
            (root['id'],)).fetchall()
        for k in kids:
            n = c.execute(
                'WITH RECURSIVE t(id) AS (SELECT ? UNION ALL '
                ' SELECT m.id FROM members m JOIN t ON m.father_id=t.id)'
                ' SELECT COUNT(*) AS n FROM t', (k['id'],)).fetchone()['n'] - 1
            branches.append({'id': k['id'], 'name': k['name'], 'zi': k['zi'], 'gen': k['gen'],
                             'descendants': n})
        branches.sort(key=lambda x: -x['descendants'])
    reqs = {r['status']: r['n'] for r in c.execute(
        'SELECT status, COUNT(*) AS n FROM requests GROUP BY status')}
    return {'members': members, 'gens': gens, 'volumes': volumes, 'pages': pages,
            'linked_pages': linked, 'truth_records': truth_n,
            'gen_counts': gen_counts, 'dynasties': dyn,
            'married': married, 'childless': childless,
            'year_span': [y0, y1], 'branches': branches[:8], 'requests': reqs}


@route('GET', r'/api/notices')
def api_notices(ctx):
    rows = db().execute('SELECT content, date FROM notices ORDER BY id DESC LIMIT 5').fetchall()
    return {'items': [dict(r) for r in rows]}


# ---- 登录 ----
@route('POST', r'/api/login')
def api_login(ctx):
    username = clean_str(ctx.body.get('username'), 40)
    password = str(ctx.body.get('password') or '')
    if not username or not password:
        raise ApiError(400, '请输入账号和密码')
    u = db().execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
    if not u or hash_pwd(password, u['salt']) != u['pwd_hash']:
        raise ApiError(401, '账号或密码不正确')
    token = secrets.token_hex(24)
    db().execute('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)',
                 (token, u['id'], now()))
    db().commit()
    return {'token': token, 'username': u['username']}


@route('POST', r'/api/logout')
def api_logout(ctx):
    require_admin(ctx.headers)
    h = ctx.headers.get('Authorization', '')
    token = re.match(r'^Bearer\s+(\S+)$', h).group(1)
    db().execute('DELETE FROM sessions WHERE token=?', (token,))
    db().commit()
    return {}


@route('GET', r'/api/me')
def api_me(ctx):
    return {'username': require_admin(ctx.headers)}


# ---- 族人 ----
@route('GET', r'/api/members')
def api_members(ctx):
    q = ctx.query
    page = max(1, int(q.get('page', ['1'])[0] or 1))
    size = min(100, max(1, int(q.get('size', ['20'])[0] or 20)))
    where, vals = [], []
    if q.get('gen', [''])[0]:
        where.append('m.gen=?')
        vals.append(int(q['gen'][0]))
    kw = q.get('q', [''])[0].strip()
    if kw:
        where.append("(m.name LIKE ? OR m.zi LIKE ? OR m.hao LIKE ? OR m.spouse LIKE ? OR m.intro LIKE ?)")
        like = '%' + kw + '%'
        vals += [like] * 5
    w = ('WHERE ' + ' AND '.join(where)) if where else ''
    c = db()
    total = c.execute('SELECT COUNT(*) n FROM members m ' + w, vals).fetchone()['n']
    rows = c.execute(
        'SELECT m.id, m.name, m.zi, m.hao, m.gen, m.birth, m.spouse,'
        ' (SELECT COUNT(*) FROM member_pages mp WHERE mp.member_id=m.id) pages_n,'
        ' (SELECT COUNT(*) FROM members c2 WHERE c2.father_id=m.id) children,'
        ' f.name father_name'
        ' FROM members m LEFT JOIN members f ON f.id=m.father_id '
        + w + ' ORDER BY m.gen, m.birth_year, m.id LIMIT ? OFFSET ?',
        vals + [size, (page - 1) * size]).fetchall()
    return {'total': total, 'page': page, 'size': size,
            'items': [dict(r) for r in rows]}


@route('GET', r'/api/members/(?P<id>\d+)')
def api_member_detail(ctx):
    r = get_member_or_404(ctx.params['id'])
    c = db()
    father = c.execute('SELECT id,name,gen FROM members WHERE id=?',
                       (r['father_id'],)).fetchone() if r['father_id'] else None
    children = c.execute(
        'SELECT id,name,zi,gen FROM members WHERE father_id=? ORDER BY birth_year, id',
        (r['id'],)).fetchall()
    return {'member': row_member(r),
            'father': dict(father) if father else None,
            'children': [dict(x) for x in children],
            'pages': member_pages(r['id'])}


@route('POST', r'/api/members')
def api_member_create(ctx):
    require_admin(ctx.headers)
    data = ctx.body
    if not clean_str(data.get('name'), 30):
        raise ApiError(400, '姓名不能为空')
    c = db()
    cur = c.cursor()
    gen = data.get('gen')
    try:
        gen = int(gen)
    except Exception:
        raise ApiError(400, '世代不合法')
    if not (1 <= gen <= GEN_MAX):
        raise ApiError(400, '世代需在 1—%d 之间' % GEN_MAX)
    cur.execute(
        'INSERT INTO members(name,zi,hao,gen,birth,death,father_id,spouse,intro,created_at,updated_at)'
        ' VALUES(?,?,?,?,?,?,?,?,?,?,?)',
        (clean_str(data.get('name'), 30), clean_str(data.get('zi'), 60), clean_str(data.get('hao'), 60),
         gen, clean_str(data.get('birth'), 60), clean_str(data.get('death'), 60),
         None, clean_str(data.get('spouse'), 60), clean_str(data.get('intro'), 800), now(), now()))
    mid = cur.lastrowid
    apply_member_fields(cur, mid, data)
    c.commit()
    return {'id': mid}


@route('PUT', r'/api/members/(?P<id>\d+)')
def api_member_update(ctx):
    require_admin(ctx.headers)
    get_member_or_404(ctx.params['id'])
    c = db()
    apply_member_fields(c.cursor(), int(ctx.params['id']), ctx.body, partial=True)
    c.commit()
    return {}


@route('DELETE', r'/api/members/(?P<id>\d+)')
def api_member_delete(ctx):
    require_admin(ctx.headers)
    r = get_member_or_404(ctx.params['id'])
    kids = db().execute('SELECT COUNT(*) n FROM members WHERE father_id=?',
                        (r['id'],)).fetchone()['n']
    if kids:
        raise ApiError(400, '该族人有 %d 名子女记录，不可删除；请先处理其子女支线' % kids)
    c = db()
    c.execute('DELETE FROM member_pages WHERE member_id=?', (r['id'],))
    c.execute('DELETE FROM members WHERE id=?', (r['id'],))
    c.commit()
    return {}


# ---- 世系树（懒加载） ----
@route('GET', r'/api/tree/roots')
def api_tree_roots(ctx):
    rows = db().execute(
        'SELECT m.id, m.name, m.zi, m.gen, m.spouse,'
        ' (SELECT COUNT(*) FROM members c WHERE c.father_id=m.id) children'
        ' FROM members m WHERE father_id IS NULL ORDER BY m.gen, m.id').fetchall()
    return {'items': [dict(r) for r in rows]}


@route('GET', r'/api/tree/children/(?P<id>\d+)')
def api_tree_children(ctx):
    rows = db().execute(
        'SELECT m.id, m.name, m.zi, m.gen, m.spouse,'
        ' (SELECT COUNT(*) FROM members c WHERE c.father_id=m.id) children'
        ' FROM members m WHERE m.father_id=? ORDER BY m.birth_year, m.id',
        (ctx.params['id'],)).fetchall()
    return {'items': [dict(r) for r in rows]}


# ---- 卷册与谱页 ----
@route('GET', r'/api/volumes')
def api_volumes(ctx):
    rows = db().execute('SELECT * FROM volumes ORDER BY seq').fetchall()
    c = db()
    items = []
    for v in rows:
        total = c.execute('SELECT COUNT(*) n FROM pages WHERE volume_id=?', (v['id'],)).fetchone()['n']
        linked = c.execute(
            'SELECT COUNT(DISTINCT mp.page_id) n FROM member_pages mp '
            'JOIN pages p ON p.id=mp.page_id WHERE p.volume_id=?', (v['id'],)).fetchone()['n']
        first = c.execute('SELECT MIN(page_no) n FROM pages WHERE volume_id=?', (v['id'],)).fetchone()['n']
        items.append({'id': v['id'], 'title': v['title'], 'kind': v['kind'], 'seq': v['seq'],
                      'pages_total': total, 'pages_linked': linked, 'first_page': first})
    return {'items': items}


@route('GET', r'/api/volumes/(?P<id>\d+)/pages')
def api_volume_pages(ctx):
    vid = int(ctx.params['id'])
    page = max(1, int(ctx.query.get('page', ['1'])[0] or 1))
    size = min(120, max(1, int(ctx.query.get('size', ['60'])[0] or 60)))
    c = db()
    total = c.execute('SELECT COUNT(*) n FROM pages WHERE volume_id=?', (vid,)).fetchone()['n']
    rows = c.execute(
        'SELECT p.page_no, p.title, p.photo_path,'
        ' (SELECT COUNT(*) FROM member_pages mp WHERE mp.page_id=p.id) linked'
        ' FROM pages p WHERE p.volume_id=? ORDER BY p.page_no LIMIT ? OFFSET ?',
        (vid, size, (page - 1) * size)).fetchall()
    return {'total': total, 'page': page, 'size': size, 'items': [dict(r) for r in rows]}


@route('GET', r'/api/pages/next-unlinked')
def api_next_unlinked(ctx):
    """自动定位下一待录入页：优先「有真值可识别」的页面，其次空白未录入页。"""
    vid = ctx.query.get('volume_id', [''])[0]
    c = db()
    base = 'SELECT p.page_no, p.title, p.volume_id FROM pages p WHERE NOT EXISTS(' \
           'SELECT 1 FROM member_pages mp WHERE mp.page_id=p.id)'
    with_truth = base + ' AND EXISTS(SELECT 1 FROM truth_records t WHERE t.page_id=p.id)'
    without_truth = base + ' AND NOT EXISTS(SELECT 1 FROM truth_records t WHERE t.page_id=p.id)'
    tries = []
    if vid:
        tries.append((with_truth + ' AND p.volume_id=? ORDER BY p.page_no LIMIT 1', (int(vid),), True))
    tries.append((with_truth + ' ORDER BY p.page_no LIMIT 1', (), True))
    if vid:
        tries.append((without_truth + ' AND p.volume_id=? ORDER BY p.page_no LIMIT 1', (int(vid),), False))
    tries.append((without_truth + ' ORDER BY p.page_no LIMIT 1', (), False))
    for sql, vals, has_truth in tries:
        r = c.execute(sql, vals).fetchone()
        if r:
            return {'page_no': r['page_no'], 'title': r['title'],
                    'volume_id': r['volume_id'], 'has_truth': has_truth}
    raise ApiError(404, '所有页面均已录入关联')


@route('GET', r'/api/pages/(?P<no>\d+)')
def api_page_detail(ctx):
    page_no = int(ctx.params['no'])
    p = page_row(page_no)
    if not p:
        raise ApiError(404, '未找到该谱页')
    total_pages = db().execute('SELECT MAX(page_no) n FROM pages').fetchone()['n']
    rows = db().execute(
        'SELECT m.id, m.name, m.zi, m.hao, m.gen, m.birth, m.death, m.spouse, f.name father_name'
        ' FROM member_pages mp JOIN members m ON m.id=mp.member_id'
        ' LEFT JOIN members f ON f.id=m.father_id'
        ' WHERE mp.page_id=? ORDER BY m.gen, m.birth_year, m.id', (p['id'],)).fetchall()
    return {'page': {'page_no': p['page_no'], 'title': p['title'], 'photo_path': p['photo_path']},
            'volume': {'id': p['vol_id'], 'title': p['vol_title']},
            'members': [dict(r) for r in rows],
            'prev_page': page_no - 1 if page_no > 1 else None,
            'next_page': page_no + 1 if page_no < total_pages else None,
            'total_pages': total_pages}


@route('POST', r'/api/pages/(?P<no>\d+)/recognize')
def api_page_recognize(ctx):
    """拍照识别：保存照片 → 返回结构化识别结果（可插拔引擎）。"""
    require_admin(ctx.headers)
    page_no = int(ctx.params['no'])
    p = page_row(page_no)
    if not p:
        raise ApiError(404, '未找到该谱页')
    img = ctx.files.get('image')
    photo_saved = False
    if img and img.get('body') and len(img['body']) > 128:
        ext = '.jpg'
        fn = img.get('filename') or ''
        m = re.search(r'\.(jpe?g|png|webp|gif)$', fn, re.I)
        if m:
            ext = '.' + m.group(1).lower().replace('jpeg', 'jpg')
        path = os.path.join(PHOTO_DIR, 'page_%d%s' % (page_no, ext))
        with open(path, 'wb') as f:
            f.write(img['body'])
        photo = '/photos/' + os.path.basename(path)
        db().execute('UPDATE pages SET photo_path=?, photo_at=? WHERE id=?', (photo, now(), p['id']))
        db().commit()
        photo_saved = True
    result = demo_ocr_engine(p, photo_saved)
    result['photo_saved'] = photo_saved
    result['page'] = {'page_no': p['page_no'], 'title': p['title'], 'volume': p['vol_title']}
    return result


@route('POST', r'/api/pages/(?P<no>\d+)/photo')
def api_page_photo(ctx):
    """仅替换/上传照片（不识别）。"""
    require_admin(ctx.headers)
    page_no = int(ctx.params['no'])
    p = page_row(page_no)
    if not p:
        raise ApiError(404, '未找到该谱页')
    img = ctx.files.get('image')
    if not img or not img.get('body') or len(img['body']) < 128:
        raise ApiError(400, '请选择要上传的照片')
    ext = '.jpg'
    m = re.search(r'\.(jpe?g|png|webp|gif)$', img.get('filename') or '', re.I)
    if m:
        ext = '.' + m.group(1).lower().replace('jpeg', 'jpg')
    path = os.path.join(PHOTO_DIR, 'page_%d%s' % (page_no, ext))
    with open(path, 'wb') as f:
        f.write(img['body'])
    photo = '/photos/' + os.path.basename(path)
    db().execute('UPDATE pages SET photo_path=?, photo_at=? WHERE id=?', (photo, now(), p['id']))
    db().commit()
    return {'photo_path': photo}


@route('POST', r'/api/pages/(?P<no>\d+)/confirm')
def api_page_confirm(ctx):
    """确认录入：按识别记录创建族人并与本页建立关联（OCR 简化录入的保存端点）。"""
    require_admin(ctx.headers)
    page_no = int(ctx.params['no'])
    p = page_row(page_no)
    if not p:
        raise ApiError(404, '未找到该谱页')
    records = ctx.body.get('records') or []
    link_ids = ctx.body.get('link_member_ids') or []
    if not records and not link_ids:
        raise ApiError(400, '请至少勾选一条识别记录，或选择要关联的族人')
    c = db()
    cur = c.cursor()
    created, linked = [], 0
    for rec in records:
        if not isinstance(rec, dict):
            continue
        name = clean_str(rec.get('name'), 30)
        if not name:
            raise ApiError(400, '识别记录缺少姓名，无法保存')
        try:
            gen = int(rec.get('gen'))
        except Exception:
            raise ApiError(400, '识别记录世代不合法：%s' % rec.get('gen'))
        if not (1 <= gen <= GEN_MAX):
            raise ApiError(400, '识别记录世代需在 1—%d 之间' % GEN_MAX)
        birth = clean_str(rec.get('birth'), 60)
        death = clean_str(rec.get('death'), 60)
        cur.execute(
            'INSERT INTO members(name,zi,hao,gen,birth,death,father_id,spouse,intro,created_at,updated_at)'
            ' VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            (name, clean_str(rec.get('zi'), 60), clean_str(rec.get('hao'), 60), gen,
             birth, death, None, clean_str(rec.get('spouse'), 60), clean_str(rec.get('intro'), 800),
             now(), now()))
        mid = cur.lastrowid
        fid = resolve_father(cur, clean_str(rec.get('father_name'), 30), gen)
        if fid:
            cur.execute('UPDATE members SET father_id=? WHERE id=?', (fid, mid))
        cur.execute('INSERT OR IGNORE INTO member_pages(member_id,page_id) VALUES(?,?)', (mid, p['id']))
        created.append(mid)
        if rec.get('truth_id'):
            cur.execute('DELETE FROM truth_records WHERE id=?', (rec['truth_id'],))
    for lid in link_ids:
        r = cur.execute('SELECT id FROM members WHERE id=?', (lid,)).fetchone()
        if r:
            cur.execute('INSERT OR IGNORE INTO member_pages(member_id,page_id) VALUES(?,?)', (lid, p['id']))
            linked += 1
    c.commit()
    return {'created': created, 'linked': linked}


@route('POST', r'/api/pages/(?P<no>\d+)/unlink')
def api_page_unlink(ctx):
    require_admin(ctx.headers)
    page_no = int(ctx.params['no'])
    p = page_row(page_no)
    if not p:
        raise ApiError(404, '未找到该谱页')
    mid = ctx.body.get('member_id')
    c = db()
    c.execute('DELETE FROM member_pages WHERE page_id=? AND member_id=?', (p['id'], mid))
    c.commit()
    return {}


# ---- 变更申请 ----
@route('GET', r'/api/requests')
def api_requests(ctx):
    require_admin(ctx.headers)
    status = ctx.query.get('status', ['pending'])[0]
    page = max(1, int(ctx.query.get('page', ['1'])[0] or 1))
    size = min(100, max(1, int(ctx.query.get('size', ['20'])[0] or 20)))
    where, vals = [], []
    if status in ('pending', 'approved', 'rejected'):
        where.append('status=?')
        vals.append(status)
    w = ('WHERE ' + ' AND '.join(where)) if where else ''
    c = db()
    total = c.execute('SELECT COUNT(*) n FROM requests ' + w, vals).fetchone()['n']
    rows = c.execute('SELECT * FROM requests ' + w +
                     ' ORDER BY (status="pending") DESC, id DESC LIMIT ? OFFSET ?',
                     vals + [size, (page - 1) * size]).fetchall()
    items = []
    for r in rows:
        d = dict(r)
        if d['target_id']:
            t = c.execute('SELECT name,gen FROM members WHERE id=?', (d['target_id'],)).fetchone()
            d['target_name'] = t['name'] if t else '（已删除）'
        else:
            d['target_name'] = None
        items.append(d)
    return {'total': total, 'page': page, 'size': size, 'items': items}


@route('GET', r'/api/requests/(?P<id>\d+)')
def api_request_detail(ctx):
    require_admin(ctx.headers)
    r = db().execute('SELECT * FROM requests WHERE id=?', (ctx.params['id'],)).fetchone()
    if not r:
        raise ApiError(404, '未找到该申请')
    d = dict(r)
    d['payload_obj'] = {}
    try:
        d['payload_obj'] = json.loads(r['payload'] or '{}')
    except Exception:
        pass
    if d['target_id']:
        t = get_member_or_404(d['target_id'])
        d['target_name'] = t['name']
        d['target_gen'] = t['gen']
    else:
        d['target_name'] = None
    return d


@route('POST', r'/api/requests')
def api_request_create(ctx):
    """公开接口：任何访客可提交变更申请。"""
    rtype = clean_str(ctx.body.get('type'), 12)
    if rtype not in ('修改信息', '新增族人', '纠正关联'):
        raise ApiError(400, '变更类型不合法')
    content = clean_str(ctx.body.get('content'), 1000)
    if not content:
        raise ApiError(400, '请填写变更内容')
    target_id = ctx.body.get('target_id')
    try:
        target_id = int(target_id) if target_id not in (None, '', 0) else None
    except Exception:
        target_id = None
    if target_id:
        get_member_or_404(target_id)
    c = db()
    cur = c.cursor()
    cur.execute(
        'INSERT INTO requests(type,target_id,content,applicant,evidence,payload,status,created_at)'
        ' VALUES(?,?,?,?,?,?,?,?)',
        (rtype, target_id, content, clean_str(ctx.body.get('applicant'), 40) or '匿名访客',
         clean_str(ctx.body.get('evidence'), 60), '{}', 'pending', now()))
    rid = cur.lastrowid
    c.commit()
    return {'id': rid}


def apply_request(req):
    """审核通过时，将申请内容实际写入数据。"""
    c = db()
    cur = c.cursor()
    payload = {}
    try:
        payload = json.loads(req['payload'] or '{}')
    except Exception:
        pass
    rtype = req['type']
    if rtype == '修改信息':
        mid = payload.get('member_id') or req['target_id']
        row = get_member_or_404(mid)
        field = payload.get('field')
        if field not in ('name', 'zi', 'hao', 'birth', 'death', 'spouse', 'intro', 'gen'):
            raise ApiError(400, '申请的字段不可修改')
        cur.execute('UPDATE members SET %s=?, updated_at=? WHERE id=?' % field,
                    (payload.get('value'), now(), row['id']))
    elif rtype == '新增族人':
        m = payload.get('member') or {}
        name = clean_str(m.get('name'), 30)
        if not name:
            raise ApiError(400, '申请中的族人信息缺少姓名')
        try:
            gen = int(m.get('gen', 4))
        except Exception:
            gen = 4
        cur.execute(
            'INSERT INTO members(name,zi,hao,gen,birth,death,father_id,spouse,intro,created_at,updated_at)'
            ' VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            (name, clean_str(m.get('zi'), 60), clean_str(m.get('hao'), 60), gen,
             clean_str(m.get('birth'), 60), clean_str(m.get('death'), 60),
             int(m['father_id']) if m.get('father_id') else None,
             clean_str(m.get('spouse'), 60), clean_str(m.get('intro'), 800), now(), now()))
    elif rtype == '纠正关联':
        mid = payload.get('member_id') or req['target_id']
        row = get_member_or_404(mid)
        to_page = payload.get('to_page')
        pr = cur.execute('SELECT id FROM pages WHERE page_no=?', (to_page,)).fetchone()
        if not pr:
            raise ApiError(400, '目标谱页不存在')
        cur.execute('DELETE FROM member_pages WHERE member_id=?', (row['id'],))
        cur.execute('INSERT INTO member_pages(member_id,page_id) VALUES(?,?)', (row['id'], pr['id']))
    c.commit()


@route('POST', r'/api/requests/(?P<id>\d+)/approve')
def api_request_approve(ctx):
    require_admin(ctx.headers)
    r = db().execute('SELECT * FROM requests WHERE id=?', (ctx.params['id'],)).fetchone()
    if not r:
        raise ApiError(404, '未找到该申请')
    if r['status'] != 'pending':
        raise ApiError(400, '该申请已处理')
    try:
        apply_request(r)
    except ApiError as e:
        raise ApiError(400, '无法生效：%s' % e.message)
    db().execute('UPDATE requests SET status=?, result=?, handled_at=? WHERE id=?',
                 ('approved', '已通过，' + now() + ' 生效', now(), r['id']))
    db().commit()
    return {}


@route('POST', r'/api/requests/(?P<id>\d+)/reject')
def api_request_reject(ctx):
    require_admin(ctx.headers)
    r = db().execute('SELECT * FROM requests WHERE id=?', (ctx.params['id'],)).fetchone()
    if not r:
        raise ApiError(404, '未找到该申请')
    if r['status'] != 'pending':
        raise ApiError(400, '该申请已处理')
    reason = clean_str(ctx.body.get('reason'), 300)
    if not reason:
        raise ApiError(400, '请填写驳回理由')
    db().execute('UPDATE requests SET status=?, result=?, handled_at=? WHERE id=?',
                 ('rejected', '驳回：' + reason, now(), r['id']))
    db().commit()
    return {}


# ---------------------------------------------------------------- HTTP
class Ctx(object):
    def __init__(self, handler, method):
        self.method = method
        parsed = urlparse(handler.path)
        self.path = unquote(parsed.path)
        self.query = parse_qs(parsed.query)
        self.headers = handler.headers
        self.params = {}
        self.body = {}
        self.files = {}


class Handler(BaseHTTPRequestHandler):
    server_version = 'GenealogyServer/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        pass  # 安静模式

    # --- 响应工具 ---
    def send_json(self, obj, status=200):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def send_file(self, path, status=200):
        try:
            with open(path, 'rb') as f:
                data = f.read()
        except IOError:
            self.send_json({'error': 'Not Found'}, 404)
            return
        ctype = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        if path.endswith('.js'):
            ctype = 'application/javascript'
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(data)

    # --- 请求体解析 ---
    def read_body(self):
        length = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(length) if length else b''

    def parse_multipart(self, raw):
        ctype = self.headers.get('Content-Type', '')
        m = re.search(r'boundary="?([^";]+)"?', ctype)
        out_files, out_fields = {}, {}
        if not m:
            return out_fields, out_files
        boundary = ('--' + m.group(1)).encode('utf-8')
        for part in raw.split(boundary):
            part = part.strip(b'\r\n')
            if not part or part == b'--':
                continue
            if b'\r\n\r\n' not in part:
                continue
            head, body = part.split(b'\r\n\r\n', 1)
            head = head.decode('utf-8', 'ignore')
            nm = re.search(r'name="([^"]*)"', head)
            fn = re.search(r'filename="([^"]*)"', head)
            if not nm:
                continue
            name = nm.group(1)
            if fn:
                out_files[name] = {'filename': fn.group(1), 'body': body}
            else:
                out_fields[name] = body.decode('utf-8', 'ignore')
        return out_fields, out_files

    # --- 分发 ---
    def dispatch(self, method):
        ctx = Ctx(self, method)
        try:
            raw = self.read_body()
            ctype = (self.headers.get('Content-Type') or '').lower()
            if method in ('POST', 'PUT', 'DELETE'):
                if 'multipart/form-data' in ctype:
                    fields, files = self.parse_multipart(raw)
                    ctx.files = files
                    ctx.body = {k: v for k, v in fields.items()}
                    for k, v in ctx.body.items():
                        if v in ('', None):
                            continue
                        try:
                            parsed = json.loads(v)
                            ctx.body[k] = parsed
                        except Exception:
                            pass
                else:
                    ctx.body = json.loads(raw.decode('utf-8')) if raw else {}
                    if not isinstance(ctx.body, dict):
                        ctx.body = {'_data': ctx.body}
            matched = False
            for m, rx, fn in ROUTES:
                if m != method:
                    continue
                mt = rx.match(ctx.path)
                if mt:
                    matched = True
                    ctx.params = mt.groupdict()
                    result = fn(ctx)
                    self.send_json(result)
                    return
            if matched is False and ctx.path.startswith('/api/'):
                self.send_json({'error': '接口不存在'}, 404)
                return
            # 静态文件
            self.serve_static(ctx)
        except ApiError as e:
            self.send_json({'error': e.message}, e.status)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            import traceback
            traceback.print_exc()
            try:
                self.send_json({'error': '服务器内部错误：%s' % e}, 500)
            except Exception:
                pass

    def serve_static(self, ctx):
        path = ctx.path
        if path == '/':
            path = '/index.html'
        if path == '/screen':
            path = '/screen.html'
        safe = os.path.normpath(path).lstrip('/\\')
        full = os.path.join(WEB_DIR, safe)
        if not full.startswith(WEB_DIR):
            self.send_json({'error': 'Forbidden'}, 403)
            return
        if os.path.isfile(full):
            self.send_file(full)
            return
        if path.startswith('/photos/'):
            safe2 = os.path.normpath(path[len('/photos/'):])
            full2 = os.path.join(PHOTO_DIR, safe2)
            if full2.startswith(PHOTO_DIR) and os.path.isfile(full2):
                self.send_file(full2)
                return
        self.send_json({'error': 'Not Found'}, 404)

    def do_GET(self):
        self.dispatch('GET')

    def do_POST(self):
        self.dispatch('POST')

    def do_PUT(self):
        self.dispatch('PUT')

    def do_DELETE(self):
        self.dispatch('DELETE')


def main():
    if not os.path.exists(DB_PATH):
        print('!! 未找到数据库 %s' % DB_PATH)
        print('!! 请先运行：python3 seed.py 生成演示数据')
        raise SystemExit(1)
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print('智慧族谱服务已启动: http://127.0.0.1:%d  （管理员: admin / admin123）' % PORT)
    srv.serve_forever()


if __name__ == '__main__':
    main()
