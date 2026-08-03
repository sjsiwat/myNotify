# myDashboard

แดชบอร์ดรวม Gmail + Slack สำหรับดูภาพรวมงานประจำวัน — ดึงข้อมูลสดทุกครั้งที่เปิด

หน้าเดียวกันรันได้สองแบบ: เป็นเว็บที่มี backend ของตัวเอง (standalone) หรือเป็น artifact ใน Claude Cowork

## เริ่มใช้

```bash
npm install
cp .env.example .env    # เติมค่า — ดูขั้นตอนใน SETUP.md
npm start
```

เปิด http://localhost:3000 แล้วกด **เชื่อม Gmail** ครั้งแรกครั้งเดียว

ขั้นตอนขอ credential จาก Google กับ Slack อยู่ใน **[SETUP.md](SETUP.md)**

## โครงสร้าง

```
myDashboard/
├── public/index.html       ตัวแดชบอร์ด — HTML ไฟล์เดียว ไม่มี build step
├── server/
│   ├── index.js            express routes + cache 60 วิ
│   ├── google.js           OAuth2 flow + เก็บ/รีเฟรช token.json
│   ├── gmail.js            summary() / inbox() / spend()
│   └── slack.js            dms() / feed()
└── SETUP.md                ขั้นตอนเซ็ตอัปทีละขั้น
```

## หน้าตา

**ภาพรวม** — KPI 4 ตัว (Inbox ค้าง, Slack ถึงคุณ, รายจ่าย USD, ยังไม่ได้อ่าน) + สรุปสำคัญของแต่ละหัวข้อ พร้อมกราฟรายจ่ายรายเดือนและกราฟช่อง Slack ที่คึกคัก

**กล่องจดหมาย** — อีเมลที่ค้างใน Inbox และจำนวนในแต่ละกล่อง

**รายจ่าย** — อ่านยอดจากเนื้อความใบเสร็จโดยตรง แยก USD / THB พร้อมกราฟรายเดือน

**Slack** — DM ที่ถึงคุณ และความเคลื่อนไหวในช่องที่คุณอยู่ 7 วันล่าสุด

**เชื่อมต่ออื่น ๆ** — สถานะการเชื่อมต่อจริง (`/api/status`) และปุ่มเชื่อม/ยกเลิก Gmail

## ทำงานยังไง

`public/index.html` ตรวจตอนโหลดว่ารันอยู่ที่ไหน แล้วเลือก adapter ให้เอง

```js
const HAS_COWORK = typeof window.cowork?.callMcpTool === 'function';
const src = HAS_COWORK ? coworkSource : httpSource;
```

adapter สองตัวคืน shape เดียวกัน ชั้น render จึงไม่รู้จักโหมด

| ข้อมูล | โหมด standalone | โหมด Cowork |
|---|---|---|
| `src.summary()` | `GET /api/mail/summary` | `list_labels` แล้ว normalize |
| `src.inbox()` | `GET /api/mail/inbox` | `search_threads` + map |
| `src.spend()` | `GET /api/spend` | `search_threads` + `get_thread` วนลูป + `extractAmount()` |
| `src.slack()` | `GET /api/slack` | `slack_search_public_and_private` + `parseSlack()` |

### โหมด standalone

express ใน `server/` เรียก Gmail API และ Slack Web API ตรง ๆ

| Route | คืนอะไร |
|---|---|
| `GET /api/status` | `{gmail: bool, slack: bool}` |
| `GET /api/mail/summary` | `{inbox, unread, trash, labels: [{name, threads, messages, unread, color}]}` |
| `GET /api/mail/inbox` | `[{name, domain, subject, date, unread, isLinkedIn}]` |
| `GET /api/spend` | `{bills: [{name, domain, subject, date, cur, val}], scanned}` |
| `GET /api/slack` | `{dms: [], feed: []}` — แต่ละตัว `{chan, isDm, author, text, ts}` |
| `GET /auth/google` | redirect ไปหน้า consent |
| `GET /auth/google/callback` | แลก code เก็บลง `token.json` |
| `POST /auth/google/logout` | ลบ `token.json` |

- Gmail ขอ scope `gmail.readonly` อย่างเดียว — dashboard ไม่แก้อะไรในกล่องจดหมาย
- ถ้ายังไม่ได้ authorize route ของ Gmail จะคืน `{error, authUrl}` แทนที่จะพัง หน้าเว็บจะขึ้นปุ่มเชื่อมให้
- Slack ตั้งใจไม่ใช้ `search.messages` เพราะ modifier อย่าง `to:me` เชื่อถือไม่ได้กับ raw API — ใช้ `conversations.list` + `conversations.history` แทน
- ผลลัพธ์ cache ในหน่วยความจำ 60 วินาทีต่อ key

### โหมด Cowork

