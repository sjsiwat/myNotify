# SETUP — myDashboard

ขั้นตอนเซ็ตอัปแบบ standalone (รัน backend ของตัวเอง ไม่ต้องพึ่ง Cowork)

ใช้เวลาประมาณ 15–20 นาที ส่วนใหญ่หมดไปกับหน้าเว็บของ Google กับ Slack

---

## 0. เตรียมเครื่อง

ต้องมี Node.js เวอร์ชัน 20 ขึ้นไป

```bash
node -v
```

ถ้าต่ำกว่านั้นให้อัปเดตก่อน (`brew install node` หรือ nvm)

---

## 1. Google Cloud Console — เปิดสิทธิ์อ่าน Gmail

ไปที่ https://console.cloud.google.com

### มี project อยู่แล้วใช่ไหม (เช่นที่ทำไว้ให้ n8n)

ใช้ project เดิมได้ ไม่ต้องสร้างใหม่ — **ข้าม 1.1 ไปได้เลย** ส่วน 1.2 กับ 1.3 แค่เข้าไปเช็คว่าตั้งไว้แล้ว

| ขั้นตอน | ถ้ามี project ที่ต่อ Gmail อยู่แล้ว |
|---|---|
| 1.1 สร้าง project | ข้าม |
| 1.2 เปิด Gmail API | เปิดอยู่แล้ว — เช็คว่าปุ่มขึ้น "Manage" ไม่ใช่ "Enable" |
| 1.3 consent screen | ตั้งแล้ว เช็ค 2 อย่างข้างล่าง |
| 1.4 สร้าง OAuth client ID | **ต้องทำใหม่** |

**ต้องสร้าง OAuth client ตัวใหม่ อย่าไปแก้ของเดิม** — client เดิมผูกกับ redirect URI ของแอปนั้น (n8n ใช้ `https://…/rest/oauth2-credential/callback`) ส่วนเราต้องการ `http://localhost:3000/auth/google/callback`

เพิ่ม URI ที่สองเข้าไปใน client เดิมก็ทำได้ แต่ไม่ควร — วันไหนเพิกถอนหรือหมุน secret ฝั่งหนึ่ง อีกฝั่งพังตาม แยก client ไปเลยสะอาดกว่าและไม่กระทบของเดิม

**เช็ค 2 อย่างในหน้า OAuth consent screen**

1. **Publishing status**
   - *Testing* → ต้องมีอีเมลตัวเองใน Test users และ refresh token จะหมดอายุทุก 7 วัน
   - *In production* → ดีกว่า token ไม่หมดอายุ 7 วัน แค่เจอหน้าเตือน unverified ตอน authorize (กด Advanced ผ่านได้)

   ⚠️ อย่าสลับ status เพื่อโปรเจกต์นี้อย่างเดียว — consent screen ใช้ร่วมกันทั้ง project มีผลกับแอปเดิมด้วย

2. **User Type ต้องเป็น External** — ถ้าเป็น Internal แปลว่า project อยู่ใต้ Workspace org ใช้กับบัญชี `@gmail.com` ไม่ได้ กรณีนี้ต้องสร้าง project ใหม่จริง

**เรื่อง scope ไม่ต้องห่วง** — แอปเดิมอาจขอ `gmail.modify` หรือ full ส่วน dashboard นี้ขอแค่ `gmail.readonly` ขอกันคนละครั้ง เก็บ token คนละที่ (`token.json` ของโปรเจกต์นี้เท่านั้น) ไม่ชนกัน

### 1.1 สร้าง project

มุมซ้ายบนกดชื่อ project → **New Project** → ตั้งชื่ออะไรก็ได้ เช่น `myDashboard` → Create

รอสักครู่แล้วสลับไปใช้ project ที่เพิ่งสร้าง

### 1.2 เปิด Gmail API

**APIs & Services → Library** → ค้นหา `Gmail API` → กด **Enable**

### 1.3 ตั้ง OAuth consent screen

