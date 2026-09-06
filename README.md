# myDashboard

แดชบอร์ดรวม Gmail + Google Calendar + Slack + Discord + GitHub สำหรับดูภาพรวมงานประจำวัน — ดึงข้อมูลสดทุกครั้งที่เปิด

หน้าเดียวกันรันได้สองแบบ: เป็นเว็บที่มี backend ของตัวเอง (standalone) หรือเป็น artifact ใน Claude Cowork

## เริ่มใช้

```bash
npm install
cp .env.example .env    # เติมค่า — ดูขั้นตอนใน SETUP.md
npm start
```

เปิด http://localhost:3000 แล้วกด **เชื่อม Gmail** ครั้งแรกครั้งเดียว (ปุ่มเดียวขอสิทธิ์ Gmail กับปฏิทินพร้อมกัน)

ขั้นตอนขอ credential จาก Google, Slack และ GitHub อยู่ใน **[SETUP.md](SETUP.md)**

## โครงสร้าง

```
myDashboard/
├── public/index.html       ตัวแดชบอร์ด — HTML ไฟล์เดียว ไม่มี build step
├── server/
│   ├── index.js            express routes + cache 60 วิ
│   ├── google.js           OAuth2 flow + เก็บ/รีเฟรช token.json
│   ├── gmail.js            summary() / inbox()
│   ├── slack.js            dms() / feed()
│   ├── discord.js          feed() — REST API ด้วย bot token
│   └── github.js           overview() — GraphQL
└── SETUP.md                ขั้นตอนเซ็ตอัปทีละขั้น
```

## หน้าตา

**ภาพรวม** — KPI 3 ตัว (Inbox ค้าง, Slack ถึงคุณ, ยังไม่ได้อ่าน) + สรุปสำคัญของแต่ละหัวข้อ พร้อมนัดที่จะถึงและกราฟช่อง Slack ที่คึกคัก

**กล่องจดหมาย** — อีเมลที่ค้างใน Inbox และจำนวนในแต่ละกล่อง

**ปฏิทิน** — ตารางรายเดือนจากทุกปฏิทินที่เปิดแสดงอยู่ใน Google Calendar เดินหน้าถอยหลังทีละเดือนได้ คลิกวันเพื่อดูรายละเอียดนัดของวันนั้น คลิกนัดเพื่อแก้ และมีปุ่มเพิ่ม/ลบ — **เขียนกลับเข้า Google Calendar จริง** ปฏิทินที่แชร์มาแบบอ่านอย่างเดียวจะไม่มีปุ่มแก้/ลบ

**Slack** — DM ที่ถึงคุณ (จัดกลุ่มตามคนส่ง) และความเคลื่อนไหวในช่องที่คุณอยู่ 7 วันล่าสุด (จัดกลุ่มตามช่อง) แต่ละกลุ่มเรียงตามความคึกคัก โชว์ข้อความล่าสุดไม่กี่อันแล้วกางเพิ่มได้ สีหัวกลุ่มตรงกับสีในกราฟ — ต่อได้มากกว่า 1 workspace พร้อมกัน (ดู `SLACK_USER_TOKENS` ใน SETUP.md)

**Discord** — ความเคลื่อนไหวในห้องที่ตั้งไว้ 7 วันล่าสุด จัดกลุ่มตามห้องเหมือนแท็บ Slack **ไม่มี DM** เพราะบอทเป็นบัญชีแยกจากคุณ อ่านข้อความส่วนตัวไม่ได้ตามข้อจำกัดของ Discord

**GitHub** — ปฏิทิน contribution ย้อนหลัง 1 ปีแบบเดียวกับหน้าโปรไฟล์ GitHub และคอมมิทล่าสุดจาก repo ที่ push ล่าสุด **รวมคอมมิทของคนอื่นในโปรเจกต์ที่ทำร่วมกัน** แต่ละแถวบอกว่าใครเขียน คอมมิทของเจ้าของ token จะมีป้าย "คุณ" กำกับ

