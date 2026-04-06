import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || "4000"),
  ssl: { rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDb() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log("✅ Database connection successful.");
    const charset = "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
    const tables = [
      `CREATE TABLE IF NOT EXISTS departments (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE) ${charset}`,
      `CREATE TABLE IF NOT EXISTS job_levels (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) NOT NULL UNIQUE) ${charset}`,
      `CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        username VARCHAR(255) UNIQUE NOT NULL, 
        password VARCHAR(255) NOT NULL, 
        full_name VARCHAR(255) NOT NULL, 
        department_id INT, 
        job_level_id INT, 
        role VARCHAR(50) DEFAULT 'employee',
        mobile VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active'
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS surveys (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        title VARCHAR(255) NOT NULL, 
        description TEXT, 
        instructions TEXT, 
        is_active TINYINT DEFAULT 1, 
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS survey_groups (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        survey_id INT NOT NULL, 
        title VARCHAR(255) NOT NULL, 
        color_theme VARCHAR(50) DEFAULT 'blue', 
        order_index INT DEFAULT 0
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS questions (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        group_id INT NOT NULL, 
        type VARCHAR(50) NOT NULL, 
        text TEXT NOT NULL, 
        options JSON, 
        order_index INT DEFAULT 0
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS survey_assignments (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        survey_id INT NOT NULL, 
        department_id INT, 
        job_level_id INT
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS responses (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        survey_id INT NOT NULL, 
        user_id INT NOT NULL, 
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        submitted_at DATETIME
      ) ${charset}`,
      `CREATE TABLE IF NOT EXISTS answers (
        id INT PRIMARY KEY AUTO_INCREMENT, 
        response_id INT NOT NULL, 
        question_id INT NOT NULL, 
        answer_text TEXT
      ) ${charset}`
    ];

    for (const sql of tables) {
      try {
        await connection.query(sql);
      } catch (err: any) {
        if (err.code === 'ER_TABLEACCESS_DENIED_ERROR') {
          console.warn(`Warning: Permission denied to CREATE table. Assuming it already exists.`);
        } else {
          console.error(`Error creating table:`, err.message);
        }
      }
    }

    // Seed data
    try {
      const [depts]: any = await connection.query("SELECT COUNT(*) as count FROM departments");
      if (depts[0].count === 0) {
        for (const d of ["HR", "IT", "Marketing"]) await connection.execute("INSERT INTO departments (name) VALUES (?)", [d]);
        for (const l of ["Manager", "Senior", "Junior"]) await connection.execute("INSERT INTO job_levels (name) VALUES (?)", [l]);
        const hp = bcrypt.hashSync("admin123", 10);
        await connection.execute("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)", ["admin", hp, "مدير النظام", "admin"]);
        await connection.execute("INSERT INTO users (username, password, full_name, role, department_id, job_level_id) VALUES (?, ?, ?, ?, ?, ?)", ["employee1", hp, "أحمد محمد", "employee", 1, 2]);
      }
    } catch (err: any) {
      console.warn("Warning: Could not seed data. This is expected if tables don't exist or permissions are restricted.");
    }
  } catch (err: any) {
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error("❌ Database Access Denied Error:");
      console.error("   Please check your database credentials in Settings > Secrets.");
      console.error("   Ensure DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME are correct.");
      console.error("   Also, ensure your TiDB Cloud cluster has allowlisted the current IP (34.96.62.132).");
    } else {
      console.error("❌ Database connection failed:", err.message);
    }
  } finally {
    if (connection) connection.release();
  }
}

