const API = 'https://api.github.com/graphql';

function token() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) throw new Error('ยังไม่ได้ตั้ง GITHUB_TOKEN ใน .env');
  return t;
}

async function graphql(query) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'myDashboard'
    },
    body: JSON.stringify({ query })
  });

  if (res.status === 401) throw new Error('GITHUB_TOKEN ใช้ไม่ได้ — หมดอายุหรือพิมพ์ผิด');
  const json = await res.json();
  if (json.errors?.length) {
    const m = json.errors[0];
    // ขาด scope จะบอกมาตรง ๆ ใน type/message
    throw new Error(`github: ${m.message}${m.type ? ` (${m.type})` : ''}`);
  }
  if (!json.data) throw new Error(`github: ตอบกลับผิดรูป (HTTP ${res.status})`);
  return json.data;
}

/* contributionCalendar มีเฉพาะใน GraphQL — REST ไม่มี endpoint นี้เลย
   ดึงพร้อมกับคอมมิทล่าสุดในรอบเดียว จะได้ไม่ต้องยิงสองครั้ง */
const Q = `{
  viewer {
    login
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays { date weekday contributionCount contributionLevel }
        }
      }
    }
    repositories(first: 8, isFork: false,
                 orderBy: {field: PUSHED_AT, direction: DESC},
                 affiliations: [OWNER, COLLABORATOR]) {
      nodes {
        nameWithOwner
        defaultBranchRef {
          target {
            ... on Commit {
              history(first: 10) {
                nodes {
                  oid
                  messageHeadline
                  committedDate
                  url
                  author { name user { login } }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

const LEVEL = {
  NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4
};

export async function overview(commitLimit = 20) {
  const { viewer } = await graphql(Q);
  const cal = viewer.contributionsCollection.contributionCalendar;

  const weeks = cal.weeks.map(w => w.contributionDays.map(d => ({
    date: d.date,
    weekday: d.weekday,
    count: d.contributionCount,
    level: LEVEL[d.contributionLevel] ?? 0
  })));

  // แบนคอมมิทจากทุก repo — ไม่กรองตามผู้เขียน จะได้เห็นงานที่ทำร่วมกับคนอื่นด้วย
  const commits = (viewer.repositories.nodes || [])
    .flatMap(r => (r.defaultBranchRef?.target?.history?.nodes || [])
      .map(c => {
        const login = c.author?.user?.login || null;
        return {
          repo: r.nameWithOwner,
          author: login || c.author?.name || 'ไม่ทราบ',
          mine: login === viewer.login,
          sha: c.oid.slice(0, 7),
          msg: c.messageHeadline,
          date: c.committedDate,
          url: c.url
        };
      }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, commitLimit);

  return { login: viewer.login, total: cal.totalContributions, weeks, commits };
}
