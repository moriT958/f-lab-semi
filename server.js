const express = require("express");
const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static("public"));

// SQLite DB 初期化
const db = new sqlite3.Database("./records.db");
db.run(`CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  time TEXT,
  breakTime TEXT,
  hours REAL,
  night INTEGER,
  salary INTEGER
)`);

// 勤務記録を保存
app.post("/records", (req, res) => {
  const { date, time, breakTime, hours, night, salary } = req.body;
  db.run(
    `INSERT INTO records (date, time, breakTime, hours, night, salary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [date, time, breakTime, hours, night, salary],
    function (err) {
      if (err) return res.status(500).send(err.message);
      res.json({ id: this.lastID });
    },
  );
});

// 勤務記録を取得
app.get("/records", (req, res) => {
  db.all(`SELECT * FROM records`, (err, rows) => {
    if (err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// 勤務記録を削除
app.delete("/records/:id", (req, res) => {
  db.run(`DELETE FROM records WHERE id = ?`, req.params.id, (err) => {
    if (err) return res.status(500).send(err.message);
    res.sendStatus(200);
  });
});

// CSV出力
app.get("/records/csv", (req, res) => {
  db.all(`SELECT * FROM records`, (err, rows) => {
    if (err) return res.status(500).send(err.message);

    const header = "勤務日,時間,休憩時間,実働(時間),深夜分(分),給料(円)";
    const lines = rows.map((r) =>
      [r.date, r.time, r.breakTime, r.hours, r.night, r.salary].join(","),
    );

    // 合計行の追加
    const totalHours = rows.reduce((sum, r) => sum + parseFloat(r.hours), 0);
    const totalNight = rows.reduce((sum, r) => sum + r.night, 0);
    const totalSalary = rows.reduce((sum, r) => sum + r.salary, 0);
    lines.push(
      ["合計", "", "", totalHours.toFixed(2), totalNight, totalSalary].join(
        ",",
      ),
    );

    const csv = "\uFEFF" + [header, ...lines].join("\n"); // BOM付き

    const filename = path.join(__dirname, "勤務記録.csv");
    fs.writeFileSync(filename, csv);
    res.download(filename);
  });
});

app.listen(port, () => {
  console.log(`✅ サーバー起動中：http://localhost:${port}`);
});