async function startServer() {
  await initDb();
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

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const [rows]: any = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: "خطأ" });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, department_id: user.department_id, job_level_id: user.job_level_id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
  });

  app.post("/api/admin/surveys/full", auth, isAdmin, async (req, res) => {
    const { title, description, instructions, groups, assignments } = req.body;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [surveyResult]: any = await connection.execute("INSERT INTO surveys (title, description, instructions) VALUES (?, ?, ?)", [title, description, instructions]);
      const sId = surveyResult.insertId;

      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        const [groupResult]: any = await connection.execute("INSERT INTO survey_groups (survey_id, title, color_theme, order_index) VALUES (?, ?, ?, ?)", [sId, g.title, g.color_theme, i]);
        const gId = groupResult.insertId;

        for (let j = 0; j < g.questions.length; j++) {
          const q = g.questions[j];
          await connection.execute("INSERT INTO questions (group_id, type, text, options, order_index) VALUES (?, ?, ?, ?, ?)", [gId, q.type, q.text, JSON.stringify(q.options || []), j]);
        }
      }

      if (assignments?.length) {
        for (const a of assignments) {
          await connection.execute("INSERT INTO survey_assignments (survey_id, department_id, job_level_id) VALUES (?, ?, ?)", [sId, a.department_id || null, a.job_level_id || null]);
        }
      } else {
        await connection.execute("INSERT INTO survey_assignments (survey_id, department_id, job_level_id) VALUES (?, NULL, NULL)", [sId]);
      }

      await connection.commit();
      res.json({ id: sId });
    } catch (err) {
      await connection.rollback();
      console.error(err);
      res.status(500).json({ message: "Error creating survey" });
    } finally {
      connection.release();
    }
  });

  app.get("/api/admin/surveys", auth, isAdmin, async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM surveys ORDER BY created_at DESC");
    res.json(rows);
  });
  
  app.get("/api/admin/org-data", auth, isAdmin, async (req, res) => {
    const [departments] = await pool.query("SELECT * FROM departments");
    const [jobLevels] = await pool.query("SELECT * FROM job_levels");
    res.json({ departments, jobLevels });
  });

  app.get("/api/employee/surveys", auth, async (req: any, res) => {
    const [rows] = await pool.execute(`
      SELECT DISTINCT s.* FROM surveys s JOIN survey_assignments sa ON s.id = sa.survey_id
      WHERE s.is_active = 1 AND ((sa.department_id IS NULL AND sa.job_level_id IS NULL) OR (sa.department_id = ? AND sa.job_level_id IS NULL) OR (sa.department_id IS NULL AND sa.job_level_id = ?) OR (sa.department_id = ? AND sa.job_level_id = ?))
      AND s.id NOT IN (SELECT survey_id FROM responses WHERE user_id = ?)
    `, [req.user.department_id, req.user.job_level_id, req.user.department_id, req.user.job_level_id, req.user.id]);
    res.json(rows);
  });

  app.get("/api/surveys/:id/full", auth, async (req, res) => {
    const [surveys]: any = await pool.execute("SELECT * FROM surveys WHERE id = ?", [req.params.id]);
    const s = surveys[0];
    if (!s) return res.sendStatus(404);
    const [groups]: any = await pool.execute("SELECT * FROM survey_groups WHERE survey_id = ? ORDER BY order_index", [req.params.id]);
    for (const g of groups) {
      const [questions]: any = await pool.execute("SELECT * FROM questions WHERE group_id = ? ORDER BY order_index", [g.id]);
      g.questions = questions.map((q: any) => ({ ...q, options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options }));
    }
    s.groups = groups; res.json(s);
  });

  app.get("/api/admin/users", auth, isAdmin, async (req, res) => {
    const [rows] = await pool.query(`
      SELECT u.*, d.name as department_name, j.name as job_level_name 
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN job_levels j ON u.job_level_id = j.id
      WHERE u.role = 'employee'
    `);
    res.json(rows);
  });

  app.post("/api/admin/users", auth, isAdmin, async (req, res) => {
    const { username, password, full_name, department_id, job_level_id, mobile, status } = req.body;
    const hp = bcrypt.hashSync(password, 10);
    try {
      const [result]: any = await pool.execute("INSERT INTO users (username, password, full_name, department_id, job_level_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [username, hp, full_name, department_id || null, job_level_id || null, mobile, status || 'active']);
      res.json({ id: result.insertId });
    } catch (err) {
      res.status(400).json({ message: "Username already exists" });
    }
  });

  app.put("/api/admin/users/:id", auth, isAdmin, async (req, res) => {
    const { full_name, department_id, job_level_id, mobile, status, password } = req.body;
    if (password) {
      const hp = bcrypt.hashSync(password, 10);
      await pool.execute("UPDATE users SET full_name = ?, department_id = ?, job_level_id = ?, mobile = ?, status = ?, password = ? WHERE id = ?", [full_name, department_id || null, job_level_id || null, mobile, status, hp, req.params.id]);
    } else {
      await pool.execute("UPDATE users SET full_name = ?, department_id = ?, job_level_id = ?, mobile = ?, status = ? WHERE id = ?", [full_name, department_id || null, job_level_id || null, mobile, status, req.params.id]);
    }
    res.json({ message: "Updated" });
  });

  app.delete("/api/admin/users/:id", auth, isAdmin, async (req, res) => {
    await pool.execute("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  });

  app.post("/api/admin/users/bulk", auth, isAdmin, async (req, res) => {
    const users = req.body.users;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const u of users) {
        const hp = bcrypt.hashSync(u.password || '123456', 10);
        await connection.execute("INSERT IGNORE INTO users (username, password, full_name, department_id, job_level_id, mobile, status) VALUES (?, ?, ?, ?, ?, ?, ?)", [u.username, hp, u.full_name, u.department_id || null, u.job_level_id || null, u.mobile, u.status || 'active']);
      }
      await connection.commit();
      res.json({ message: "Bulk import complete" });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ message: "Bulk import failed" });
    } finally {
      connection.release();
    }
  });

  app.post("/api/employee/surveys/:id/start", auth, async (req: any, res) => {
    const [existing]: any = await pool.execute("SELECT id FROM responses WHERE survey_id = ? AND user_id = ?", [req.params.id, req.user.id]);
    if (existing.length) return res.json({ id: existing[0].id });
    
    const [result]: any = await pool.execute("INSERT INTO responses (survey_id, user_id, started_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [req.params.id, req.user.id]);
    res.json({ id: result.insertId });
  });

  app.post("/api/employee/surveys/:id/responses", auth, async (req: any, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      let rId: any;
      const [existing]: any = await connection.execute("SELECT id FROM responses WHERE survey_id = ? AND user_id = ?", [req.params.id, req.user.id]);
      if (existing.length) {
        rId = existing[0].id;
        await connection.execute("UPDATE responses SET submitted_at = CURRENT_TIMESTAMP WHERE id = ?", [rId]);
      } else {
        const [result]: any = await connection.execute("INSERT INTO responses (survey_id, user_id, submitted_at) VALUES (?, ?, CURRENT_TIMESTAMP)", [req.params.id, req.user.id]);
        rId = result.insertId;
      }
      
      for (const [qId, val] of Object.entries(req.body.answers)) {
        await connection.execute("DELETE FROM answers WHERE response_id = ? AND question_id = ?", [rId, qId]);
        await connection.execute("INSERT INTO answers (response_id, question_id, answer_text) VALUES (?, ?, ?)", [rId, qId, String(val)]);
      }
      await connection.commit();
      res.json({ message: "Success" });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ message: "Failed to submit responses" });
    } finally {
      connection.release();
    }
  });

  app.get("/api/admin/reports/summary", auth, isAdmin, async (req, res) => {
    const [s]: any = await pool.query("SELECT COUNT(*) as count FROM surveys");
    const [r]: any = await pool.query("SELECT COUNT(*) as count FROM responses");
    const [u]: any = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'employee'");
    res.json({ totalSurveys: s[0].count, totalResponses: r[0].count, totalUsers: u[0].count, completionRate: u[0].count > 0 ? ((r[0].count/u[0].count)*100).toFixed(1) : 0 });
  });

  app.get("/api/admin/surveys/:id/report", auth, isAdmin, async (req, res) => {
    const [surveys]: any = await pool.execute("SELECT * FROM surveys WHERE id = ?", [req.params.id]);
    const s = surveys[0];
    const [groups]: any = await pool.execute("SELECT * FROM survey_groups WHERE survey_id = ? ORDER BY order_index", [req.params.id]);
    const [questions]: any = await pool.execute("SELECT q.*, g.title as group_title FROM questions q JOIN survey_groups g ON q.group_id = g.id WHERE g.survey_id = ?", [req.params.id]);
    
    const report = [];
    for (const q of questions) {
      const [ans]: any = await pool.execute("SELECT a.answer_text, u.full_name FROM answers a JOIN responses r ON a.response_id = r.id JOIN users u ON r.user_id = u.id WHERE a.question_id = ?", [q.id]);
      let analysis: any = {};
      
      if (q.type === 'rating') {
        const values = ans.map((a: any) => Number(a.answer_text)).filter((v: any) => !isNaN(v)).sort((a: any, b: any) => a - b);
        if (values.length) {
          analysis.average = (values.reduce((acc: any, v: any) => acc + v, 0) / values.length).toFixed(2);
          const mid = Math.floor(values.length / 2);
          analysis.median = values.length % 2 !== 0 ? values[mid] : ((values[mid - 1] + values[mid]) / 2).toFixed(1);
          const counts: any = {};
          values.forEach((v: any) => counts[v] = (counts[v] || 0) + 1);
          let maxCount = 0;
          let modes: number[] = [];
          for (const v in counts) {
            if (counts[v] > maxCount) { maxCount = counts[v]; modes = [Number(v)]; }
            else if (counts[v] === maxCount) { modes.push(Number(v)); }
          }
          analysis.mode = modes.join(', ');
        } else {
          analysis.average = 0; analysis.median = 0; analysis.mode = 0;
        }
      } else if (q.type === 'choice') {
        analysis.distribution = ans.reduce((acc: any, a: any) => { acc[a.answer_text] = (acc[a.answer_text] || 0) + 1; return acc; }, {} as any);
      } else if (q.type === 'text') {
        analysis.rawAnswers = ans;
      }
      report.push({ ...q, responseCount: ans.length, analysis });
    }

    const groupAnalysis = groups.map((g: any) => {
      const groupQs = report.filter(q => q.group_id === g.id);
      const ratingQs = groupQs.filter(q => q.type === 'rating');
      const avgRating = ratingQs.length ? ratingQs.reduce((acc, q) => acc + Number(q.analysis.average || 0), 0) / ratingQs.length : 0;
      return { id: g.id, title: g.title, avgRating: avgRating.toFixed(2), questionCount: groupQs.length };
    });

    const [totalResponses]: any = await pool.execute("SELECT COUNT(*) as count FROM responses WHERE survey_id = ?", [req.params.id]);
    const [assignments]: any = await pool.execute("SELECT * FROM survey_assignments WHERE survey_id = ?", [req.params.id]);
    let invitedCount = 0;
    if (assignments.length === 1 && assignments[0].department_id === null && assignments[0].job_level_id === null) {
      const [u]: any = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'employee'");
      invitedCount = u[0].count;
    } else {
      const deptIds = assignments.map((a: any) => a.department_id).filter((id: any) => id !== null);
      const levelIds = assignments.map((a: any) => a.job_level_id).filter((id: any) => id !== null);
      let query = "SELECT COUNT(DISTINCT id) as count FROM users WHERE role = 'employee' AND (";
      const conditions = [];
      if (deptIds.length) conditions.push(`department_id IN (${deptIds.join(',')})`);
      if (levelIds.length) conditions.push(`job_level_id IN (${levelIds.join(',')})`);
      if (conditions.length) {
        query += conditions.join(' OR ') + ")";
        const [u]: any = await pool.query(query);
        invitedCount = u[0].count;
      }
    }

    const [times]: any = await pool.execute(`
      SELECT (UNIX_TIMESTAMP(submitted_at) - UNIX_TIMESTAMP(started_at)) as duration 
      FROM responses 
      WHERE survey_id = ? AND submitted_at IS NOT NULL AND started_at IS NOT NULL
    `, [req.params.id]);
    const avgTime = times.length ? (times.reduce((acc: any, t: any) => acc + t.duration, 0) / times.length).toFixed(0) : 0;

    res.json({ 
      survey: s, 
      totalResponses: totalResponses[0].count, 
      invitedCount,
      completionRate: invitedCount > 0 ? ((totalResponses[0].count / invitedCount) * 100).toFixed(1) : 0,
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
