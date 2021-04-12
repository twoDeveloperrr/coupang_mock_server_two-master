const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const secret_config = require('../../../config/secret');

/** 정규식 모음 **/
const regexEmail = require('regex-email');
const regexName = /^[가-힣]{2,4}$/;
const regexPhone =  /^\d{3}-\d{3,4}-\d{4}$/;

const regexPassword = /^(?=.*[a-zA-Z])(?=.*[!@#$%^*+=-])(?=.*[0-9]).{8,20}/;
const regexPasswordContinue = /(\w)\1\1/;

/** 회원가입
 POST /login/join
 **/
exports.postJoin = async function (req,res) {
    try {
        const userEmail = req.body.userEmail;
        const userPassword = req.body.userPassword;
        const userName = req.body.userName;
        const userPhone = req.body.userPhone;
        const connection = await pool.getConnection(async conn => conn());
        try {
            // 이메일을 올바르게 입력하세요
            if (!userEmail) {
                connection.release();
                return res.json(resApi(false,300, "이메일을 압력하세요."));
            }
            /** 이메일 정규식 **/
            if (!regexEmail.test(userEmail)){
                connection.release();
                return res.json(resApi(false, 300, "이메일을 올바르게 입력하세요."));
            }

            /** 비밀번호 정규식 **/
            if (!regexPassword.test(userPassword)) {
                connection.release();
                return res.json(resApi(false, 301, "영문/숫자/특수문자 2가지 이상 조합 (8~20자)"));
            }
            if (regexPasswordContinue.test(userPassword)) {
                connection.release();
                return res.json(resApi(false, 301, "3개 이상 연속되거나 동일한 문자/숫자 제외"));
            }

            /** 이름 정규식 **/
            if (!regexName.test(userName)) {
                connection.release();
                return res.json(resApi(false,302, "아름을 정확히 입력하세요."))
            }

            /** 핸드폰 정규식 **/
            if (!regexPhone.test(userPhone)){
                connection.release();
                return res.json(resApi(false, 303, "휴대폰 번호를 정확하게 입력하세요."));
            }

            // 중복된 이메일
            const getExistUserEmailQuery = `select exists(select userEmail from user where userEmail = ?) as exist;`;
            const [isExistUserEmail] = await connection.query(getExistUserEmailQuery, userEmail);
            if(isExistUserEmail[0].exist) {
                connection.release();
                return res.json(resApi(false, 304, "중복된 이메일 입니다."));
            }

            const hashedPassword = await crypto.createHash('sha512').update(userPassword).digest('hex');

            const insertJoinQuery = `insert into user(userEmail, userPassword, userName, userPhone) values (?, ?, ?, ?);`;
            const insertJoinParams = [userEmail, hashedPassword, userName, userPhone];
            const [insertJoinResult] = await connection.query(insertJoinQuery, insertJoinParams);

            let responseData = {};
            responseData = resApi(true, 100, "회원가입완료");
            responseData.result = insertJoinResult;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return res.json(resApi(false, 200, "trx fail"));
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return res.json(resApi(false, 201, "db connection fail"));
    }
};


/** 로그인
 POST /login
 **/
exports.postLogin = async function (req,res) {
    const userEmail = req.body.userEmail;
    const userPassword = req.body.userPassword;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            if (!userEmail) {
                connection.release();
                return res.json(resApi(false, 300, "이메일을 입력하세요"));
            }

            if(!userPassword) {
                connection.release();
                return res.json(resApi(false, 301, "비밀번호를 입력하세요"));
            }

            /** 이메일이 일치하지 않을 경우**/
            const getExistUserEmailQuery = `select exists(select userEmail from user where userEmail = ?) as exist;`;
            const [isExistUserEmail] = await connection.query(getExistUserEmailQuery, userEmail);
            if (!isExistUserEmail[0].exist) {
                connection.release();
                return res.json(resApi(false, 311, "이메일이 일치하지 않습니다"));
            }

            const selectUserQuery = `select userIdx, userName, userEmail, userPassword, userPhone from user where userEmail = ?;`;
            const selectUserParams = [userEmail];
            const [userInfoRows] = await connection.query(selectUserQuery, selectUserParams);

            if (userInfoRows.length > 1) {
                connection.release();
                return res.json(resApi(false, 310, "이메일을 확인해 주세요"));
            }

            const hashedPassword = await crypto.createHash('sha512').update(userPassword).digest('hex');
            if (userInfoRows[0].userPassword !== hashedPassword) {
                connection.release();
                return res.json(resApi(false, 312, "비밀번호를 확인해 주세요"));
            }

            //Token 발급
            let token = await jwt.sign({
                    userIdx : userInfoRows[0].userIdx,
                    userEmail : userInfoRows[0].userEmail,
                    userName : userInfoRows[0].userName,
                    userPhone : userInfoRows[0].userPhone
                },
                secret_config.jwtsecret,
                {
                    expiresIn: '365d',
                    subject: 'userInfo',
                }
            );
            let responseData = {};
            responseData = resApi(true, 100, "로그인 성공");
            responseData.email = userInfoRows[0].userEmail;
            responseData.name = userInfoRows[0].userName;
            responseData.phone = userInfoRows[0].userPhone;
            responseData.JWT = token;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return resApi(false, 200, "trx fail");
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return resApi(false, 201, "db connection fail");
    }
};
/** 로그아웃 **/

/** 유저정보 API
 GET /user
 **/
exports.getUser = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            const selectUserQuery = `select userName, userEmail, userPhone from user where userIdx = ?;`;
            const [userInfoRows] = await connection.query(selectUserQuery, userIdx);
            console.log(userIdx)
            let responseData = {};
            responseData = resApi(true, 100, "내정보관리");
            responseData.info = req.verifiedToken;
            connection.release();
            return res.json(responseData)
        } catch (err) {
            logger.error(`post PlayList transaction Query error\n: ${JSON.stringify(err)}`);
            connection.release();
            return resApi(false, 200, "trx fail");
        }
    } catch (err) {
        logger.error(`post PlayList transaction DB Connection error\n: ${JSON.stringify(err)}`);
        return resApi(false, 201, "db connection fail");
    }
};
