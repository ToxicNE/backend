const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'j/00ghLx=',   
  host: 'localhost',
  port: 5432,
  database: 'chatdb'
});

module.exports = pool;

