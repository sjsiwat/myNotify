# myDashboard

แดชบอร์ดส่วนตัว รวมทุกอย่างที่ต้องเช็คทุกวันไว้หน้าเดียว: Gmail, Google Calendar, Slack, Discord และ GitHub — เปิดมาก็เห็นภาพรวม ไม่ต้องสลับแอปไปมา

ข้อมูลทั้งหมดดึงสดจากบัญชีจริงของคุณทุกครั้งที่เปิดหน้า ไม่มีฐานข้อมูลเก็บสำเนาไว้ที่ไหน

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env    # เติมค่า credential ต่าง ๆ — ดูขั้นตอนละเอียดใน SETUP.md
npm start
```

เปิด http://localhost:3000 แล้วกด **เชื่อม Gmail** ครั้งแรกครั้งเดียว (ปุ่มเดียวขอสิทธิ์ทั้ง Gmail และ Calendar พร้อมกัน) ที่เหลือ (Slack, Discord, GitHub, LINE, Login) เป็นของเสริม เชื่อมเพิ่มได้ทีหลังเมื่อไหร่ก็ได้

ทุกฟีเจอร์ **เปิด/ปิดเองอัตโนมัติตามค่าที่ตั้งใน `.env`** — ไม่ตั้งค่าของอันไหน แท็บนั้นก็แค่ไม่โชว์ ไม่มีอะไรพัง

วิธีขอ credential จาก Google / Slack / Discord / GitHub / LINE ทีละขั้นตอน อยู่ใน **[SETUP.md](SETUP.md)**

## แต่ละแท็บมีอะไรบ้าง

- **ภาพรวม** — สรุปตัวเลขสำคัญ (อีเมลค้าง, ข้อความ Slack ถึงคุณ, นัดวันนี้) พร้อมรายการที่ต้องตามอ่าน
- **กล่องจดหมาย** — อีเมลที่ค้างใน Inbox แยกตามป้ายกำกับ กดอ่าน/ลบได้จากในหน้าเว็บเลย
- **ปฏิทิน** — ตารางรายเดือนจากทุกปฏิทินที่เปิดอยู่ใน Google Calendar ดู/เพิ่ม/แก้/ลบนัดได้ — **แก้จริง สะท้อนกลับเข้า Google Calendar ทันที**
- **Slack** — DM ที่ถึงคุณและความเคลื่อนไหวในช่องที่คุณอยู่ ต่อได้มากกว่า 1 workspace พร้อมกัน
- **Discord** — ความเคลื่อนไหวในห้องที่เลือกไว้ (ไม่รองรับ DM เพราะข้อจำกัดของ Discord — ดูหัวข้อข้อจำกัดด้านล่าง)
- **GitHub** — ปฏิทิน contribution แบบเดียวกับหน้าโปรไฟล์ GitHub และคอมมิทล่าสุด
- **เชื่อมต่ออื่น ๆ** — ดูว่าอะไรเชื่อมอยู่บ้าง เชื่อม/ยกเลิก Gmail และปุ่ม "ส่งสรุปเข้า LINE" (สรุปงานวันนี้แบบสั้น ๆ push เข้า LINE ตัวเอง)

## การเข้าสู่ระบบ (สำหรับ deploy ให้คนอื่นเข้าถึง URL ได้)

ปกติแดชบอร์ดนี้**ไม่มีระบบ login** เพราะออกแบบมาให้รันบนเครื่องตัวเองคนเดียว แต่ถ้าจะ deploy ขึ้นโดเมนสาธารณะ (เช่น `notify.siwat.me`) ต้องกันไม่ให้คนอื่นเข้ามาเห็นอีเมล/แชทของคุณ

ตั้งค่า 2 ตัวนี้ใน `.env` เพื่อเปิดระบบ login:

```
ALLOWED_EMAIL=your@email.com
SESSION_SECRET=<สุ่มด้วยคำสั่งใน SETUP.md>
```

ตั้งแล้ว ทุกหน้า/ทุก API จะต้อง **login ด้วย Google ก่อน และต้องเป็นอีเมลนั้นเท่านั้นถึงจะเข้าได้** — นี่เป็น OAuth คนละตัวกับที่ใช้อ่าน Gmail (ขอแค่สิทธิ์รู้อีเมล ไม่แตะข้อมูลอะไรเลย) ไม่ตั้งค่าไว้ = แอปเปิดให้เข้าได้เหมือนเดิม

ขั้นตอนตั้งค่าเต็ม ๆ (Google Cloud Console, redirect URI) อยู่ใน **[SETUP.md §6](SETUP.md)**

## โครงสร้างโปรเจกต์

```
myDashboard/
├── public/
│   ├── index.html           ตัวแดชบอร์ด — HTML ไฟล์เดียว ไม่มี build step
│   └── login.html           หน้า login (โชว์เฉพาะตอนเปิดฟีเจอร์ login)
├── server/
│   ├── index.js             express routes + cache 60 วิ
│   ├── google.js            OAuth2 flow (Gmail/Calendar) + เก็บ/รีเฟรช token.json
│   ├── auth.js              OAuth2 flow แยกต่างหากสำหรับ login เข้าเว็บ
│   ├── gmail.js             summary() / inbox()
│   ├── calendar.js          month() + สร้าง/แก้/ลบนัด
│   ├── slack.js             dms() / feed()
│   ├── discord.js           feed() — REST API ด้วย bot token
│   ├── github.js            overview() — GraphQL
│   └── line.js              digest() — สรุปงานส่งเข้า LINE
└── SETUP.md                 ขั้นตอนเซ็ตอัปทีละขั้น
```

## ทำงานยังไง (สำหรับคนอยากอ่านโค้ดต่อ)

`public/index.html` ตรวจตอนโหลดว่ารันอยู่ที่ไหน แล้วเลือก adapter ให้เอง — รันเป็นเว็บที่มี backend ของตัวเอง (standalone) หรือรันเป็น artifact ใน Claude Cowork ก็ได้ ชั้น render ไม่รู้ความต่างระหว่างสองโหมดนี้เลย เพราะ adapter ทั้งคู่คืนข้อมูลรูปแบบเดียวกัน

```js
const HAS_COWORK = typeof window.cowork?.callMcpTool === 'function';
const src = HAS_COWORK ? coworkSource : httpSource;
```

| ข้อมูล | โหมด standalone | โหมด Cowork |
|---|---|---|
| `src.summary()` | `GET /api/mail/summary` | `list_labels` แล้ว normalize |
| `src.inbox()` | `GET /api/mail/inbox` | `search_threads` + map |
| `src.slack()` | `GET /api/slack` | `slack_search_public_and_private` + `parseSlack()` |
| `src.discord()` | `GET /api/discord` | ไม่รองรับ — artifact เรียก Discord bot token ตรงไม่ได้ |
| `src.github()` | `GET /api/github` | ไม่รองรับ — ไม่มี MCP connector ของ GitHub |
| `src.calendar(เดือน)` | `GET /api/calendar?month=` | ไม่รองรับ — artifact เรียก Calendar API ตรงไม่ได้ |
| `src.calCreate/calUpdate/calDelete()` | `POST`/`PATCH`/`DELETE /api/calendar` | ไม่รองรับ |

### API ทั้งหมด (โหมด standalone)

| Route | คืนอะไร |
|---|---|
| `GET /api/status` | `{gmail, gmailWrite, calendar, slack, github, discord, line, loginEnabled}` — ทั้งหมดเป็น bool |
| `GET /api/mail/summary` | `{inbox, unread, trash, labels: [{name, threads, messages, unread, color}]}` |
| `GET /api/mail/inbox` | `[{name, domain, subject, date, unread, isLinkedIn}]` |
| `GET /api/mail/message/:id` | เนื้อหาอีเมลฉบับเต็ม |
| `POST /api/mail/read` | mark เป็นอ่านแล้ว — body `{id}` |
| `POST /api/mail/trash` | ย้ายเข้าถังขยะ — body `{id}` |
| `GET /api/slack` | `{dms: [], feed: []}` — แต่ละตัว `{chan, isDm, author, text, ts}` |
| `GET /api/discord` | `[{chan, isDm: false, author, text, ts}]` — ข้อความจากห้องใน `DISCORD_CHANNEL_IDS` |
| `GET /api/github` | `{login, total, weeks, commits}` — `weeks` คือปฏิทิน, `commits[].mine` บอกว่าเป็นคอมมิทของเจ้าของ token ไหม |
| `GET /api/calendar?month=YYYY-MM` | `{month, tz, calendars, events}` |
| `POST /api/calendar` | เพิ่มนัด — body `{calendarId, title, allDay, start, end, location, description}` |
| `PATCH /api/calendar` | แก้นัด — body เหมือน POST + `eventId` |
| `DELETE /api/calendar` | ลบนัด — body `{calendarId, eventId}` |
| `POST /api/line/digest` | รวม Inbox/นัดวันนี้/Slack เป็นข้อความ push เข้า `LINE_USER_ID` |
| `GET /auth/google` | redirect ไปหน้า consent (Gmail/Calendar) |
| `GET /auth/google/callback` | แลก code เก็บลง `token.json` |
| `POST /auth/google/logout` | ลบ `token.json` |
| `GET /login` | หน้า login (เฉพาะตอนตั้ง `ALLOWED_EMAIL`/`SESSION_SECRET`) |
| `GET /auth/site/login` | redirect ไปหน้า Google consent ของระบบ login เว็บ |
| `GET /auth/site/callback` | เช็คอีเมลตรงกับ `ALLOWED_EMAIL` แล้วออกคุกกี้ session |
| `POST /auth/site/logout` | ลบคุกกี้ session |

รายละเอียดปลีกย่อยเชิงเทคนิค (scope ที่ขอ, ทำไมเลือก GraphQL/REST, cache, ฯลฯ) — ดูคอมเมนต์ในซอร์สโค้ดแต่ละไฟล์ เขียนอธิบายไว้ตรงจุดที่ตัดสินใจ

### โหมด Cowork

เรียก MCP tool ผ่าน `window.cowork.callMcpTool()` ซึ่งมีให้ใช้เฉพาะตอนรันเป็น artifact ใน Claude

Server ID ของ connector ไม่ได้ฝังไว้ในไฟล์ (จะได้ไม่ติดขึ้น git) แต่อ่านจาก `localStorage` ตั้งครั้งเดียวที่ console ของเบราว์เซอร์:

```js
localStorage.setItem('mbx.cowork', JSON.stringify({
  gmail: 'mcp__<id ของคุณ>__', slack: 'mcp__<id ของคุณ>__'
}))
```

ID จะเปลี่ยนทุกครั้งที่ reconnect connector — ตั้งใหม่เมื่อแท็บขึ้นว่ายังไม่ได้ตั้ง

## ข้อจำกัดที่ควรรู้

- **1 เจ้าของต่อ 1 instance** — ไม่ใช่ระบบหลายผู้ใช้ ถ้าอยากให้คนอื่นใช้ ต้องแยกรัน instance ของตัวเอง (login ก็รองรับแค่ 1 อีเมลต่อ instance เหมือนกัน)
- Discord ไม่มี DM เพราะบอทเป็นบัญชีแยกจากคุณ อ่านข้อความส่วนตัวไม่ได้ตามข้อจำกัดของ Discord ToS
- Discord/Slack ดึงข้อความย้อนหลังจำกัดจำนวน — ห้อง/DM ที่คึกคักมากอาจเห็นไม่ครบ 7 วัน
- ปฏิทินดึงเฉพาะอันที่ **เปิดแสดงอยู่** ใน Google Calendar ถ้านัดบางอันไม่โผล่ ให้ไปติ๊กเปิดปฏิทินนั้นในเว็บ Google Calendar ก่อน
- OAuth consent screen สถานะ Testing จะทำให้ refresh token หมดอายุใน 7 วัน ต้อง authorize ใหม่ (กด Publish app ถ้าอยากใช้ยาว ๆ)
- โหมด Cowork ไม่มีแท็บ GitHub, ปฏิทิน และ Discord เพราะเรียก API พวกนี้ตรงจาก artifact ไม่ได้

## ความปลอดภัย

**โดย default แดชบอร์ดนี้ไม่มีระบบ login** — ใครเปิดหน้านี้ได้ก็อ่านอีเมลกับ Slack ของเจ้าของได้ทันที และแก้/ลบนัดในปฏิทินได้ด้วย ออกแบบมาให้รันบนเครื่องตัวเองคนเดียวเท่านั้น (ถ้าจะ deploy ให้คนอื่นเข้าถึงได้ ต้องเปิดฟีเจอร์ Login ก่อน — ดูหัวข้อด้านบน)

| มาตรการ | อยู่ที่ไหน |
|---|---|
| ผูกกับ loopback อย่างเดียว เครื่องอื่นในวง LAN เข้าไม่ถึง (ค่า default) | `HOST` default `127.0.0.1` ใน `server/index.js` |
| `state` กัน CSRF บน OAuth callback | `server/index.js` |
| `token.json` เขียนด้วยสิทธิ์ `0600` | `writeToken()` ใน `server/google.js` |
| กรอง token/secret ออกจาก error ที่ส่งให้ browser | `safe()` ใน `server/index.js` |
| Gmail/Calendar ขอสิทธิ์เท่าที่จำเป็นเท่านั้น ไม่ขอสิทธิ์เต็ม | `SCOPES` ใน `server/google.js` |
| ปฏิเสธคำสั่งที่มาจากโดเมนอื่น กันเว็บที่เปิดอยู่ยิงคำสั่งมาที่ localhost แทนเจ้าตัว | middleware ใน `server/index.js` |
| GitHub token ขอแค่ `read:user` (+ `repo` ถ้าอยากเห็น private) | ตั้งตอนสร้าง token |

**สิ่งที่ห้ามขึ้น git** — `.gitignore` กันไว้แล้ว แต่เช็ค `git status` ก่อน push ทุกครั้ง

```
.env  .env.*  token.json  *.pem  *.key  credentials*.json  client_secret*.json
```

**หลังสร้าง `.env`** ปิดสิทธิ์ให้เจ้าของอ่านคนเดียว:

```bash
chmod 600 .env
```

**ถ้าเผลอทำ token/secret หลุด** เพิกถอนตัวจริงก่อนเสมอ (ที่ต้นทาง เช่น Slack app, GitHub settings, Google account permissions) แล้วค่อยล้างประวัติ git — การลบ commit ไม่ได้ทำให้ token ที่หลุดไปแล้วใช้ไม่ได้