**เชื่อมต่ออื่น ๆ** — สถานะการเชื่อมต่อจริง (`/api/status`), ปุ่มเชื่อม/ยกเลิก Gmail, และปุ่ม **"ส่งสรุปเข้า LINE ตอนนี้"** — รวม Inbox ค้าง/นัดวันนี้/Slack ที่ถึงคุณ เป็นข้อความสั้น ๆ push เข้า LINE ของตัวเอง (กดเองเท่านั้น ยังไม่มีตั้งเวลาส่งอัตโนมัติ)

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
| `src.slack()` | `GET /api/slack` | `slack_search_public_and_private` + `parseSlack()` |
| `src.discord()` | `GET /api/discord` | ไม่รองรับ — artifact เรียก Discord bot token ตรงไม่ได้ |
| `src.github()` | `GET /api/github` | ไม่รองรับ — ไม่มี MCP connector ของ GitHub |
| `src.calendar(เดือน)` | `GET /api/calendar?month=` | ไม่รองรับ — artifact เรียก Calendar API ตรงไม่ได้ |
| `src.calCreate/calUpdate/calDelete()` | `POST`/`PATCH`/`DELETE /api/calendar` | ไม่รองรับ |

### โหมด standalone

express ใน `server/` เรียก Gmail API, Slack Web API และ Discord REST API ตรง ๆ

| Route | คืนอะไร |
|---|---|
| `GET /api/status` | `{gmail, calendar, slack, github, discord, line}` — ทั้งหมดเป็น bool |
| `GET /api/mail/summary` | `{inbox, unread, trash, labels: [{name, threads, messages, unread, color}]}` |
| `GET /api/mail/inbox` | `[{name, domain, subject, date, unread, isLinkedIn}]` |
| `GET /api/slack` | `{dms: [], feed: []}` — แต่ละตัว `{chan, isDm, author, text, ts}` |
| `GET /api/discord` | `[{chan, isDm: false, author, text, ts}]` — ข้อความจากห้องใน `DISCORD_CHANNEL_IDS` |
| `POST /api/line/digest` | รวม Inbox/นัดวันนี้/Slack เป็นข้อความ แล้ว push เข้า `LINE_USER_ID` — คืน `{ok: true}` |
| `GET /api/github` | `{login, total, weeks, commits}` — `weeks` คือปฏิทิน, `commits[].mine` บอกว่าเป็นคอมมิทของเจ้าของ token ไหม |
| `GET /api/calendar?month=YYYY-MM` | `{month, tz, calendars, events}` — `events[]` คือ `{id, calendarId, calendar, color, title, allDay, start, end, location, description, url, meet, guests, recurring, canWrite}` |
| `POST /api/calendar` | เพิ่มนัด — body `{calendarId, title, allDay, start, end, location, description}` |
| `PATCH /api/calendar` | แก้นัด — body เหมือน POST + `eventId` |
| `DELETE /api/calendar` | ลบนัด — body `{calendarId, eventId}` |
| `GET /auth/google` | redirect ไปหน้า consent |
| `GET /auth/google/callback` | แลก code เก็บลง `token.json` |
| `POST /auth/google/logout` | ลบ `token.json` |

