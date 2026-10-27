#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智慧族谱 · 数据完整性校验（独立脚本，可反复执行）
校验项：
  A. 规模     世代数、总人口、各世非负
  B. 树结构   父亲存在、世代递增、无环、连通（无孤儿）
  C. 时间     生年<卒年、父子生年间隔合理、年份落在支持区间
  D. 页面     谱页页码连续唯一、每位族人至少关联一页、关联均指向存在页面
  E. 真值     真值记录指向存在页面、世代合法
  F. 业务     管理员账号存在、申请样例状态合法、公告存在
运行：python3 verify_data.py   （退出码 0 = 全部通过）
"""
import json
import os
import sqlite3
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, 'data', 'genealogy.db')
GENS, TOTAL = 30, 20000
fails = []


def check(name, ok, detail=''):
    tag = '✓' if ok else '✗'
    print('  [%s] %s%s' % (tag, name, ('　— ' + detail) if detail else ''))
    if not ok:
        fails.append(name)


if not os.path.exists(DB_PATH):
    print('数据库不存在，请先运行 seed.py')
    sys.exit(2)

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print('== A. 规模 ==')
gens = c.execute('SELECT COUNT(DISTINCT gen) n FROM members').fetchone()['n']
total = c.execute('SELECT COUNT(*) n FROM members').fetchone()['n']
check('世代数 = %d' % GENS, gens == GENS, '实际 %d' % gens)
check('总人口 = %d' % TOTAL, total == TOTAL, '实际 %d' % total)
neg = c.execute('SELECT COUNT(*) AS n FROM (SELECT gen, COUNT(*) n FROM members GROUP BY gen HAVING n<1)').fetchone()['n']
check('各世人口非空', neg == 0)
grow_ok = True
counts = [r['n'] for r in c.execute('SELECT gen, COUNT(*) n FROM members GROUP BY gen ORDER BY gen')]
for a, b in zip(counts, counts[1:]):
    if b < a * 0.5:  # 允许个别世代波动，但不允许腰斩
        grow_ok = False
check('人口曲线无明显断层', grow_ok, ' / '.join(map(str, counts[:6])) + ' …')

print('== B. 树结构 ==')
bad_father = c.execute(
    'SELECT COUNT(*) AS n FROM members m WHERE m.father_id IS NOT NULL AND ('
    ' NOT EXISTS(SELECT 1 FROM members f WHERE f.id=m.father_id)'
    ' OR (SELECT f.gen FROM members f WHERE f.id=m.father_id) != m.gen-1)').fetchone()['n']
check('父亲存在且世代恰为上一世', bad_father == 0, '异常 %d 条' % bad_father)
orphans = c.execute(
    'SELECT COUNT(*) AS n FROM members m WHERE m.gen>1 AND m.father_id IS NULL').fetchone()['n']
check('无孤儿（首世以外均有父亲）', orphans == 0, '孤儿 %d' % orphans)
fmap = {r['id']: r['father_id'] for r in c.execute('SELECT id, father_id FROM members')}
cycle = 0
for mid in fmap:
    x, depth = mid, 0
    while fmap.get(x) is not None and depth <= GENS + 2:
        x = fmap[x]
        depth += 1
    if depth > GENS:
        cycle += 1
        break
check('无环（抽样全量向上追溯 ≤ %d 步）' % GENS, cycle == 0)
one_root = c.execute('SELECT COUNT(*) AS n FROM members WHERE gen=1').fetchone()['n']
check('第一世为唯一始祖', one_root == 1, '首世 %d 人' % one_root)

print('== C. 时间 ==')
bad_year = c.execute(
    'SELECT COUNT(*) AS n FROM members WHERE birth_year IS NULL OR death_year IS NULL'
    ' OR death_year <= birth_year OR birth_year < 700 OR death_year > 1912').fetchone()['n']
check('生年 < 卒年 且落在 700—1912', bad_year == 0, '异常 %d' % bad_year)
bad_gap = c.execute(
    'SELECT COUNT(*) AS n FROM members m JOIN members f ON f.id=m.father_id'
    ' WHERE m.birth_year - f.birth_year NOT BETWEEN 15 AND 50').fetchone()['n']
check('父子生年间隔 15—50 年', bad_gap == 0, '异常 %d' % bad_gap)
empty_birth = c.execute("SELECT COUNT(*) AS n FROM members WHERE birth=''").fetchone()['n']
check('生卒文本均已格式化', empty_birth == 0, '缺生年文本 %d' % empty_birth)

print('== D. 页面 ==')
pgmax = c.execute('SELECT MAX(page_no) AS a, COUNT(*) AS b, COUNT(DISTINCT page_no) d FROM pages').fetchone()
check('页码 1..%d 连续且唯一' % pgmax['a'], pgmax['a'] == pgmax['b'] == pgmax['d'],
      '最大 %d / 行 %d / 去重 %d' % (pgmax['a'], pgmax['b'], pgmax['d']))
nolink = c.execute(
    'SELECT COUNT(*) AS n FROM members m WHERE NOT EXISTS('
    ' SELECT 1 FROM member_pages mp WHERE mp.member_id=m.id)').fetchone()['n']
check('每位族人至少关联一页', nolink == 0, '未关联 %d' % nolink)
badlink = c.execute(
    'SELECT COUNT(*) AS n FROM member_pages mp WHERE NOT EXISTS('
    ' SELECT 1 FROM members m WHERE m.id=mp.member_id) OR NOT EXISTS('
    ' SELECT 1 FROM pages p WHERE p.id=mp.page_id)').fetchone()['n']
check('关联表无悬挂引用', badlink == 0, '悬挂 %d' % badlink)
vols = c.execute('SELECT COUNT(*) AS n FROM volumes').fetchone()['n']
check('卷册存在', vols >= 10, '%d 卷' % vols)

print('== E. 真值（OCR 待录入） ==')
bad_truth_page = c.execute(
    'SELECT COUNT(*) AS n FROM truth_records t WHERE NOT EXISTS('
    ' SELECT 1 FROM pages p WHERE p.id=t.page_id)').fetchone()['n']
check('真值记录均指向存在的谱页', bad_truth_page == 0, '异常 %d' % bad_truth_page)
bad_truth_gen = c.execute(
    'SELECT COUNT(*) AS n FROM truth_records WHERE gen<2 OR gen>%d OR name=""' % GENS).fetchone()['n']
check('真值世代与姓名合法', bad_truth_gen == 0, '异常 %d' % bad_truth_gen)
n_truth = c.execute('SELECT COUNT(*) AS n FROM truth_records').fetchone()['n']
check('存在可供 OCR 演示的真值记录', n_truth > 50, '%d 条' % n_truth)
truth_pages_linked = c.execute(
    'SELECT COUNT(*) AS n FROM (SELECT DISTINCT t.page_id FROM truth_records t'
    ' JOIN member_pages mp ON mp.page_id=t.page_id)').fetchone()['n']
check('真值页与已录入页不重叠', truth_pages_linked == 0, '重叠 %d 页' % truth_pages_linked)

print('== F. 业务 ==')
admin = c.execute('SELECT COUNT(*) AS n FROM users WHERE username="admin"').fetchone()['n']
check('管理员账号存在', admin == 1)
bad_req = c.execute(
    "SELECT COUNT(*) AS n FROM requests WHERE status NOT IN ('pending','approved','rejected')").fetchone()['n']
check('申请状态合法', bad_req == 0)
pend = c.execute("SELECT COUNT(*) AS n FROM requests WHERE status='pending'").fetchone()['n']
check('存在待审申请（演示用）', pend >= 3, '%d 条' % pend)
notices = c.execute('SELECT COUNT(*) AS n FROM notices').fetchone()['n']
check('公告存在', notices >= 1, '%d 条' % notices)

conn.close()
print()
if fails:
    print('✗ 校验未通过：%s' % '、'.join(fails))
    sys.exit(1)
print('✓ 全部 %d 组校验通过' % 6)
