#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智慧族谱 · 演示数据生成器
生成：30 代、20000 人的宗谱数据 + 卷册谱页 + 待录入「真值」记录 + 变更申请/公告/管理员。

固定随机种子，可重复执行（每次重建数据库）。
运行：python3 seed.py
"""
import hashlib
import json
import os
import random
import sqlite3
import time

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, 'data', 'genealogy.db')
os.makedirs(os.path.join(BASE, 'data', 'photos'), exist_ok=True)

random.seed(20261025)

TOTAL = 20000
GENS = 30
GEN1_BIRTH = 872          # 第一世生于唐咸通年间
GAP_MIN, GAP_MAX = 20, 38  # 父子生年间隔

# 字辈诗（30 字，每世一字）：德文守承绍 克振家声远 贤良开泰运 忠孝立纲常 仁义礼智信 福寿永安康
BEIPO = list('德文守承绍克振家声远贤良开泰运忠孝立纲常仁义礼智信福寿永安康')
SECOND = list('松柏桐梓桢彬杰俊彦士儒卿侯龙凤麟骥鹏鹤霄汉山海川江清澄深源博厚乾宇轩昂廷国正天星明旦晨曦晖昀暄岳峰岚峤')
FEMALE_SUR = list('赵钱孙李周吴郑冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏窦章云苏潘葛范彭郎')
HAO = ['毅斋', '退思', '敬亭', '慕陶', '雪窗', '竹隐', '耕云', '卧霞', '听泉', '悟斋', '乐山', '朴庵', '澹园', '西畴', '南塘']
GONGMING = ['郡庠生', '县庠生', '岁贡生', '恩贡生', '廪生', '监生', '武举人', '乡饮大宾', '太学生']
ZHI = ['县丞', '教谕', '训导', '主簿', '巡检', '州同', '知县', '员外郎', '府教授', '驿丞']
YE = ['业农', '业儒', '业商', '业医', '设帐授徒', '兼营田产', '业盐策', '以耕读传家']
SHAN = ['置义田以赡族', '重修宗祠', '倡建石桥三座', '岁饥出粟赈济', '施药济贫', '设义学课族中子弟', '捐修学宫', '周恤邻里']
PIN = ['为人敦厚，乡里称长者', '秉性谨饬，治家有法', '豪爽尚义', '勤俭起家', '孝友传家', '端方质直']

# ---- 年号表（简化版，覆盖 860—1850）----
ERAS = [
    ('唐', 860, [('咸通', 860, 874), ('乾符', 874, 879), ('广明', 880, 880), ('中和', 881, 885),
                ('文德', 888, 888), ('龙纪', 889, 889), ('大顺', 890, 891), ('景福', 892, 893),
                ('乾宁', 894, 898), ('光化', 898, 901), ('天复', 901, 904), ('天祐', 904, 907)]),
    ('五代', 907, [('开平', 907, 911), ('乾化', 911, 915), ('贞明', 915, 921), ('龙德', 921, 923),
                  ('同光', 923, 926), ('天成', 926, 930), ('长兴', 930, 933), ('清泰', 934, 936),
                  ('天福', 936, 944), ('开运', 944, 946), ('乾祐', 948, 950), ('广顺', 951, 953),
                  ('显德', 954, 960)]),
    ('宋', 960, [('建隆', 960, 963), ('乾德', 963, 968), ('开宝', 968, 976), ('太平兴国', 976, 984),
                ('雍熙', 984, 987), ('端拱', 988, 989), ('淳化', 990, 994), ('至道', 995, 997),
                ('咸平', 998, 1003), ('景德', 1004, 1007), ('大中祥符', 1008, 1016), ('天禧', 1017, 1021),
                ('乾兴', 1022, 1022), ('天圣', 1023, 1032), ('明道', 1032, 1033), ('景祐', 1034, 1038),
                ('宝元', 1038, 1040), ('康定', 1040, 1041), ('庆历', 1041, 1048), ('皇祐', 1049, 1054),
                ('至和', 1054, 1056), ('嘉祐', 1056, 1063), ('治平', 1064, 1067), ('熙宁', 1068, 1077),
                ('元丰', 1078, 1085), ('元祐', 1086, 1094), ('绍圣', 1094, 1098), ('元符', 1098, 1100),
                ('建中靖国', 1101, 1101), ('崇宁', 1102, 1106), ('大观', 1107, 1110), ('政和', 1111, 1118),
                ('重和', 1118, 1119), ('宣和', 1119, 1125), ('靖康', 1126, 1127), ('建炎', 1127, 1130),
                ('绍兴', 1131, 1162), ('隆兴', 1163, 1164), ('乾道', 1165, 1173), ('淳熙', 1174, 1189),
                ('绍熙', 1190, 1194), ('庆元', 1195, 1200), ('嘉泰', 1201, 1204), ('开禧', 1205, 1207),
                ('嘉定', 1208, 1224), ('宝庆', 1225, 1227), ('绍定', 1228, 1233), ('端平', 1234, 1236),
                ('嘉熙', 1237, 1240), ('淳祐', 1241, 1252), ('宝祐', 1253, 1258), ('开庆', 1259, 1259),
                ('景定', 1260, 1264), ('咸淳', 1265, 1274), ('德祐', 1275, 1276), ('景炎', 1276, 1278),
                ('祥兴', 1278, 1279)]),
    ('元', 1271, [('至元', 1271, 1294), ('元贞', 1295, 1297), ('大德', 1297, 1307), ('至大', 1308, 1311),
                 ('皇庆', 1312, 1313), ('延祐', 1314, 1320), ('至治', 1321, 1323), ('泰定', 1324, 1328),
                 ('天历', 1329, 1330), ('至顺', 1330, 1333), ('元统', 1333, 1335), ('至元', 1335, 1340),
                 ('至正', 1341, 1368)]),
    ('明', 1368, [('洪武', 1368, 1398), ('建文', 1399, 1402), ('永乐', 1403, 1424), ('洪熙', 1425, 1425),
                 ('宣德', 1426, 1435), ('正统', 1436, 1449), ('景泰', 1450, 1457), ('天顺', 1457, 1464),
                 ('成化', 1465, 1487), ('弘治', 1488, 1505), ('正德', 1506, 1521), ('嘉靖', 1522, 1566),
                 ('隆庆', 1567, 1572), ('万历', 1573, 1620), ('泰昌', 1620, 1620), ('天启', 1621, 1627),
                 ('崇祯', 1628, 1644)]),
    ('清', 1644, [('顺治', 1644, 1661), ('康熙', 1662, 1722), ('雍正', 1723, 1735), ('乾隆', 1736, 1795),
                 ('嘉庆', 1796, 1820), ('道光', 1821, 1850), ('咸丰', 1851, 1861), ('同治', 1862, 1874),
                 ('光绪', 1875, 1908), ('宣统', 1909, 1911)]),
]
CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']


def cn_small(n):
    """1—49 的中文数。"""
    if n <= 10:
        return CN[n]
    tens, ones = divmod(n, 10)
    t = {1: '十', 2: '二十', 3: '三十', 4: '四十'}.get(tens)
    if t is None:
        return str(n)
    return t + (CN[ones] if ones else '')


def era_of(year):
    for dyn, lo, eras in ERAS:
        if lo <= year <= eras[-1][2]:
            for name, s, e in eras:
                if s <= year <= e:
                    off = year - s + 1
                    if off == 1:
                        return '%s%s元年' % (dyn, name)
                    return '%s%s%s年' % (dyn, name, cn_small(off))
    return str(year) + '年'


def cn_gen(g):
    d = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
    if g <= 10:
        return '第%s世' % d[g - 1]
    if g < 20:
        return '第十%s世' % d[g - 10]
    if g == 20:
        return '第二十世'
    if g < 30:
        return '第二十%s世' % d[g - 20]
    return '第三十世'


# ---------------------------------------------------------------- 1. 各世人口
def make_sizes():
    raw = [1.0]
    f = 1.30
    for g in range(2, GENS + 1):
        f = min(1.42, max(1.22, f * random.uniform(0.985, 1.015)))
        raw.append(raw[-1] * f)
    s = sum(raw)
    sizes = [max(1, int(round(x * TOTAL / s))) for x in raw]
    sizes[0] = 1
    drift = TOTAL - sum(sizes)
    sizes[-1] += drift  # 余数放进末世
    assert sum(sizes) == TOTAL
    assert all(x >= 1 for x in sizes)
    return sizes


# ---------------------------------------------------------------- 2. 成员生成
used_names = set()


def gen_name(g, idx):
    """王 + 本世辈分字 + 辅字，必要时三字名去重。"""
    for _ in range(60):
        name = '王' + BEIPO[g - 1] + random.choice(SECOND)
        if name not in used_names:
            used_names.add(name)
            return name
    for _ in range(60):
        name = '王' + BEIPO[g - 1] + random.choice(SECOND) + random.choice(SECOND)
        if name not in used_names:
            used_names.add(name)
            return name
    name = '王' + BEIPO[g - 1] + random.choice(SECOND) + str(idx)
    used_names.add(name)
    return name


def gen_zi(g, idx):
    if random.random() < 0.45:
        return ''
    for _ in range(20):
        zi = random.choice(['伯', '仲', '叔', '季', '元', '公', '君', '子']) + random.choice(SECOND)
        return zi
    return ''


def gen_spouse():
    if random.random() < 0.08:
        return ''
    return random.choice(FEMALE_SUR) + '氏'


def gen_intro(g, has_gong):
    parts = []
    if has_gong and random.random() < 0.5:
        parts.append(random.choice(GONGMING))
    parts.append(random.choice(YE))
    s = '，'.join(parts) + '。'
    r = random.random()
    if r < 0.45:
        s += random.choice(SHAN) + '，' + random.choice(PIN) + '。'
    elif r < 0.75:
        s += random.choice(SHAN) + '。'
    else:
        s += random.choice(PIN) + '。'
    return s[:110]


def make_members(sizes):
    """返回 members 列表：dict(id,name,...,birth_year,father_id)"""
    members = []
    # 第一世（始迁祖，单传开基）
    m1 = dict(id=1, name='王德明', zi='启蒙', hao='', gen=1,
              birth_year=GEN1_BIRTH, death_year=GEN1_BIRTH + 52,
              father_id=None, spouse='赵氏',
              intro='王氏始迁祖。唐末自太原府避乱南迁，卜居桐川之阳，垦荒拓田，遂家焉。为人敦厚，乡里称长者。')
    members.append(m1)
    prev_gen = [m1]
    nid = 2
    for g in range(2, GENS + 1):
        quota = sizes[g - 1]
        # 分配孩子到上一世各人（0—6 人），先生育后再补足配额
        ks = [0] * len(prev_gen)
        for i in range(len(prev_gen)):
            r = random.random()
            ks[i] = 1 if r < 0.9 else 0
        total = sum(ks)
        # 修正到 quota
        guard = 0
        while total != quota and guard < quota * 30:
            guard += 1
            i = random.randrange(len(prev_gen))
            if total < quota and ks[i] < 6:
                ks[i] += 1
                total += 1
            elif total > quota and ks[i] > 0:
                ks[i] -= 1
                total -= 1
        cur_gen = []
        for i, father in enumerate(prev_gen):
            for _ in range(ks[i]):
                by = father['birth_year'] + random.randint(GAP_MIN, GAP_MAX)
                name = gen_name(g, nid)
                has_gong = random.random() < 0.25
                m = dict(id=nid, name=name, zi=gen_zi(g, nid),
                         hao=(random.choice(HAO) if random.random() < 0.14 else ''),
                         gen=g, birth_year=by,
                         death_year=min(1911, by + random.randint(30, 88)),
                         father_id=father['id'], spouse=gen_spouse(),
                         intro=gen_intro(g, has_gong))
                members.append(m)
                cur_gen.append(m)
                nid += 1
        if not cur_gen:  # 极端兜底：保证不断线
            father = random.choice(prev_gen)
            by = father['birth_year'] + random.randint(GAP_MIN, GAP_MAX)
            m = dict(id=nid, name=gen_name(g, nid), zi='', hao='', gen=g, birth_year=by,
                     death_year=min(1911, by + 60), father_id=father['id'],
                     spouse=gen_spouse(), intro='嗣续一线，克承家业。')
            members.append(m)
            cur_gen.append(m)
            nid += 1
        prev_gen = cur_gen
    return members


# ---------------------------------------------------------------- 3. 卷册谱页
FRONT = [
    ('卷一 · 谱序图考', 'essay', ['重修宗谱序', '旧谱原序', '凡例', '谱例', '源流考', '得姓考',
                                 '迁徙考', '家训', '族规', '祭田记', '艺文志', '领谱字号']),
    ('卷二 · 世系图', 'chart', ['总世系图（一）', '总世系图（二）', '总世系图（三）', '总世系图（四）',
                                '总世系图（五）', '总世系图（六）', '总世系图（七）', '总世系图（八）']),
]
ZHI_VOLS = ['卷三 · 齿录（一）', '卷四 · 齿录（二）', '卷五 · 齿录（三）', '卷六 · 齿录（四）',
            '卷七 · 齿录（五）', '卷八 · 齿录（六）', '卷九 · 齿录（七）', '卷十 · 齿录（八）',
            '卷十一 · 齿录（九）', '卷十二 · 齿录（十）']


def make_pages(members):
    """所有成员按（世代,生年）分卷分页，每页 2—4 人；另造 120 页「待录入真值」。"""
    vols, pages, links = [], [], []
    page_no = 0

    def new_vol(title, kind):
        vid = len(vols) + 1
        vols.append(dict(id=vid, title=title, kind=kind, seq=vid))
        return vid

    def new_page(vid, title):
        nonlocal page_no
        page_no += 1
        pages.append(dict(page_no=page_no, volume_id=vid, title=title))
        return page_no

    for title, kind, ptitles in FRONT:
        vid = new_vol(title, kind)
        for t in ptitles:
            new_page(vid, t)

    # 齿录：按世代顺序切块，均匀分布到 10 卷
    ordered = sorted(members, key=lambda m: (m['gen'], m['birth_year'], m['id']))
    per_vol = max(1, int(len(ordered) / 2.8 / len(ZHI_VOLS)) + 1)
    vi = 0
    vid, count_in_vol = None, 0
    i = 0
    while i < len(ordered):
        if vid is None or count_in_vol >= per_vol:
            vid = new_vol(ZHI_VOLS[vi], 'zhilu')
            count_in_vol = 0
            vi += 1
        n = random.choice([2, 2, 3, 3, 3, 4])
        chunk = ordered[i:i + n]
        pn = new_page(vid, cn_gen(chunk[0]['gen']) + '齿录')
        for m in chunk:
            links.append((m['id'], pn))
        count_in_vol += 1
        i += len(chunk)

    # 待录入「真值」页：散布在齿录卷中（旧谱有而系统未录入，供 OCR 识别演示）
    truth_pages = []
    for k in range(120):
        vid = random.randint(3, len(vols))
        pn = new_page(vid, '待整理残页')
        truth_pages.append((vid, pn))
    return vols, pages, links, truth_pages


def make_truth(truth_pages):
    """生成待录入真值记录（1—3 条/页），字段与正式族人一致，但不入 members 表。"""
    truths = []
    for vid, pn in truth_pages:
        for seq in range(random.choice([1, 2, 2, 3])):
            g = random.randint(4, GENS - 1)
            by = GEN1_BIRTH + (g - 1) * random.randint(24, 32)
            name = '王' + BEIPO[g - 1] + random.choice(SECOND)
            truths.append(dict(page_id=pn, seq=seq, name=name,
                               zi=(random.choice(['伯', '仲', '叔', '季']) + random.choice(SECOND) if random.random() < 0.6 else ''),
                               gen=g, birth=era_of(by), death=era_of(by + random.randint(35, 85)),
                               father_name=('王' + BEIPO[g - 2] + random.choice(SECOND)),
                               spouse=(random.choice(FEMALE_SUR) + '氏'),
                               intro=random.choice(YE) + '。' + random.choice(SHAN) + '。'))
    return truths


# ---------------------------------------------------------------- 主流程
def main():
    t0 = time.time()
    sizes = make_sizes()
    members = make_members(sizes)
    assert len(members) == TOTAL, '成员数 %d != %d' % (len(members), TOTAL)
    vols, pages, links, truth_pages = make_pages(members)
    truths = make_truth(truth_pages)

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript('''
    CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, pwd_hash TEXT, salt TEXT, created_at TEXT);
    CREATE TABLE sessions(token TEXT PRIMARY KEY, user_id INTEGER, created_at TEXT);
    CREATE TABLE members(
        id INTEGER PRIMARY KEY, name TEXT NOT NULL, zi TEXT DEFAULT '', hao TEXT DEFAULT '',
        gen INTEGER NOT NULL, birth TEXT DEFAULT '', death TEXT DEFAULT '',
        birth_year INTEGER, death_year INTEGER, father_id INTEGER, spouse TEXT DEFAULT '',
        intro TEXT DEFAULT '', created_at TEXT, updated_at TEXT);
    CREATE INDEX idx_members_gen ON members(gen);
    CREATE INDEX idx_members_father ON members(father_id);
    CREATE INDEX idx_members_name ON members(name);
    CREATE TABLE volumes(id INTEGER PRIMARY KEY, title TEXT, kind TEXT, seq INTEGER);
    CREATE TABLE pages(id INTEGER PRIMARY KEY AUTOINCREMENT, page_no INTEGER UNIQUE,
                       volume_id INTEGER, title TEXT, photo_path TEXT DEFAULT '', photo_at TEXT);
    CREATE INDEX idx_pages_vol ON pages(volume_id);
    CREATE TABLE member_pages(member_id INTEGER, page_id INTEGER, PRIMARY KEY(member_id, page_id));
    CREATE INDEX idx_mp_page ON member_pages(page_id);
    CREATE TABLE truth_records(id INTEGER PRIMARY KEY AUTOINCREMENT, page_id INTEGER, seq INTEGER,
        name TEXT, zi TEXT, gen INTEGER, birth TEXT, death TEXT, father_name TEXT,
        spouse TEXT, intro TEXT);
    CREATE INDEX idx_truth_page ON truth_records(page_id);
    CREATE TABLE requests(id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, target_id INTEGER,
        content TEXT, applicant TEXT, evidence TEXT DEFAULT '', payload TEXT DEFAULT '{}',
        status TEXT DEFAULT 'pending', result TEXT DEFAULT '', created_at TEXT, handled_at TEXT);
    CREATE TABLE notices(id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, date TEXT);
    CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
    ''')

    # 管理员
    salt = 'gz2026'
    c.execute('INSERT INTO users(username,pwd_hash,salt,created_at) VALUES(?,?,?,?)',
              ('admin', hashlib.sha256((salt + 'admin123').encode()).hexdigest(), salt, time.strftime('%Y-%m-%d %H:%M:%S')))

    # 成员
    now = time.strftime('%Y-%m-%d %H:%M:%S')
    c.executemany(
        'INSERT INTO members(id,name,zi,hao,gen,birth,death,birth_year,death_year,father_id,spouse,intro,created_at,updated_at)'
        ' VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [(m['id'], m['name'], m['zi'], m['hao'], m['gen'],
          era_of(m['birth_year']), (era_of(m['death_year']) if m['death_year'] else ''),
          m['birth_year'], m['death_year'], m['father_id'], m['spouse'], m['intro'], now, now)
         for m in members])

    # 卷、页、关联
    c.executemany('INSERT INTO volumes(id,title,kind,seq) VALUES(?,?,?,?)',
                  [(v['id'], v['title'], v['kind'], v['seq']) for v in vols])
    c.executemany('INSERT INTO pages(page_no,volume_id,title) VALUES(?,?,?)',
                  [(p['page_no'], p['volume_id'], p['title']) for p in pages])
    c.executemany('INSERT OR IGNORE INTO member_pages(member_id,page_id) VALUES(?,?)', links)
    c.executemany(
        'INSERT INTO truth_records(page_id,seq,name,zi,gen,birth,death,father_name,spouse,intro)'
        ' VALUES(?,?,?,?,?,?,?,?,?,?)',
        [(t['page_id'], t['seq'], t['name'], t['zi'], t['gen'], t['birth'], t['death'],
          t['father_name'], t['spouse'], t['intro']) for t in truths])

    # 变更申请样例
    tgt = next((m for m in members if m['name'] == '王承志'), members[7])
    tb = c.execute('SELECT birth FROM members WHERE id=?', (tgt['id'],)).fetchone()[0]
    p1 = json.dumps({'member_id': tgt['id'], 'field': 'birth', 'value': (tb or '') + '正月初九'}, ensure_ascii=False)
    p2 = json.dumps({'member_id': members[9]['id'], 'field': 'intro', 'value': members[9]['intro']}, ensure_ascii=False)
    p3 = json.dumps({'member_id': members[10]['id'], 'field': 'intro', 'value': ''}, ensure_ascii=False)
    # r2：拟新增族人（可生效的完整数据）
    add_member = {'name': '王承学', 'zi': '好古', 'hao': '', 'gen': max(2, tgt['gen']),
                  'birth': era_of(872 + tgt['gen'] * 30), 'death': era_of(872 + tgt['gen'] * 30 + 62),
                  'father_id': tgt['father_id'], 'spouse': '徐氏',
                  'intro': '业儒。隐居不仕，以诗酒自娱，工书法，邑人称之。'}
    p_add = json.dumps({'member': add_member}, ensure_ascii=False)
    # r3：纠正关联（目标是存在的另一页）
    tgt_page = conn_row = c.execute(
        'SELECT p.page_no FROM member_pages mp JOIN pages p ON p.id=mp.page_id'
        ' WHERE mp.member_id=? ORDER BY p.page_no LIMIT 1', (tgt['id'],)).fetchone()
    to_page = (tgt_page[0] % 7161) + 1 if tgt_page else 2
    p_fix = json.dumps({'member_id': tgt['id'], 'to_page': to_page}, ensure_ascii=False)
    samples = [
        ('修改信息', tgt['id'], '老谱残页记载此公生于正月初九，请补入生辰。', '王克明 · 后裔', '老谱残页照片', p1, 'pending'),
        ('新增族人', None, '支谱尚载漏录族人一名，申请补录。', '王建国 · 本族', '支谱抄本照片', p_add, 'pending'),
        ('纠正关联', tgt['id'], '该公齿录条目实在下一页，请更正关联。', '王丽华 · 谱学爱好者', '', p_fix, 'pending'),
        ('修改信息', members[9]['id'], '府志载其职官为教授而非训导。', '王守拙', '府志影印件', p2, 'approved'),
        ('修改信息', members[10]['id'], '（示例）所引资料与原谱不符，应驳回。', '匿名访客', '', p3, 'rejected'),
    ]
    c.executemany(
        'INSERT INTO requests(type,target_id,content,applicant,evidence,payload,status,created_at,result,handled_at)'
        ' VALUES(?,?,?,?,?,?,?,?,?,?)',
        [(s[0], s[1], s[2], s[3], s[4], s[5], s[6], '2026-10-2%d' % (1 + i % 8),
          ('已通过，2026-10-15 生效' if s[6] == 'approved' else ('驳回：所引资料与原谱不符' if s[6] == 'rejected' else '')),
          ('2026-10-15 09:30:00' if s[6] != 'pending' else None)) for i, s in enumerate(samples)])

    c.executemany('INSERT INTO notices(content,date) VALUES(?,?)', [
        ('秋祭大典定于十月初三日上午在王氏宗祠举行，请族人准时参加。', '2026-10-18'),
        ('卷十二尚有部分残页未录入关联，欢迎族人提供辨识帮助。', '2026-10-12'),
    ])
    gen_counts = [sum(1 for m in members if m['gen'] == g) for g in range(1, GENS + 1)]
    c.executemany('INSERT INTO meta(key,value) VALUES(?,?)', [
        ('schema_version', '1'), ('generated_at', now),
        ('gen_counts', json.dumps(gen_counts)),
        ('purpose', '30 代 %d 人演示数据，随机种子 20261025，可重复生成' % TOTAL),
    ])
    conn.commit()

    # ------------------------------------------------ 自检
    print('== 演示数据生成完成（%.1fs）==' % (time.time() - t0))
    print('族人: %d（要求 %d）' % (len(members), TOTAL))
    print('世代: %d，各世人口: %s' % (GENS, gen_counts))
    print('卷册: %d，谱页: %d，真值页: %d，真值记录: %d' % (len(vols), len(pages), len(truth_pages), len(truths)))
    linked = conn.execute('SELECT COUNT(*) FROM member_pages').fetchone()[0]
    print('成员-页面关联: %d' % linked)

    # 1) 父亲存在且世代正确
    bad = conn.execute(
        'SELECT COUNT(*) FROM members m WHERE m.father_id IS NOT NULL AND ('
        ' NOT EXISTS(SELECT 1 FROM members f WHERE f.id=m.father_id)'
        ' OR (SELECT f.gen FROM members f WHERE f.id=m.father_id) != m.gen-1)').fetchone()[0]
    assert bad == 0, '父子世代关系异常 %d 条' % bad
    # 2) 无环：向上追溯不超过 GENS 步
    cur = conn.execute('SELECT id, father_id FROM members')
    fmap = {r[0]: r[1] for r in cur}
    for mid in list(fmap)[:2000] + random.sample(list(fmap), 500):
        x, depth = mid, 0
        while fmap.get(x) and depth <= GENS + 2:
            x = fmap[x]
            depth += 1
        assert depth <= GENS, '疑似环: id=%d' % mid
    # 3) 每位族人恰好关联一个齿录页
    missing = conn.execute(
        'SELECT COUNT(*) FROM members m WHERE NOT EXISTS('
        ' SELECT 1 FROM member_pages mp JOIN pages p ON p.id=mp.page_id'
        ' JOIN volumes v ON v.id=p.volume_id WHERE mp.member_id=m.id AND v.kind="zhilu")').fetchone()[0]
    assert missing == 0, '未关联齿录页的族人 %d' % missing
    multi = conn.execute(
        'SELECT COUNT(*) FROM (SELECT member_id FROM member_pages GROUP BY member_id HAVING COUNT(*)>1)'
    ).fetchone()[0]
    print('自检: 父子世代✓ 无环✓ 齿录页关联唯一✓ 多页关联记录 %d 条' % multi)
    conn.close()
    print('数据库: %s' % DB_PATH)


if __name__ == '__main__':
    main()
