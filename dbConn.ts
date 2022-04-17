var sql = require('mssql');

// DB configuration
var dbConfig = {
 user: 'sa',
 password: '',
 server: '',
 database: 'TechReadyDB',
 port: 1433,
 trustServerCertificate: true,
 pool: {
     max: 10,
     min: 0,
     idleTimeoutMillis: 30000
 }
};

// 查询所有的用户信息
// function getAllUsers() {
//  var conn = new sql.ConnectionPool(dbConfig);
//  console.log(conn);
//  var req = new sql.Request(conn);
//  conn.connect(function (err) {
//      if (err) {
//          console.log(err);
//          return;
//      }
//      // 查询user表
//      req.query("select * from t_TradeLog", function (err, recordset) {
//          if (err) {
//              console.log(err);
//              return;
//          }
//          else {
//              console.log(recordset);
//          }
//          conn.close();
//      });
//  });
//  }
 
// // 查询所有的用户信息
// getAllUsers();