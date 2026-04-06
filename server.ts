import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Database from "better-sqlite3";

const db = new Database("enterprise_survey_v2.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS job_levels (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    username TEXT UNIQUE NOT NULL, 
    password TEXT NOT NULL, 
    full_name TEXT NOT NULL, 
    department_id INTEGER, 
    job_level_id INTEGER, 
    role TEXT DEFAULT 'employee',
    mobile TEXT,
    status TEXT DEFAULT 'active'
  );
  CREATE TABLE IF NOT EXISTS surveys (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, instructions TEXT, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS survey_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, survey_id INTEGER NOT NULL, title TEXT NOT NULL, color_theme TEXT DEFAULT 'blue', order_index INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, options TEXT, order_index INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS survey_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, survey_id INTEGER NOT NULL, department_id INTEGER, job_level_id INTEGER);
  CREATE TABLE IF NOT EXISTS responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    survey_id INTEGER NOT NULL, 
    user_id INTEGER NOT NULL, 
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS answers (id INTEGER PRIMARY KEY AUTOINCREMENT, response_id INTEGER NOT NULL, question_id INTEGER NOT NULL, answer_text TEXT);
`);

// Migration: Add missing columns if they don't exist
try { db.exec("ALTER TABLE users ADD COLUMN mobile TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) {}
try { db.exec("ALTER TABLE responses ADD COLUMN started_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) {}
try { db.exec("ALTER TABLE responses ADD COLUMN submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch (e) {}

const seed = () => {
  const deptCount = db.prepare("SELECT COUNT(*) as count FROM departments").get() as any;
  if (deptCount.count === 0) {
    ["HR", "IT", "Marketing"].forEach(d => db.prepare("INSERT INTO departments (name) VALUES (?)").run(d));
    ["Manager", "Senior", "Junior"].forEach(l => db.prepare("INSERT INTO job_levels (name) VALUES (?)").run(l));
    const hp = bcrypt.hashSync("admin123", 10);
    db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)").run("admin", hp, "مدير النظام", "admin");
    db.prepare("INSERT INTO users (username, password, full_name, role, department_id, job_level_id) VALUES (?, ?, ?, ?, ?, ?)").run("employee1", hp, "أحمد محمد", "employee", 1, 2);
  }
};
seed();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const JWT_SECRET = process.env.JWT_SECRET || "mobile-v2-secret";
  app.use(cors()); app.use(express.json());

  const auth = (req: any, res: any, next: any) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "No token provided" });
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => { 
      if (err) return res.status(401).json({ message: "Invalid or expired token" }); 
      req.user = user; 
      next(); 
    });
  };

  const isAdmin = (req: any, res: any, next: any) => { 
    if (req.user.role !== 'admin') return res.status(403).json({ message: "Admin access required" }); 
    next(); 
  };

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: "خطأ" });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, department_id: user.department_id, job_level_id: user.job_level_id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
  });

  app.post("/api/admin/surveys/full", auth, isAdmin, (req, res) => {
    const { title, description, instructions, groups, assignments } = req.body;
    const transaction = db.transaction(() => {
      const sId = db.prepare("INSERT INTO surveys (title, description, instructions) VALUES (?, ?, ?)").run(title, description, instructions).lastInsertRowid;
      groups.forEach((g: any, i: number) => {
        const gId = db.prepare("INSERT INTO survey_groups (survey_id, title, color_theme, order_index) VALUES (?, ?, ?, ?)").run(sId, g.title, g.color_theme, i).lastInsertRowid;
        g.questions.forEach((q: any, j: number) => {
          db.prepare("INSERT INTO questions (group_id, type, text, options, order_index) VALUES (?, ?, ?, ?, ?)").run(gId, q.type, q.text, JSON.stringify(q.options || []), j);
        });
      });
      if (assignments?.length) assignments.forEach((a: any) => db.prepare("INSERT INTO survey_assignments (survey_id, department_id, job_level_id) VALUES (?, ?, ?)").run(sId, a.department_id, a.job_level_id));
      else db.prepare("INSERT INTO survey_assignments (survey_id, department_id, job_level_id) VALUES (?, NULL, NULL)").run(sId);
      return sId;
    });
    res.json({ id: transaction() });
  });

  app.get("/api/admin/surveys", auth, isAdmin, (req, res) => res.json(db.prepare("SELECT * FROM surveys ORDER BY created_at DESC").all()));
  
  app.get("/api/admin/org-data", auth, isAdmin, (req, res) => {
    const departments = db.prepare("SELECT * FROM departments").all();
    const jobLevels = db.prepare("SELECT * FROM job_levels").all();
    res.json({ departments, jobLevels });
  });

  app.get("/api/employee/surveys", auth, (req: any, res) => {
    res.json(db.prepare(`
      SELECT DISTINCT s.* FROM surveys s JOIN survey_assignments sa ON s.id = sa.survey_id
      WHERE s.is_active = 1 AND ((sa.department_id IS NULL AND sa.job_level_id IS NULL) OR (sa.department_id = ? AND sa.job_level_id IS NULL) OR (sa.department_id IS NULL AND sa.job_level_id = ?) OR (sa.department_id = ? AND sa.job_level_id = ?))
      AND s.id NOT IN (SELECT survey_id FROM responses WHERE user_id = ?)
    `).all(req.user.department_id, req.user.job_level_id, req.user.department_id, req.user.job_level_id, req.user.id));
  });

  app.get("/api/surveys/:id/full", auth, (req, res) => {
    const s = db.prepare("SELECT * FROM surveys WHERE id = ?").get(req.params.id) as any;
    if (!s) return res.sendStatus(404);
    const groups = db.prepare("SELECT * FROM survey_groups WHERE survey_id = ? ORDER BY order_index").all(req.params.id) as any[];
    groups.forEach((g: any) => {
      g.questions = db.prepare("SELECT * FROM questions WHERE group_id = ? ORDER BY order_index").all(g.id);
      g.questions.forEach((q: any) => q.options = JSON.parse(q.options || "[]"));
    });
    s.groups = groups; res.json(s);
  });

  app.get("/api/admin/users", auth, isAdmin, (req, res) => {
    res.json(db.prepare(`
      SELECT u.*, d.name as department_name, j.name as job_level_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN job_levels j ON u.job_level_id = j.id
      WHERE u.role = 'employee'
    `).all());
  });

  app.post("/api/admin/users", auth, isAdmin, (req, res) => {
    const { username, password, full_name, department_id, job_level_id, mobile, status } = req.body;
    const hp = bcrypt.hashSync(password, 10);
    try {
      const id = db.prepare("INSERT INTO users (username, password, full_name, department_id, job_level_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(username, hp, full_name, department_id, job_level_id, mobile, status || 'active').lastInsertRowid;
      res.json({ id });
    } catch (err) {
      res.status(400).json({ message: "Username already exists" });
    }
  });

  app.put("/api/admin/users/:id", auth, isAdmin, (req, res) => {
    const { full_name, department_id, job_level_id, mobile, status, password } = req.body;
    if (password) {
      const hp = bcrypt.hashSync(password, 10);
      db.prepare("UPDATE users SET full_name = ?, department_id = ?, job_level_id = ?, mobile = ?, status = ?, password = ? WHERE id = ?").run(full_name, department_id, job_level_id, mobile, status, hp, req.params.id);
    } else {
      db.prepare("UPDATE users SET full_name = ?, department_id = ?, job_level_id = ?, mobile = ?, status = ? WHERE id = ?").run(full_name, department_id, job_level_id, mobile, status, req.params.id);
    }
    res.json({ message: "Updated" });
  });

  app.delete("/api/admin/users/:id", auth, isAdmin, (req, res) => {
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ message: "Deleted" });
  });

  app.post("/api/admin/users/bulk", auth, isAdmin, (req, res) => {
    const users = req.body.users; // Array of user objects
    const transaction = db.transaction((users) => {
      for (const u of users) {
        const hp = bcrypt.hashSync(u.password || '123456', 10);
        db.prepare("INSERT OR IGNORE INTO users (username, password, full_name, department_id, job_level_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)").run(u.username, hp, u.full_name, u.department_id, u.job_level_id, u.mobile, u.status || 'active');
      }
    });
    transaction(users);
    res.json({ message: "Bulk import complete" });
  });

  app.post("/api/employee/surveys/:id/start", auth, (req: any, res) => {
    // Check if response already exists
    const existing = db.prepare("SELECT id FROM responses WHERE survey_id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (existing) return res.json({ id: (existing as any).id });
    
    const id = db.prepare("INSERT INTO responses (survey_id, user_id, started_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(req.params.id, req.user.id).lastInsertRowid;
    res.json({ id });
  });

  app.post("/api/employee/surveys/:id/responses", auth, (req: any, res) => {
    const transaction = db.transaction(() => {
      // Check if response exists, if not create it (fallback)
      let rId: any;
      const existing = db.prepare("SELECT id FROM responses WHERE survey_id = ? AND user_id = ?").get(req.params.id, req.user.id);
      if (existing) {
        rId = (existing as any).id;
        db.prepare("UPDATE responses SET submitted_at = CURRENT_TIMESTAMP WHERE id = ?").run(rId);
      } else {
        rId = db.prepare("INSERT INTO responses (survey_id, user_id, submitted_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(req.params.id, req.user.id).lastInsertRowid;
      }
      
      Object.entries(req.body.answers).forEach(([qId, val]) => {
        // Delete existing answer if any
        db.prepare("DELETE FROM answers WHERE response_id = ? AND question_id = ?").run(rId, qId);
        db.prepare("INSERT INTO answers (response_id, question_id, answer_text) VALUES (?, ?, ?)").run(rId, qId, String(val));
      });
    });
    transaction(); res.json({ message: "Success" });
  });

  app.get("/api/admin/reports/summary", auth, isAdmin, (req, res) => {
    const s = db.prepare("SELECT COUNT(*) as count FROM surveys").get() as any;
    const r = db.prepare("SELECT COUNT(*) as count FROM responses").get() as any;
    const u = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'employee'").get() as any;
    res.json({ totalSurveys: s.count, totalResponses: r.count, totalUsers: u.count, completionRate: u.count > 0 ? ((r.count/u.count)*100).toFixed(1) : 0 });
  });

  app.get("/api/admin/surveys/:id/report", auth, isAdmin, (req, res) => {
    const s = db.prepare("SELECT * FROM surveys WHERE id = ?").get(req.params.id) as any;
    const groups = db.prepare("SELECT * FROM survey_groups WHERE survey_id = ? ORDER BY order_index").all(req.params.id) as any[];
    
    const questions = db.prepare("SELECT q.*, g.title as group_title FROM questions q JOIN survey_groups g ON q.group_id = g.id WHERE g.survey_id = ?").all(req.params.id) as any[];
    
    const report = questions.map(q => {
      const ans = db.prepare("SELECT a.answer_text, u.full_name FROM answers a JOIN responses r ON a.response_id = r.id JOIN users u ON r.user_id = u.id WHERE a.question_id = ?").all(q.id) as any[];
      let analysis: any = {};
      
      if (q.type === 'rating') {
        const values = ans.map(a => Number(a.answer_text)).filter(v => !isNaN(v)).sort((a, b) => a - b);
        if (values.length) {
          // Mean
          analysis.average = (values.reduce((acc, v) => acc + v, 0) / values.length).toFixed(2);
          
          // Median
          const mid = Math.floor(values.length / 2);
          analysis.median = values.length % 2 !== 0 ? values[mid] : ((values[mid - 1] + values[mid]) / 2).toFixed(1);
          
          // Mode
          const counts: any = {};
          values.forEach(v => counts[v] = (counts[v] || 0) + 1);
          let maxCount = 0;
          let modes: number[] = [];
          for (const v in counts) {
            if (counts[v] > maxCount) {
              maxCount = counts[v];
              modes = [Number(v)];
            } else if (counts[v] === maxCount) {
              modes.push(Number(v));
            }
          }
          analysis.mode = modes.join(', ');
        } else {
          analysis.average = 0; analysis.median = 0; analysis.mode = 0;
        }
      } else if (q.type === 'choice') {
        analysis.distribution = ans.reduce((acc, a) => { acc[a.answer_text] = (acc[a.answer_text] || 0) + 1; return acc; }, {} as any);
      } else if (q.type === 'text') {
        analysis.rawAnswers = ans;
      }
      return { ...q, responseCount: ans.length, analysis };
    });

    // Group Analysis
    const groupAnalysis = groups.map(g => {
      const groupQs = report.filter(q => q.group_id === g.id);
      const avgRating = groupQs.filter(q => q.type === 'rating').reduce((acc, q) => acc + Number(q.analysis.average || 0), 0) / (groupQs.filter(q => q.type === 'rating').length || 1);
      return {
        id: g.id,
        title: g.title,
        avgRating: avgRating.toFixed(2),
        questionCount: groupQs.length
      };
    });

    const totalResponses = db.prepare("SELECT COUNT(*) as count FROM responses WHERE survey_id = ?").get(req.params.id) as any;
    
    // Invited count (based on assignments)
    const assignments = db.prepare("SELECT * FROM survey_assignments WHERE survey_id = ?").all(req.params.id) as any[];
    let invitedCount = 0;
    if (assignments.length === 1 && assignments[0].department_id === null && assignments[0].job_level_id === null) {
      invitedCount = (db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'employee'").get() as any).count;
    } else {
      // Complex query for specific assignments
      const deptIds = assignments.map(a => a.department_id).filter(id => id !== null);
      const levelIds = assignments.map(a => a.job_level_id).filter(id => id !== null);
      
      let query = "SELECT COUNT(DISTINCT id) as count FROM users WHERE role = 'employee' AND (";
      const conditions = [];
      if (deptIds.length) conditions.push(`department_id IN (${deptIds.join(',')})`);
      if (levelIds.length) conditions.push(`job_level_id IN (${levelIds.join(',')})`);
      query += conditions.join(' OR ') + ")";
      invitedCount = (db.prepare(query).get() as any).count;
    }

    // Average time taken
    const times = db.prepare(`
      SELECT (strftime('%s', submitted_at) - strftime('%s', started_at)) as duration 
      FROM responses 
      WHERE survey_id = ? AND submitted_at IS NOT NULL AND started_at IS NOT NULL
    `).all(req.params.id) as any[];
    const avgTime = times.length ? (times.reduce((acc, t) => acc + t.duration, 0) / times.length).toFixed(0) : 0;

    res.json({ 
      survey: s, 
      totalResponses: totalResponses.count, 
      invitedCount,
      completionRate: invitedCount > 0 ? ((totalResponses.count / invitedCount) * 100).toFixed(1) : 0,
      avgTime,
      questions: report,
      groupAnalysis
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')));
  }
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}
startServer();