- Gmail ขอ scope `gmail.readonly` อย่างเดียว — dashboard ไม่แก้อะไรในกล่องจดหมาย
- ปฏิทินขอ `calendar.events` (เขียนได้เฉพาะตัวนัด) + `calendar.readonly` (ไว้ดึงรายชื่อและสีของปฏิทิน) — ไม่ขอ scope `calendar` เต็ม จึงสร้าง/ลบ "ปฏิทิน" ทั้งอันไม่ได้ แก้ได้แค่ "นัด"
- นัดที่ทำซ้ำถูกกางด้วย `singleEvents: true` ทำให้แก้/ลบมีผลเฉพาะครั้งนั้น ไม่ลามทั้งชุด
- วันสุดท้ายของนัดแบบทั้งวัน: Google เก็บ `end` แบบ**ไม่รวม**วันสุดท้าย แต่ API ของเราคืน/รับเป็นวันที่นับจริง (`server/calendar.js` บวกลบ 1 วันให้ตรงกลาง)
- ถ้ายังไม่ได้ authorize route ของ Gmail จะคืน `{error, authUrl}` แทนที่จะพัง หน้าเว็บจะขึ้นปุ่มเชื่อมให้
- Slack ตั้งใจไม่ใช้ `search.messages` เพราะ modifier อย่าง `to:me` เชื่อถือไม่ได้กับ raw API — ใช้ `conversations.list` + `conversations.history` แทน
- GitHub ใช้ **GraphQL** ไม่ใช่ REST เพราะ contribution calendar ไม่มี endpoint ใน REST เลย ดึงปฏิทินกับคอมมิทมาในคิวรีเดียว
- Discord ใช้ **bot token** ไม่ใช่ user token — บอทเป็นบัญชีแยกจากคุณ อ่านได้แค่ห้องที่เชิญเข้าไป (`DISCORD_CHANNEL_IDS`) อ่าน DM ส่วนตัวไม่ได้เลย ต่างจาก Slack ที่ใช้ user token แทนตัวคุณเอง
- ผลลัพธ์ cache ในหน่วยความจำ 60 วินาทีต่อ key

### โหมด Cowork

เรียก MCP tool ผ่าน `window.cowork.callMcpTool()` ซึ่งมีให้ใช้เฉพาะตอนรันเป็น artifact ใน Claude

Server ID ของ connector ไม่ได้ฝังไว้ในไฟล์ (จะได้ไม่ติดขึ้น git) แต่อ่านจาก `localStorage` ตั้งครั้งเดียวที่ console ของเบราว์เซอร์

```js
localStorage.setItem('mbx.cowork', JSON.stringify({
  gmail: 'mcp__<id ของคุณ>__', slack: 'mcp__<id ของคุณ>__'
}))
```

ID จะเปลี่ยนทุกครั้งที่ reconnect connector — ตั้งใหม่เมื่อแท็บขึ้นว่ายังไม่ได้ตั้ง

## กล่องอีเมล

แท็บ "กล่องจดหมาย" อ่าน label ทั้งหมดจากบัญชีคุณเองตอนรัน แล้วแสดงเฉพาะกล่องที่มีอีเมลอยู่ เรียงตามจำนวนเธรด — ไม่มีรายชื่อกล่องฝังไว้ในโค้ด ใครเอาไปใช้ก็เห็นกล่องของตัวเอง

สีของแถบข้างกล่องมาจากสีที่ตั้งไว้ใน Gmail (`color.backgroundColor`) ถ้ากล่องไหนไม่ได้ตั้งสี จะไล่สีจาน `PAL` ให้แทน

## ข้อจำกัดที่รู้อยู่

