const mysql = require('mysql2/promise');
const {logger} = require('./winston');

const pool = mysql.createPool({
    host: '보안',
    user: 'twosu',
    port: '3306',
    password: '보안',
    database: 'coupangDB'
});

module.exports = {
    pool: pool
};