> **Console มีสอง UI** — ถ้าเมนูซ้ายขึ้นว่า *Google Auth Platform* (Overview / Branding / Audience / Clients / Data Access) แปลว่าเป็น UI ใหม่ เนื้อหาเดียวกันแต่แยกหน้า:
>
> | ของเดิม | UI ใหม่ |
> |---|---|
> | OAuth consent screen | **Branding** (ชื่อแอป, อีเมล) |
> | Publishing status + Test users | **Audience** |
> | Credentials → OAuth client IDs | **Clients** |

**APIs & Services → OAuth consent screen** (หรือ **Branding** ใน UI ใหม่)

| ช่อง | ใส่อะไร |
|---|---|
| User Type | **External** |
| App name | `myDashboard` |
| User support email | อีเมลของคุณ |
| Developer contact | อีเมลของคุณ |

หน้า **Audience**

- **Publishing status ปล่อยไว้เป็น Testing** — ไม่ต้องส่ง verify แลกกับ refresh token หมดอายุทุก 7 วัน
- **Test users → + Add users** → ใส่อีเมลที่จะใช้เปิดแดชบอร์ด (บัญชี Gmail ที่อยากดู)

  > ข้อนี้สำคัญ ถ้าไม่ใส่ Google จะปฏิเสธตอน authorize ด้วย `access_denied`

- **อย่าไปยุ่งกับหน้า Data Access** — ตอนอยู่สถานะ Testing โค้ดขอ scope เองตอน redirect ได้เลย ไปเพิ่ม restricted scope เองอาจทำให้ project ขึ้นสถานะรอ verify โดยไม่จำเป็น

### 1.4 สร้าง OAuth client ID

**APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**

(UI ใหม่: **Clients → + Create client**)

| ช่อง | ใส่อะไร |
|---|---|
| Application type | **Web application** |
| Name | `myDashboard local` |
| Authorized redirect URIs | `http://localhost:3000/auth/google/callback` |

กด Create → จะมี popup โชว์ **Client ID** กับ **Client secret** — เปิดค้างไว้ เดี๋ยวเอาไปใส่ `.env`

> ถ้าปิด popup ไปแล้ว กลับเข้าไปที่ client แล้วกดดาวน์โหลด JSON ก็ได้

---

## 2. Slack — สร้างแอปเพื่อขอ user token

ไปที่ https://api.slack.com/apps

### 2.1 สร้างแอป — ทางลัดด้วย manifest

**Create New App → From a manifest** → เลือก workspace ของคุณ → แท็บ **YAML** → ลบของเดิมแล้ววาง

```yaml
display_information:
  name: myDashboard
  description: อ่าน DM และความเคลื่อนไหวในช่องมาแสดงบนแดชบอร์ดส่วนตัว
oauth_config:
  scopes:
    user:
      - channels:read
      - groups:read
      - im:read
      - channels:history
      - groups:history
      - im:history
      - users:read
settings:
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

→ Next → Create — ได้ scope ครบอยู่ใต้ `user` เลย **ข้ามข้อ 2.2 ไปได้**

`token_rotation_enabled: false` สำคัญ — ถ้าเปิด rotation token `xoxp-` จะหมดอายุทุก 12 ชั่วโมงและต้องเขียนโค้ดต่ออายุเอง ซึ่ง `server/slack.js` ไม่รองรับ

> ปุ่ม **From scratch** แบบเดิมตอนนี้ชื่อ **Blank app** ถ้าอยากกดเลือก scope เองให้ใช้ตัวนั้นแล้วทำข้อ 2.2 ต่อ

### 2.2 ขอ scope (ถ้าไม่ได้ใช้ manifest)

เมนูซ้าย **OAuth & Permissions** → เลื่อนลงหา **Scopes**

⚠️ ต้องใส่ในช่อง **User Token Scopes** ไม่ใช่ Bot Token Scopes — dashboard อ่านในนามบัญชีคุณ ไม่ใช่ในนามบอท

| scope | ใช้ทำอะไร |
|---|---|
| `channels:read` | รายชื่อช่อง public |
| `groups:read` | รายชื่อช่อง private |
| `im:read` | รายชื่อห้อง DM |
| `channels:history` | อ่านข้อความในช่อง public |
| `groups:history` | อ่านข้อความในช่อง private |
| `im:history` | อ่านข้อความ DM |
| `users:read` | แปลง user ID เป็นชื่อคน |

### 2.3 ติดตั้งลง workspace

เลื่อนขึ้นบนสุด → **Install to Workspace** → Allow

ได้ **User OAuth Token** ขึ้นต้นด้วย `xoxp-…` — คัดลอกไว้

> ถ้า workspace ตั้งค่าให้แอดมินต้องอนุมัติแอปก่อน จะเห็นข้อความว่ารออนุมัติ ต้องรอแอดมินกดก่อนถึงจะได้ token
>
> token ตัวนี้อ่านได้ทุกอย่างที่บัญชีคุณอ่านได้ รวม DM — อย่าเอาไป commit หรือแปะที่ไหน

---

## 3. ใส่ค่าลง `.env`

```bash
cd myDashboard
cp .env.example .env
```

เปิด `.env` แล้วเติม 3 ค่า

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
SLACK_USER_TOKEN=xoxp-xxxxx
PORT=3000
```