เรียก MCP tool ผ่าน `window.cowork.callMcpTool()` ซึ่งมีให้ใช้เฉพาะตอนรันเป็น artifact ใน Claude

> Server ID ของ connector ฝังอยู่ในตัวแปร `GM` และ `SL` ใน `public/index.html` — ถ้าเชื่อม connector ใหม่หรือย้ายเครื่อง ID จะเปลี่ยน ต้องแก้สองบรรทัดนั้น

## กล่องอีเมล

แท็บ "กล่องจดหมาย" อ่าน label ทั้งหมดจากบัญชีคุณเองตอนรัน แล้วแสดงเฉพาะกล่องที่มีอีเมลอยู่ เรียงตามจำนวนเธรด — ไม่มีรายชื่อกล่องฝังไว้ในโค้ด ใครเอาไปใช้ก็เห็นกล่องของตัวเอง

สีของแถบข้างกล่องมาจากสีที่ตั้งไว้ใน Gmail (`color.backgroundColor`) ถ้ากล่องไหนไม่ได้ตั้งสี จะไล่สีจาน `PAL` ให้แทน

## ข้อจำกัดที่รู้อยู่

- การอ่านยอดเงินใช้วิธีหยิบตัวเลขที่มากที่สุดในบิล (สมมติว่าคือยอดรวม) — บิลรูปแบบแปลก ๆ อาจอ่านผิด ถ้าอยากแม่นต้องเขียน parser แยกต่อผู้ให้บริการ
- ตรวจใบเสร็จแค่ 12 ฉบับล่าสุด เพื่อไม่ให้โหลดช้า
- `/api/slack` ยิง `conversations.history` ทีละห้อง จำกัดไว้ 25 ห้อง — โหลดรอบแรกช้า รอบต่อไปเข้า cache
- OAuth consent screen สถานะ Testing จะทำให้ refresh token หมดอายุใน 7 วัน ต้อง authorize ใหม่ (กด Publish app ถ้าอยากใช้ยาว ๆ)
- โหมด Cowork: ผลลัพธ์จาก Slack เป็น markdown ไม่ใช่ JSON จึงต้อง parse ด้วย regex — ถ้าฝั่ง Slack เปลี่ยนรูปแบบ output จะพัง (โหมด standalone ไม่มีปัญหานี้ เพราะอ่าน JSON ตรง ๆ)

## ความปลอดภัย

**แดชบอร์ดนี้ไม่มีระบบ login** — ใครเปิดหน้านี้ได้ ก็อ่านอีเมลและ Slack ของเจ้าของได้ทันที ทุกอย่างข้างล่างสร้างบนสมมติฐานว่ามันรันอยู่บนเครื่องคุณเครื่องเดียว

| มาตรการ | อยู่ที่ไหน |
|---|---|
| ผูกกับ loopback อย่างเดียว เครื่องอื่นในวง LAN เข้าไม่ถึง | `HOST` default `127.0.0.1` ใน `server/index.js` |
| `state` กัน CSRF บน OAuth callback | `server/index.js` + `consentUrl(state)` |
| `token.json` เขียนด้วยสิทธิ์ `0600` | `writeToken()` ใน `server/google.js` |
| กรอง token/secret ออกจาก error ที่ส่งให้ browser (ตัวเต็มไปอยู่ใน log ฝั่ง server) | `safe()` ใน `server/index.js` |
| Gmail ขอแค่ `gmail.readonly` | `SCOPES` ใน `server/google.js` |

**สิ่งที่ห้ามขึ้น git** — `.gitignore` กันไว้แล้ว แต่เช็ค `git status` ก่อน push ทุกครั้ง

```
.env  .env.*  token.json  *.pem  *.key  credentials*.json  client_secret*.json
```

**หลังสร้าง `.env`** ปิดสิทธิ์ให้เจ้าของอ่านคนเดียว

```bash
chmod 600 .env
```

**ข้อควรรู้เรื่อง token**

- Slack user token (`xoxp-`) อ่านได้ทุกอย่างที่บัญชีคุณอ่านได้ **รวม DM ทั้งหมด** — หลุดเมื่อไหร่คือหลุดหมด เพิกถอนได้ที่หน้า OAuth & Permissions ของแอป
- `token.json` มี refresh token ของ Google — เพิกถอนได้ที่ https://myaccount.google.com/permissions หรือลบไฟล์ทิ้ง (ปุ่ม "ยกเลิกการเชื่อม" ในแท็บเชื่อมต่อ)
- ถ้าเผลอ commit ความลับขึ้นไปแล้ว **เพิกถอนตัวจริงก่อน** แล้วค่อยล้างประวัติ — การลบ commit ไม่ได้ทำให้ token ที่หลุดไปแล้วใช้ไม่ได้
