const {pool} = require('../../../config/database');
const {logger} = require('../../../config/winston');
const resApi = require('../../../config/functions');

/** 내정보관리
 GET /user/profile/management
 **/
exports.getProfileManagement = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 회원 정보 **/
            const selectUserInfoQuery = `select userName, userEmail, userPhone from user where userIdx = ?;`;
            const [selectUserInfoResult] = await connection.query(selectUserInfoQuery, userIdx);

            /** 배송지 정보 **/
            const selectDeliveryQuery = `select userReceiveName, userAddress, userReceivePhone from delivery where userIdx = ? and deliveryCheckStatus = 0;`;
            const [selectDeliveryResult] = await connection.query(selectDeliveryQuery, userIdx);

            let responseData = {};
            responseData = resApi(true, 100, "내정보관리");
            responseData.userInfoResult = selectUserInfoResult;
            responseData.userDeliveryResult = selectDeliveryResult;
            connection.release();
            return res.json(responseData);
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

/** 상단부분
 GET /user/profile
 1. userName
 2. 구매후기
 3. 찜한상품
 4. 최근본상품
 5. 자주산상품
 **/
exports.getProfile = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            /** 회원 정보 **/
            const userInfoQuery = `select userName, userEmail, userPhone from user where userIdx = ?;`;
            const [userInfoResult] = await connection.query(userInfoQuery, userIdx);

            /** 구매후기 **/
            const reviewCountQuery = `select count(userIdx) as reviewCount from review where userIdx = ?;`;
            const [reviewCountResult] = await connection.query(reviewCountQuery, userIdx);

            /** 찜한상품 **/

            /** 최근본상품 **/
            const recentProductCountQuery = `select count(productIdx) as productClickCount from productClick where userIdx = ? limit 20;`;
            const [recentProductCountResult] = await connection.query(recentProductCountQuery, userIdx);

            /** 자주산상품 **/
            const oftenPurchaseProductQuery = `select count(userIdx) as oftenPurchaseProductCount from orderInfo where userIdx = ?;`;
            const [oftenPurchaseProductResult] = await connection.query(oftenPurchaseProductQuery, userIdx)


            let responseData = {};
            responseData = resApi(true, 100, "마이구팡");
            responseData.userInfoResult = userInfoResult;
            responseData.userReviewCountResult = reviewCountResult;
            responseData.userRecentProductCountResult = recentProductCountResult;
            responseData.userOftenPurchaseProductResult = oftenPurchaseProductResult;
            connection.release();
            return res.json(responseData);
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


/** 쿠폰 할인쿠폰
 1. 쿠폰번호 등록
 **/
exports.coupon = async function (req,res) {
    const userIdx = req.verifiedToken.userIdx;
    const couponName = req.body.couponName;
    const couponNumber = req.body.couponNumber;
    try {
        const connection = await pool.getConnection(async conn => conn());
        try {
            if (couponNumber !== 20) {
                connection.release();
                res.json(resApi(false, 300, "교환번호를 다시 입력해주세요"));
            }

            const insertCouponQuery = `insert into coupon (userIdx, couponName, couponNumber) values (?,?, ?);`;
            const insertCouponParams = [userIdx, couponName, couponNumber]
            const [insertCouponResult] = await connection.query(insertCouponQuery, insertCouponParams);

            let responseData = {};
            responseData = resApi(true, 100, "내정보관리");
            responseData.couponResult = insertCouponResult;
            connection.release();
            return res.json(responseData);
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

