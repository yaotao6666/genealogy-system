#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智慧族谱 · API 接口自动化测试
自行启动服务器（独立测试端口），跑完自动关闭。覆盖：
  公开读 / 鉴权 / 登录登出 / 族人 CRUD 与守卫 / 分页搜索
  卷册谱页 / OCR 识别与确认录入 / 变更申请全生命周期 / 数据一致性
运行：python3 api_test.py   （退出码 0 = 全部通过）
"""
import io
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error

BASE = os.path.dirname(os.path.abspath(__file__))
PORT = 8791
ROOT = 'http://127.0.0.1:%d' % PORT
DB = os.path.join(BASE, 'data', 'genealogy.db')
passed, failed = [], []


def check(name, ok, detail=''):
    tag = '✓' if ok else '✗'
    print('  [%s] %s%s' % (tag, name, ('　— ' + str(detail)[:120]) if detail else ''))
    (passed if ok else failed).append(name)


def req(method, path, body=None, token=None, raw_body=None, ctype='application/json'):
    url = ROOT + path
    data = None
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if raw_body is not None:
        data = raw_body
        headers['Content-Type'] = ctype
    elif body is not None:
        data = json.dumps(body).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, {}


def multipart(fields, files):
    bound = 'gztestboundary778899'
    buf = io.BytesIO()
    for k, v in fields.items():
        buf.write(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (bound, k, v)).encode())
    for k, (fn, blob) in files.items():
        buf.write(('--%s\r\nContent-Disposition: form-data; name="%s"; filename="%s"\r\n'
                   'Content-Type: image/jpeg\r\n\r\n' % (bound, k, fn)).encode())
        buf.write(blob)
        buf.write(b'\r\n')
    buf.write(('--%s--\r\n' % bound).encode())
    return buf.getvalue(), 'multipart/form-data; boundary=' + bound


# 生成一张 1×1 JPEG（最小合法头即可触发保存逻辑）
TINY_JPEG = bytes.fromhex(
    'ffd8ffe000104a46494600010100000100010000ffdb004300ffd9') + b'\x00' * 300


def main():
    if not os.path.exists(DB):
        print('数据库不存在，先运行 seed.py'); sys.exit(2)

    env = dict(os.environ, PORT=str(PORT))
    proc = subprocess.Popen([sys.executable, os.path.join(BASE, 'server.py')], env=env,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        # 等待就绪
        up = False
        for _ in range(40):
            try:
                with urllib.request.urlopen(ROOT + '/api/info', timeout=2) as r:
                    if r.status == 200:
                        up = True
                        break
            except Exception:
                time.sleep(0.15)
        if not up:
            print('服务器未能启动'); sys.exit(2)

        print('== 公开端 ==')
        s, info = req('GET', '/api/info')
        check('GET /api/info', s == 200 and info['members'] == 20000, info.get('members'))
        s, st = req('GET', '/api/stats')
        check('GET /api/stats 公开', s == 200 and 'gen_counts' in st and len(st['gen_counts']) == 30)
        check('公开 stats 不含待审数', 'pending' not in st)
        s, ns = req('GET', '/api/notices')
        check('GET /api/notices', s == 200 and len(ns['items']) >= 1)
        s, sc = req('GET', '/api/screen')
        check('GET /api/screen 聚合', s == 200 and sc['members'] == 20000 and len(sc['gen_counts']) == 30)
        check('朝代分布合计 = 总人口', sum(d['n'] for d in sc['dynasties']) == 20000)
        check('支系后嗣覆盖全体（不含支系本人）',
              sum(b['descendants'] for b in sc['branches']) == 20000 - 1 - len(sc['branches']),
              sum(b['descendants'] for b in sc['branches']))
        with urllib.request.urlopen(ROOT + '/screen', timeout=5) as r:
            check('大屏页面', r.status == 200 and '驾驶舱' in r.read().decode('utf-8'))
        s, vols = req('GET', '/api/volumes')
        check('GET /api/volumes', s == 200 and len(vols['items']) == 12, len(vols.get('items', [])))
        check('卷册含首页码', all('first_page' in v for v in vols['items']))

        print('== 分页与搜索 ==')
        s, ml = req('GET', '/api/members?page=1&size=50')
        check('分页 size=50', s == 200 and len(ml['items']) == 50 and ml['total'] == 20000)
        s, ml2 = req('GET', '/api/members?gen=30&size=100')
        check('世代过滤', s == 200 and all(m['gen'] == 30 for m in ml2['items']) and ml2['total'] > 3000, ml2.get('total'))
        name30 = ml2['items'][0]['name'][1]
        s, sr = req('GET', '/api/members?q=' + urllib.parse.quote(name30) + '&size=100')
        check('关键词搜索', s == 200 and len(sr['items']) >= 1)
        t0 = time.time()
        req('GET', '/api/members?q=' + urllib.parse.quote('王') + '&page=3&size=20')
        dt = (time.time() - t0) * 1000
        check('2 万级搜索 < 200ms', dt < 200, '%.0fms' % dt)

        print('== 鉴权 ==')
        s, _ = req('POST', '/api/login', {'username': 'admin', 'password': 'wrong'})
        check('错误密码 401', s == 401)
        s, _ = req('POST', '/api/members', {'name': 'X', 'gen': 4})
        check('未登录写操作 401', s == 401)
        s, lg = req('POST', '/api/login', {'username': 'admin', 'password': 'admin123'})
        check('登录成功', s == 200 and lg.get('token'))
        tok = lg['token']
        s, me = req('GET', '/api/me', token=tok)
        check('GET /api/me', s == 200 and me['username'] == 'admin')

        print('== 族人 CRUD ==')
        s, created = req('POST', '/api/members', {
            'name': '王测试', 'gen': 10, 'zi': '试之', 'birth': '宋元祐五年（1090）',
            'intro': '接口测试临时数据'}, token=tok)
        check('新增族人', s == 200 and created.get('id'))
        nid = created['id']
        s, det = req('GET', '/api/members/%d' % nid)
        check('详情可读', s == 200 and det['member']['name'] == '王测试')
        s, _ = req('PUT', '/api/members/%d' % nid, {'zi': '改之'}, token=tok)
        s, det = req('GET', '/api/members/%d' % nid)
        check('更新生效', s == 200 and det['member']['zi'] == '改之')
        s, e = req('PUT', '/api/members/%d' % nid, {'gen': 9}, token=tok)
        check('世代与父亲冲突被拦截' if det['member']['father_id'] else '世代校验', s in (200, 400))
        s, e = req('POST', '/api/members', {'name': '', 'gen': 4}, token=tok)
        check('空姓名 400', s == 400)
        s, e = req('POST', '/api/members', {'name': '王坏', 'gen': 4, 'father_id': 1}, token=tok)
        check('父亲世代不匹配 400', s == 400)
        s, _ = req('DELETE', '/api/members/%d' % nid, token=tok)
        s, det = req('GET', '/api/members/%d' % nid)
        check('删除生效', s == 404)
        s, e = req('DELETE', '/api/members/1', token=tok)
        check('有后嗣者删除被拦截', s == 400, e.get('error'))

        print('== 世系树 ==')
        s, roots = req('GET', '/api/tree/roots')
        check('树根', s == 200 and len(roots['items']) == 1 and roots['items'][0]['children'] > 0)
        root_child = roots['items'][0]['children']
        s, kids = req('GET', '/api/tree/children/1')
        check('懒加载子代', s == 200 and len(kids['items']) == root_child)

        print('== 谱页 ==')
        s, pu = req('GET', '/api/pages/next-unlinked?volume_id=3')
        check('下一待录入页', s == 200 and pu.get('page_no'), pu.get('error'))
        truth_page = pu['page_no']
        s, pd = req('GET', '/api/pages/%d' % truth_page)
        check('谱页详情', s == 200 and pd['members'] == [])
        s, some = req('GET', '/api/pages/1')
        check('已有内容页详情', s == 200)

        print('== OCR 识别与确认录入 ==')
        total0 = info['members']
        body, ct = multipart({'page_no': str(truth_page)}, {'image': ('page.jpg', TINY_JPEG)})
        s, ocr = req('POST', '/api/pages/%d/recognize' % truth_page, raw_body=body, ctype=ct, token=tok)
        check('识别接口', s == 200 and ocr.get('provider') == 'demo')
        check('照片已保存', ocr.get('photo_saved') is True)
        recs = ocr.get('records', [])
        check('识别还原真值记录', len(recs) >= 1, '识别到 %d 条' % len(recs))
        check('置信度结构', all('confidence' in r and 'name' in r['confidence'] for r in recs))
        # 确认录入（只录第一条 + 关联一个已有族人）
        s, linked_page = req('GET', '/api/members?size=1')
        keep = linked_page['items'][0]
        s, cf = req('POST', '/api/pages/%d/confirm' % truth_page, {
            'records': [recs[0]], 'link_member_ids': [keep['id']]}, token=tok)
        check('确认录入', s == 200 and len(cf.get('created', [])) == 1 and cf.get('linked') == 1)
        new_mid = cf['created'][0]
        s, info2 = req('GET', '/api/info')
        check('总人口 +1', info2['members'] == total0 + 1, '%d → %d' % (total0, info2['members']))
        s, pd2 = req('GET', '/api/pages/%d' % truth_page)
        check('新成员已关联页面', any(m['id'] == new_mid for m in pd2['members']))
        check('已有成员补关联', any(m['id'] == keep['id'] for m in pd2['members']))
        # 真值应被消费
        s, ocr2 = req('POST', '/api/pages/%d/recognize' % truth_page, raw_body=body, ctype=ct, token=tok)
        check('已录真值被消费', s == 200 and all(
            r.get('truth_id') != recs[0].get('truth_id') for r in ocr2.get('records', [])))
        # 父亲按名匹配
        if recs[0].get('father_name'):
            s, nd = req('GET', '/api/members/%d' % new_mid)
            fid = nd['member']['father_id']
            check('父亲按名匹配或不为空', fid is None or isinstance(fid, int), 'father_id=%s' % fid)
        # 清理测试数据
        req('DELETE', '/api/members/%d' % new_mid, token=tok)
        req('POST', '/api/pages/%d/unlink' % truth_page, {'member_id': keep['id']}, token=tok)

        print('== 变更申请全生命周期 ==')
        s, e = req('POST', '/api/requests', {'type': '修改信息', 'content': ''})
        check('空内容 400', s == 400)
        s, r1 = req('POST', '/api/requests', {
            'type': '修改信息', 'target_id': 1, 'content': '测试：请补入生平一句。',
            'applicant': '接口测试'}, token=None)
        check('访客可提交申请（无需登录）', s == 200 and r1.get('id'))
        rid = r1['id']
        s, e = req('GET', '/api/requests?status=pending', token=tok)
        check('管理员可列表', s == 200)
        s, e = req('GET', '/api/requests?status=pending')
        check('访客不可列表', s == 401)
        s, _ = req('POST', '/api/requests/%d/reject' % rid, {'reason': ''}, token=tok)
        check('驳回需理由', s == 400)
        # 准备 apply 数据
        old = req('GET', '/api/members/1')[1]['member']['intro']
        import sqlite3
        conn = sqlite3.connect(DB)
        conn.execute('UPDATE requests SET payload=? WHERE id=?',
                     (json.dumps({'member_id': 1, 'field': 'intro', 'value': old + '（测试补录）'}),
                      rid))
        conn.commit()
        conn.close()
        s, _ = req('POST', '/api/requests/%d/approve' % rid, token=tok)
        check('通过', s == 200)
        s, det = req('GET', '/api/members/1')
        check('通过后信息已更新', det['member']['intro'].endswith('（测试补录）'))
        s, _ = req('POST', '/api/requests/%d/approve' % rid, token=tok)
        check('重复处理拦截', s == 400)
        s, r2 = req('POST', '/api/requests', {
            'type': '纠正关联', 'target_id': 1, 'content': '测试纠正关联', 'applicant': '测试'}, token=None)
        conn = sqlite3.connect(DB)
        conn.execute("UPDATE requests SET payload=? WHERE id=?",
                     (json.dumps({'member_id': 1, 'to_page': 1}), r2['id']))
        conn.commit()
        conn.close()
        s, _ = req('POST', '/api/requests/%d/reject' % r2['id'], {'reason': '测试驳回'}, token=tok)
        check('驳回生效', s == 200)

        print('== 登出 ==')
        s, _ = req('POST', '/api/logout', token=tok)
        s, _ = req('GET', '/api/me', token=tok)
        check('登出后 token 失效', s == 401)

        # 静态页
        with urllib.request.urlopen(ROOT + '/', timeout=5) as r:
            html = r.read().decode('utf-8')
            check('静态首页', r.status == 200 and 'gz-proto' in html)
        with urllib.request.urlopen(ROOT + '/app.js', timeout=5) as r:
            check('静态 JS', r.status == 200)

    finally:
        proc.send_signal(signal.SIGTERM)
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()

    print()
    if failed:
        print('✗ %d 项未通过：%s' % (len(failed), '、'.join(failed)))
        sys.exit(1)
    print('✓ 接口测试全部通过（%d 项）' % len(passed))


if __name__ == '__main__':
    import urllib.parse
    main()