`.env` อยู่ใน `.gitignore` แล้ว จะไม่ติดขึ้น git

---

## 4. รัน

```bash
npm install
npm start
```

จะขึ้นว่า

```
  myDashboard  →  http://localhost:3000
```

เปิดเบราว์เซอร์ไปที่ http://localhost:3000

### ครั้งแรก

แท็บกล่องจดหมาย/รายจ่ายจะขึ้นปุ่ม **เชื่อม Gmail** — กด แล้วเลือกบัญชี

- เจอหน้า **"Google hasn't verified this app"** → กด **Advanced → Go to myDashboard (unsafe)** — ปกติ เพราะแอปอยู่สถานะ Testing และเป็นแอปของคุณเอง
- กด Continue ให้สิทธิ์อ่าน Gmail
- กลับมาที่หน้า "เชื่อม Gmail สำเร็จ" → กดลิงก์กลับหน้า dashboard

Slack ไม่ต้องกดอะไร ใช้ token จาก `.env` เลย

---

## 5. ตรวจว่าใช้ได้

```bash
curl -s localhost:3000/api/status
```

ควรได้ `{"gmail":true,"slack":true}`

```bash
curl -s localhost:3000/api/mail/summary | head -c 300
curl -s localhost:3000/api/slack | head -c 300
```

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `redirect_uri_mismatch` | URI ใน Google Console ไม่ตรงเป๊ะกับ `GOOGLE_REDIRECT_URI` — ต้องเหมือนกันทุกตัวอักษร รวม `http://` และไม่มี `/` ต่อท้าย |
| `access_denied` ตอน authorize | ยังไม่ได้ใส่อีเมลตัวเองใน Test users |
| `/api/status` คืน `gmail:false` ทั้งที่เพิ่ง authorize | ไฟล์ `token.json` เขียนไม่สำเร็จ — เช็คสิทธิ์เขียนในโฟลเดอร์ |
| `slack …: missing_scope (ต้องการ scope: …)` | scope ที่ขาดอยู่ในข้อความ error — เพิ่มใน **User Token Scopes** แล้วต้อง **Reinstall to Workspace** ใหม่ (token เดิมใช้ไม่ได้ ต้องคัดลอกตัวใหม่) |
| `invalid_auth` | token ผิดหรือหมดอายุ / เผลอใช้ Bot token (`xoxb-`) แทน user token (`xoxp-`) |
| Gmail หลุดสิทธิ์ทุก 7 วัน | OAuth consent screen สถานะ Testing → refresh token หมดอายุ 7 วัน กด **Publish app** ถ้าอยากใช้ยาว ๆ (จะขึ้นเตือน unverified แต่ยังใช้ได้) |
| `/api/slack` ช้ามาก | ยิง `conversations.history` ทีละห้อง จำกัดไว้ 25 ห้อง — ผลลัพธ์ cache 60 วินาที โหลดรอบสองจะเร็ว |
| อยากล้างการเชื่อม Gmail | แท็บ "เชื่อมต่ออื่น ๆ" → ปุ่ม **ยกเลิกการเชื่อม** (ลบ `token.json`) |