- `/api/slack` ยิง `conversations.history` ทีละห้อง จำกัดไว้ 25 ห้อง — โหลดรอบแรกช้า รอบต่อไปเข้า cache
- OAuth consent screen สถานะ Testing จะทำให้ refresh token หมดอายุใน 7 วัน ต้อง authorize ใหม่ (กด Publish app ถ้าอยากใช้ยาว ๆ)
- โหมด Cowork ไม่มีแท็บ GitHub, ปฏิทิน และ Discord เพราะเรียก API พวกนี้ตรงจาก artifact ไม่ได้
- Discord ไม่มี DM เพราะบอทอ่านข้อความส่วนตัวของคุณไม่ได้ — ถ้าอยากเห็น DM ต้องใช้ user token ซึ่งขัด Discord ToS จึงไม่ทำ
- Discord ดึงข้อความล่าสุด 50 ข้อความต่อห้อง (ข้อจำกัดของ endpoint) แล้วกรองเฉพาะ 7 วันล่าสุด — ห้องที่คึกคักมากอาจเห็นไม่ครบ 7 วัน
- ปฏิทินดึงเฉพาะอันที่ **เปิดแสดงอยู่** ใน Google Calendar (`selected`) ถ้านัดบางอันไม่โผล่ ให้ไปติ๊กเปิดปฏิทินนั้นในเว็บ Google Calendar ก่อน
- ตารางเดือนโชว์ได้ 3 นัดต่อช่อง ที่เหลือขึ้นเป็น "+ อีก n" — คลิกวันนั้นเพื่อดูครบในการ์ดข้างล่าง
- เวลาที่พิมพ์ตอนสร้างนัดถือเป็นเวลาของ `CALENDAR_TZ` (ค่าเริ่มต้น `Asia/Bangkok`) ถ้าใช้คนละโซนกับเบราว์เซอร์ เวลาจะเพี้ยน
- ย้ายนัดข้ามปฏิทินไม่ได้ (ต้องใช้ `events.move`) — ช่องเลือกปฏิทินจึงถูกล็อกตอนแก้
- โหมด Cowork: ผลลัพธ์จาก Slack เป็น markdown ไม่ใช่ JSON จึงต้อง parse ด้วย regex — ถ้าฝั่ง Slack เปลี่ยนรูปแบบ output จะพัง (โหมด standalone ไม่มีปัญหานี้ เพราะอ่าน JSON ตรง ๆ)

## ความปลอดภัย

**แดชบอร์ดนี้ไม่มีระบบ login** — ใครเปิดหน้านี้ได้ ก็อ่านอีเมลกับ Slack ของเจ้าของได้ทันที และตั้งแต่มีแท็บปฏิทิน ยังเพิ่ม/ลบนัดในปฏิทินได้ด้วย ทุกอย่างข้างล่างสร้างบนสมมติฐานว่ามันรันอยู่บนเครื่องคุณเครื่องเดียว

| มาตรการ | อยู่ที่ไหน |
|---|---|
| ผูกกับ loopback อย่างเดียว เครื่องอื่นในวง LAN เข้าไม่ถึง | `HOST` default `127.0.0.1` ใน `server/index.js` |
| `state` กัน CSRF บน OAuth callback | `server/index.js` + `consentUrl(state)` |
| `token.json` เขียนด้วยสิทธิ์ `0600` | `writeToken()` ใน `server/google.js` |
| กรอง token/secret ออกจาก error ที่ส่งให้ browser (ตัวเต็มไปอยู่ใน log ฝั่ง server) | `safe()` ใน `server/index.js` |
| Gmail ขอแค่ `gmail.readonly` ปฏิทินขอแค่ `calendar.events` + `calendar.readonly` | `SCOPES` ใน `server/google.js` |
| ปฏิเสธ POST/PATCH/DELETE ที่มี `Origin` เป็นโดเมนอื่น — กันเว็บที่เปิดอยู่ยิงคำสั่งมาที่ localhost แทนเจ้าตัว | middleware ใน `server/index.js` |
| GitHub token ขอแค่ `read:user` (+ `repo` ถ้าอยากเห็น private) | ตั้งตอนสร้าง token |

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
- GitHub personal access token เพิกถอนได้ที่ https://github.com/settings/tokens
- `token.json` มี refresh token ของ Google — เพิกถอนได้ที่ https://myaccount.google.com/permissions หรือลบไฟล์ทิ้ง (ปุ่ม "ยกเลิกการเชื่อม" ในแท็บเชื่อมต่อ)
- ถ้าเผลอ commit ความลับขึ้นไปแล้ว **เพิกถอนตัวจริงก่อน** แล้วค่อยล้างประวัติ — การลบ commit ไม่ได้ทำให้ token ที่หลุดไปแล้วใช้ไม่ได้
